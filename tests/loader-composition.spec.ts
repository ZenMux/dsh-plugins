import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent, AgentStatus } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import LocalCredentialProvider from '@deepseek-ai/dsh-credentials-local'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import * as zenmuxOAuth from '@zenmux/dsh-plugins'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** Build one agent after the real Loader composition has activated. */
function stubAgent(ctx: Context): Agent {
  const session = ctx.sessions.create(SessionId(`zenmux-loader-${Math.random()}`))
  const inbox = new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} })
  let status: AgentStatus = 'idle'
  return {
    id: session.id,
    options: {},
    session,
    inbox,
    ctx: new Context(),
    get status() { return status },
    send: () => {},
    followup: () => {},
    steer: () => {},
    inject: () => {},
    cancel() { status = 'idle' },
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

describe('ZenMux real composition', () => {
  it('declares the Anthropic compatibility route plus the generated OpenAI model catalog', async () => {
    const manifestPath = fileURLToPath(new URL('../package.json', import.meta.url))
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      name?: string
      dsh?: { bundle?: { patch?: string } }
    }
    expect(manifest.name).toBe('@zenmux/dsh-plugins')
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    const patch = await readFile(fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)), 'utf8')
    expect(patch).toContain("name: '@zenmux/dsh-plugins'")
    expect(patch).toContain("id: llm-pi-ai")
    expect(patch).toContain("apiKeyEnv: ZENMUX_OAUTH_ACCESS_TOKEN")
    expect(patch).toContain("id: deepseek/deepseek-v4-pro")
    expect(patch).toContain("name: ZenMux · DeepSeek V4 Pro")
    expect(patch).toContain("id: deepseek/deepseek-v4-flash")
    expect(patch).toContain("name: ZenMux · DeepSeek V4 Flash")
    expect(patch).toContain("'https://zenmux.ai/api/v1'")
    expect(patch).toContain('api: anthropic-messages')
    expect(patch).toContain('zenmux-models:')
    expect(patch).toContain('api: openai-completions')
    expect(patch).toContain("id: 'google/gemini-3.7-flash'")
    expect(patch).toContain("id: 'openai/gpt-5.6-sol'")
    expect(patch.match(/^          - id:/gm)).toHaveLength(152)
    expect(patch).toContain('cacheRetention: short')
    expect(patch).toContain('high: 10240')
    expect(patch).toContain('reasoningEfforts:')
    expect(patch).not.toContain('zenmux.dev')
    expect(patch).not.toContain('proxyUrl')
  })

  it('boots through Loader + Include and publishes the human command', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-zenmux-oauth-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      '- id: session',
      "  name: '@deepseek-ai/dsh-session'",
      '- id: agent',
      "  name: '@deepseek-ai/dsh-agent'",
      '- id: commands',
      "  name: '@deepseek-ai/dsh-commands'",
      '- id: credentials',
      "  name: '@deepseek-ai/dsh-credentials-local'",
      '  config:',
      `    path: ${JSON.stringify(join(root, '.credentials.yaml'))}`,
      '    watch: false',
      '- id: zenmux',
      "  name: '@zenmux/dsh-plugins'",
      '',
    ].join('\n'))

    const ctx = new Context()
    context = ctx
    ctx.baseUrl = pathToFileURL(root).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-session', SessionStore],
      ['@deepseek-ai/dsh-agent', AgentRegistry],
      ['@deepseek-ai/dsh-commands', CommandRuntime],
      ['@deepseek-ai/dsh-credentials-local', LocalCredentialProvider],
      ['@zenmux/dsh-plugins', zenmuxOAuth],
    ])
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof ctx.loader.internal>
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await ctx.loader.await()

    const agent = stubAgent(ctx)
    ctx.agents.register(agent)
    expect(ctx.commands.list(agent)).toContainEqual({
      name: 'zenmux',
      description: 'sign in to ZenMux with OAuth PKCE or view its authentication status',
      input: { hint: '[login|status|logout]' },
    })
  })
})
