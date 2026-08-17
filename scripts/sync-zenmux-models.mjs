import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'

const START_MARKER = '          # zenmux-model-catalog:start'
const END_MARKER = '          # zenmux-model-catalog:end'
const DEFAULT_CATALOG_URL = 'https://zenmux.ai/api/v1/models'
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const patchPath = resolve(repositoryRoot, 'cordis.patch.yml')
const execFileAsync = promisify(execFile)

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

function quoted(value) {
  return `'${value.replaceAll("'", "''")}'`
}

export function selectLanguageModels(payload) {
  if (typeof payload !== 'object' || payload === null || !Array.isArray(payload.data)) {
    throw new Error('ZenMux /models response must contain a data array')
  }

  const seen = new Set()
  const models = []
  for (const entry of payload.data) {
    if (typeof entry !== 'object' || entry === null) continue
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    if (id === '' || seen.has(id)) continue
    const outputModalities = Array.isArray(entry.output_modalities) ? entry.output_modalities : []
    if (!outputModalities.includes('text')) continue

    seen.add(id)
    const inputModalities = Array.isArray(entry.input_modalities) ? entry.input_modalities : []
    models.push({
      id,
      name: typeof entry.display_name === 'string' && entry.display_name.trim() !== ''
        ? entry.display_name.trim()
        : id,
      contextWindow: isPositiveInteger(entry.context_length) ? entry.context_length : undefined,
      maxTokens: isPositiveInteger(entry.max_output_tokens) ? entry.max_output_tokens : undefined,
      input: inputModalities.includes('image') ? ['text', 'image'] : ['text'],
      reasoning: entry.capabilities?.reasoning === true,
    })
  }
  return models
}

export function renderCatalog(models) {
  const lines = []
  for (const model of models) {
    lines.push(`          - id: ${quoted(model.id)}`)
    lines.push(`            name: ${quoted(model.name)}`)
    if (model.contextWindow !== undefined) lines.push(`            contextWindow: ${model.contextWindow}`)
    if (model.maxTokens !== undefined) lines.push(`            maxTokens: ${model.maxTokens}`)
    lines.push('            input:')
    for (const modality of model.input) lines.push(`              - ${modality}`)
    if (model.reasoning) {
      lines.push('            reasoningEfforts:')
      lines.push("              'off': null")
      lines.push('              minimal: minimal')
      lines.push('              low: low')
      lines.push('              medium: medium')
      lines.push('              high: high')
    }
  }
  return lines.join('\n')
}

export function replaceGeneratedCatalog(patch, catalog) {
  const start = patch.indexOf(START_MARKER)
  const end = patch.indexOf(END_MARKER)
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('cordis.patch.yml is missing the ZenMux model catalog markers')
  }
  const afterStart = start + START_MARKER.length
  return `${patch.slice(0, afterStart)}\n${catalog}\n${patch.slice(end)}`
}

function parseArgs(argv) {
  const options = { check: false, input: undefined, url: process.env.ZENMUX_MODELS_CATALOG_URL ?? DEFAULT_CATALOG_URL }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--check') options.check = true
    else if (arg === '--input') options.input = argv[++index]
    else if (arg === '--url') options.url = argv[++index]
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (options.input === undefined && (typeof options.url !== 'string' || options.url.trim() === '')) {
    throw new Error('A non-empty ZenMux model catalog URL is required')
  }
  return options
}

async function loadPayload(options) {
  if (options.input !== undefined) return JSON.parse(await readFile(resolve(options.input), 'utf8'))
  try {
    const response = await fetch(options.url, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`ZenMux /models returned HTTP ${response.status}`)
    return response.json()
  } catch (fetchError) {
    try {
      const { stdout } = await execFileAsync('curl', [
        '--fail',
        '--silent',
        '--show-error',
        '--location',
        '--max-time',
        '30',
        '--header',
        'Accept: application/json',
        options.url,
      ], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
      return JSON.parse(stdout)
    } catch (curlError) {
      throw new Error('Unable to fetch the ZenMux /models catalog with Node or curl', {
        cause: new AggregateError([fetchError, curlError]),
      })
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const payload = await loadPayload(options)
  const models = selectLanguageModels(payload)
  if (models.length === 0) throw new Error('ZenMux /models returned no text-output language models')
  const patch = await readFile(patchPath, 'utf8')
  const next = replaceGeneratedCatalog(patch, renderCatalog(models))
  if (options.check) {
    if (next !== patch) {
      throw new Error(`Bundled ZenMux model catalog is stale; run pnpm sync:models (${models.length} text models found)`)
    }
  } else if (next !== patch) {
    await writeFile(patchPath, next)
  }
  const total = Array.isArray(payload.data) ? payload.data.length : 0
  console.log(`ZenMux catalog: ${models.length} text models bundled, ${total - models.length} non-text or invalid entries skipped`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
