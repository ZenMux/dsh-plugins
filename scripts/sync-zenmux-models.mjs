import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ANTHROPIC_START_MARKER = '          # zenmux-anthropic-model-catalog:start'
const ANTHROPIC_END_MARKER = '          # zenmux-anthropic-model-catalog:end'
const OPENAI_START_MARKER = '          # zenmux-openai-model-catalog:start'
const OPENAI_END_MARKER = '          # zenmux-openai-model-catalog:end'
const DEFAULT_CATALOG_URL = 'https://zenmux.ai/api/v1/models'
const DEFAULT_ANTHROPIC_CATALOG_URL = 'https://zenmux.ai/api/anthropic/v1/models'
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

export function partitionLanguageModels(openaiPayload, anthropicPayload) {
  const openaiModels = selectLanguageModels(openaiPayload)
  const anthropicModels = selectLanguageModels(anthropicPayload)
  const anthropicIds = new Set(anthropicModels.map(model => model.id))
  const openaiOnlyModels = openaiModels.filter(model => !anthropicIds.has(model.id))
  const uniqueIds = new Set([
    ...anthropicModels.map(model => model.id),
    ...openaiOnlyModels.map(model => model.id),
  ])
  return { anthropicModels, openaiOnlyModels, totalUnique: uniqueIds.size }
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

export function replaceGeneratedCatalog(patch, catalog, startMarker, endMarker) {
  const start = patch.indexOf(startMarker)
  const end = patch.indexOf(endMarker)
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('cordis.patch.yml is missing the ZenMux model catalog markers')
  }
  const afterStart = start + startMarker.length
  return `${patch.slice(0, afterStart)}\n${catalog}\n${patch.slice(end)}`
}

function parseArgs(argv) {
  const options = {
    check: false,
    input: undefined,
    anthropicInput: undefined,
    url: process.env.ZENMUX_MODELS_CATALOG_URL ?? DEFAULT_CATALOG_URL,
    anthropicUrl: process.env.ZENMUX_ANTHROPIC_MODELS_CATALOG_URL ?? DEFAULT_ANTHROPIC_CATALOG_URL,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--check') options.check = true
    else if (arg === '--input') options.input = argv[++index]
    else if (arg === '--anthropic-input') options.anthropicInput = argv[++index]
    else if (arg === '--url') options.url = argv[++index]
    else if (arg === '--anthropic-url') options.anthropicUrl = argv[++index]
    else throw new Error(`Unknown argument: ${arg}`)
  }
  if (options.input === undefined && (typeof options.url !== 'string' || options.url.trim() === '')) {
    throw new Error('A non-empty ZenMux model catalog URL is required')
  }
  if (options.anthropicInput === undefined && (typeof options.anthropicUrl !== 'string' || options.anthropicUrl.trim() === '')) {
    throw new Error('A non-empty ZenMux Anthropic model catalog URL is required')
  }
  return options
}

async function loadPayload(input, url) {
  if (input !== undefined) return JSON.parse(await readFile(resolve(input), 'utf8'))
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
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
        url,
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
  const [openaiPayload, anthropicPayload] = await Promise.all([
    loadPayload(options.input, options.url),
    loadPayload(options.anthropicInput, options.anthropicUrl),
  ])
  const { anthropicModels, openaiOnlyModels, totalUnique } = partitionLanguageModels(
    openaiPayload,
    anthropicPayload,
  )
  if (anthropicModels.length === 0) throw new Error('ZenMux Anthropic /models returned no text-output language models')
  if (openaiOnlyModels.length === 0) throw new Error('ZenMux /models returned no OpenAI-only text-output language models')
  const patch = await readFile(patchPath, 'utf8')
  const withAnthropic = replaceGeneratedCatalog(
    patch,
    renderCatalog(anthropicModels),
    ANTHROPIC_START_MARKER,
    ANTHROPIC_END_MARKER,
  )
  const next = replaceGeneratedCatalog(
    withAnthropic,
    renderCatalog(openaiOnlyModels),
    OPENAI_START_MARKER,
    OPENAI_END_MARKER,
  )
  if (options.check) {
    if (next !== patch) {
      throw new Error(`Bundled ZenMux model catalogs are stale; run pnpm sync:models (${totalUnique} unique text models found)`)
    }
  } else if (next !== patch) {
    await writeFile(patchPath, next)
  }
  console.log(`ZenMux catalogs: ${anthropicModels.length} Anthropic models + ${openaiOnlyModels.length} OpenAI-only models = ${totalUnique} unique text models`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
