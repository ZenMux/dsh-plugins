import { mkdtemp, rm } from 'node:fs/promises'
import { get } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent, AgentStatus } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import LocalCredentialProvider from '@deepseek-ai/dsh-credentials-local'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import * as zenmuxOAuth from '@zenmux/dsh-plugins'
import { BROWSER_AUTO_OPEN_DISABLED_LINE } from '../src/shared.ts'

const ACCESS_REF = credentialRef('DSH_TEST_ZENMUX_OAUTH_ACCESS')
const TOKENS_REF = credentialRef('DSH_TEST_ZENMUX_OAUTH_TOKENS')
const METADATA = {
  issuer: 'https://zenmux.ai',
  authorization_endpoint: 'https://zenmux.ai/oauth/authorize',
  token_endpoint: 'https://zenmux.ai/oauth/token',
  revocation_endpoint: 'https://zenmux.ai/oauth/revoke',
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
}

let root: string | undefined
let context: Context | undefined

beforeEach(() => {
  vi.stubEnv('HTTPS_PROXY', '')
  vi.stubEnv('https_proxy', '')
})

afterEach(async () => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** Build one live idle agent accepted by command dispatch. */
function stubAgent(ctx: Context, id: string): Agent {
  const session = ctx.sessions.create(SessionId(id))
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

interface Harness {
  readonly ctx: Context
  readonly agent: Agent
  readonly plugin: Awaited<ReturnType<Context['plugin']>>
}

/** Mount the real command, credential, session, and OAuth plugins. */
async function harness(
  beforeOAuth?: (ctx: Context) => Promise<void>,
  proxyUrl = '',
  overrides: Partial<zenmuxOAuth.Config> = {},
): Promise<Harness> {
  root = await mkdtemp(join(tmpdir(), 'dsh-zenmux-oauth-'))
  const ctx = new Context()
  context = ctx
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(LocalCredentialProvider, { path: join(root, '.credentials.yaml'), watch: false })
  await beforeOAuth?.(ctx)
  const plugin = await ctx.plugin(zenmuxOAuth, {
    clientId: 'zpc_TpZNdEix0d_c_bFrBrUzwXOp',
    scopes: ['inference:invoke', 'offline_access'],
    callbackPort: 0,
    proxyUrl,
    accessTokenRef: ACCESS_REF,
    tokenSetRef: TOKENS_REF,
    loginTimeoutMs: 5_000,
    requestTimeoutMs: 5_000,
    refreshSkewMs: 1_000,
    refreshRetryMs: 10,
    ...overrides,
  })
  const agent = stubAgent(ctx, `zenmux-oauth-${Math.random()}`)
  ctx.agents.register(agent)
  return { ctx, agent, plugin }
}

/** Execute the command through the same registry boundary as the Web adapter. */
async function run(test: Harness, input = ''): Promise<{ kind: string; text?: string }> {
  const result = await test.ctx.commands.execute(
    test.agent,
    `/zenmux${input}`,
    new AbortController().signal,
  )
  if (result === undefined) throw new Error('zenmux command was not registered')
  return result.result
}

/** Perform a loopback GET without using the mocked global fetch. */
function callback(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      const chunks: string[] = []
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        chunks.push(chunk)
      })
      response.on('end', () => {
        resolve({ status: response.statusCode ?? 0, body: chunks.join('') })
      })
    }).once('error', reject)
  })
}

/** Return OAuth metadata, token responses, and revocation through one fetch mock. */
function mockOAuth(
  tokenResponses: Array<Record<string, unknown>>,
  metadata: Record<string, unknown> = METADATA,
): URLSearchParams[] {
  const responses = [...tokenResponses]
  const tokenRequests: URLSearchParams[] = []
  const mocked = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.endsWith('/.well-known/oauth-authorization-server')) {
      return new Response(JSON.stringify(metadata), { status: 200 })
    }
    if (url.endsWith('/oauth/token')) {
      if (!(init?.body instanceof URLSearchParams)) throw new Error('token request body was not URLSearchParams')
      tokenRequests.push(init.body)
      const next = responses.shift()
      if (next === undefined) throw new Error('unexpected token request')
      return new Response(JSON.stringify(next), { status: 200 })
    }
    if (url.endsWith('/oauth/revoke')) return new Response('', { status: 200 })
    throw new Error(`unexpected OAuth request ${url} ${String(init?.method)}`)
  })
  vi.stubGlobal('fetch', mocked)
  return tokenRequests
}

/** Extract the single authorization URL from the login command result. */
function loginUrl(result: { text?: string }): URL {
  const line = result.text?.split('\n').find(value => value.startsWith('https://'))
  if (line === undefined) throw new Error('login result did not contain an authorization URL')
  return new URL(line)
}

describe('ZenMux plugin registration', () => {
  it('registers a Loader-safe command and disposes it', async () => {
    const test = await harness()
    expect(zenmuxOAuth.name).toBe('zenmux')
    expect(zenmuxOAuth.inject).toEqual(['commands', 'credentials'])
    expect('default' in zenmuxOAuth).toBe(false)
    expect(test.ctx.commands.list(test.agent)).toContainEqual({
      name: 'zenmux',
      description: 'sign in to ZenMux with OAuth PKCE or view its authentication status',
      input: { hint: '[login|status|logout]' },
    })

    await test.plugin.dispose()
    expect(test.ctx.commands.find(test.agent, 'zenmux')).toBeUndefined()
  })

  it('requires remote DNS resolution for an explicit SOCKS route', async () => {
    await expect(harness(undefined, 'socks5://proxy.example.test:9999')).rejects.toThrow(
      'proxyUrl must use http://, https://, socks4a://, or socks5h://',
    )
  })

  it('inherits HTTPS_PROXY when proxyUrl is empty', async () => {
    vi.stubEnv('HTTPS_PROXY', 'ftp://proxy.example.test')
    await expect(harness()).rejects.toThrow(
      'proxyUrl must use http://, https://, socks4a://, or socks5h://',
    )
  })

  it('rejects a non-HTTPS non-loopback OAuth origin', async () => {
    await expect(harness(undefined, '', { oauthOrigin: 'http://auth.example.test' })).rejects.toThrow(
      'oauthOrigin must be an HTTPS origin',
    )
  })
})

describe('/zenmux OAuth PKCE lifecycle', () => {
  it('uses a configured OAuth origin and can suppress browser auto-open', async () => {
    const origin = 'https://auth.example.test'
    mockOAuth([], {
      ...METADATA,
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      revocation_endpoint: `${origin}/oauth/revoke`,
    })
    const test = await harness(undefined, '', { oauthOrigin: origin, browserAutoOpen: false })
    const login = await run(test, ' login')
    expect(login.kind).toBe('success')
    expect(loginUrl(login).origin).toBe(origin)
    expect(login.text).toContain(`ZenMux OAuth origin: ${origin}`)
    expect(login.text).toContain(BROWSER_AUTO_OPEN_DISABLED_LINE)
  })

  it('logs in through one validated loopback callback and stores a recoverable token set', async () => {
    const tokenRequests = mockOAuth([{
      access_token: 'access-one',
      refresh_token: 'refresh-one',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'inference:invoke offline_access',
    }])
    const test = await harness(async (ctx) => {
      await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
    })
    const login = await run(test, ' login')
    expect(login.kind).toBe('success')
    const authorization = loginUrl(login)
    expect(authorization.origin + authorization.pathname).toBe('https://zenmux.ai/oauth/authorize')
    expect(authorization.searchParams.get('client_id')).toBe('zpc_TpZNdEix0d_c_bFrBrUzwXOp')
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authorization.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/u)
    const redirect = new URL(authorization.searchParams.get('redirect_uri') ?? '')
    expect(redirect.hostname).toBe('127.0.0.1')
    expect(redirect.pathname).toBe('/callback')

    const invalid = new URL(redirect)
    invalid.searchParams.set('code', 'ignored')
    invalid.searchParams.set('state', 'wrong')
    await expect(callback(invalid.href)).resolves.toMatchObject({ status: 400 })
    expect(await test.ctx.credentials.resolve(TOKENS_REF)).toBeUndefined()

    const accepted = new URL(redirect)
    accepted.searchParams.set('code', 'authorization-code')
    accepted.searchParams.set('state', authorization.searchParams.get('state') ?? '')
    const page = await callback(accepted.href)
    expect(page.status).toBe(200)
    expect(page.body).toContain('ZenMux connected')
    expect(await test.ctx.credentials.resolve(ACCESS_REF)).toEqual({ value: 'access-one', source: 'file' })
    const stored = await test.ctx.credentials.resolve(TOKENS_REF)
    expect(stored?.source).toBe('file')
    expect(JSON.parse(stored?.value ?? '{}')).toMatchObject({
      version: 1,
      accessToken: 'access-one',
      refreshToken: 'refresh-one',
      tokenType: 'Bearer',
    })
    const status = await run(test, ' status')
    expect(status.kind).toBe('success')
    expect(status.text).toContain('is connected')
    const browserStatus = await callback(`http://127.0.0.1:${test.ctx.webServer.port}/zenmux/oauth/status`)
    expect(browserStatus.status).toBe(200)
    expect(JSON.parse(browserStatus.body)).toMatchObject({
      connected: true,
      detail: expect.stringContaining('is connected'),
    })

    const body = tokenRequests[0]
    expect(body?.get('grant_type')).toBe('authorization_code')
    expect(body?.get('code_verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/u)
    expect(body?.get('redirect_uri')).toBe(redirect.href)
  })

  it('repairs an interrupted mirror commit and refreshes an expired token after restart', async () => {
    mockOAuth([{
      access_token: 'access-new',
      refresh_token: 'refresh-new',
      expires_in: 3600,
      token_type: 'bearer',
    }])
    const expired = JSON.stringify({
      version: 1,
      accessToken: 'access-old',
      refreshToken: 'refresh-old',
      tokenType: 'Bearer',
      expiresAt: Date.now() - 1,
    })
    const test = await harness(async (ctx) => {
      await ctx.credentials.set(TOKENS_REF, expired)
      await ctx.credentials.set(ACCESS_REF, 'interrupted-mirror')
    })
    await vi.waitFor(async () => {
      expect(await test.ctx.credentials.resolve(ACCESS_REF)).toEqual({ value: 'access-new', source: 'file' })
    })
    const stored = await test.ctx.credentials.resolve(TOKENS_REF)
    expect(JSON.parse(stored?.value ?? '{}')).toMatchObject({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
    })
  })

  it('refreshes an expired token before returning browser status after wake', async () => {
    const tokenRequests = mockOAuth([{
      access_token: 'access-after-wake',
      refresh_token: 'refresh-after-wake',
      expires_in: 3600,
      token_type: 'Bearer',
    }])
    const expired = JSON.stringify({
      version: 1,
      accessToken: 'access-before-sleep',
      refreshToken: 'refresh-before-sleep',
      tokenType: 'Bearer',
      expiresAt: Date.now() - 1,
    })
    const test = await harness(async (ctx) => {
      await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
      await ctx.credentials.set(TOKENS_REF, expired)
      await ctx.credentials.set(ACCESS_REF, 'access-before-sleep')
    }, '', { refreshRetryMs: 60_000 })

    const browserStatus = await callback(`http://127.0.0.1:${test.ctx.webServer.port}/zenmux/oauth/status`)
    expect(browserStatus.status).toBe(200)
    expect(JSON.parse(browserStatus.body)).toMatchObject({
      connected: true,
      detail: expect.stringContaining('is connected'),
    })
    expect(tokenRequests).toHaveLength(1)
    expect(await test.ctx.credentials.resolve(ACCESS_REF)).toEqual({
      value: 'access-after-wake',
      source: 'file',
    })
  })

  it('logs out without deleting an unrelated manually replaced API key', async () => {
    mockOAuth([])
    const stored = JSON.stringify({
      version: 1,
      accessToken: 'oauth-access',
      refreshToken: 'oauth-refresh',
      tokenType: 'Bearer',
      expiresAt: Date.now() + 3_600_000,
    })
    const test = await harness(async (ctx) => {
      await ctx.credentials.set(TOKENS_REF, stored)
      await ctx.credentials.set(ACCESS_REF, 'oauth-access')
    })
    await test.ctx.credentials.set(ACCESS_REF, 'manual-replacement')
    await expect(run(test, ' logout')).resolves.toEqual({ kind: 'success', text: 'ZenMux OAuth credentials removed.' })
    expect(await test.ctx.credentials.resolve(TOKENS_REF)).toBeUndefined()
    expect(await test.ctx.credentials.resolve(ACCESS_REF)).toEqual({ value: 'manual-replacement', source: 'file' })
  })
})
