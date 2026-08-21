/**
 * ZenMux OAuth 2.0 Authorization Code + PKCE controller. A human command starts
 * one loopback login, and the controller persists and refreshes the resulting
 * token set while mirroring its access token into the credential reference used
 * by the existing OpenAI-compatible LLM adapter.
 * @module @zenmux/dsh-plugins
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { AddressInfo } from 'node:net'
import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import z from '@deepseek-ai/schemastery'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import {
  BROWSER_AUTO_OPEN_DISABLED_LINE,
  OAUTH_ORIGIN_LINE_PREFIX,
  ZENMUX_BROWSER_STATUS_PATH,
} from './shared.js'
// Side-effect type imports: declaration-merge the injected services onto Context.
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Cordis plugin name. */
export const name = 'zenmux'
/** Services required for login commands and durable token storage. */
export const inject = ['commands', 'credentials']

const PRODUCTION_OAUTH_ORIGIN = 'https://zenmux.ai'
const CALLBACK_HOST = '127.0.0.1'
const CALLBACK_PATH = '/callback'
const TOKEN_SET_VERSION = 1
const MAX_WIRE_JSON_BYTES = 64 * 1024
const DEFAULT_CLIENT_ID = 'zpc_TpZNdEix0d_c_bFrBrUzwXOp'
const DEFAULT_SCOPES = ['inference:invoke', 'offline_access']

/** Read one non-empty environment value before Cordis materializes defaults. */
function envValue(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback
}

/** Split the OAuth scope environment value on RFC-compatible ASCII whitespace. */
function envScopes(): string[] {
  const value = process.env.ZENMUX_OAUTH_SCOPES?.trim()
  return value === undefined || value.length === 0 ? DEFAULT_SCOPES : value.split(/\s+/u)
}

/** User-configurable ZenMux OAuth deployment values. */
export interface Config {
  /** ZenMux OAuth authorization-server origin. */
  oauthOrigin: string
  /** Registered ZenMux public OAuth client id. */
  clientId: string
  /** OAuth scopes requested at interactive login. */
  scopes: string[]
  /** Loopback callback port; zero asks the OS for a free port. */
  callbackPort: number
  /** Optional HTTP(S) or SOCKS proxy URL for ZenMux discovery and token traffic. */
  proxyUrl: string
  /** Whether DSH Web should automatically open the authorization URL. */
  browserAutoOpen: boolean
  /** Credential reference exposed to LLM provider profiles. */
  accessTokenRef: string
  /** Credential reference holding the complete versioned OAuth token set. */
  tokenSetRef: string
  /** How long an unfinished browser login remains valid. */
  loginTimeoutMs: number
  /** Per-request timeout for discovery, token, and revocation calls. */
  requestTimeoutMs: number
  /** Refresh this long before the access-token expiry. */
  refreshSkewMs: number
  /** Delay before retrying a failed background refresh. */
  refreshRetryMs: number
}

/** Validated Cordis configuration. */
export const Config: z<Config> = z.object({
  oauthOrigin: z.string().default(envValue('ZENMUX_OAUTH_ORIGIN', PRODUCTION_OAUTH_ORIGIN)),
  clientId: z.string().pattern(/^[A-Za-z0-9._~-]+$/u).default(envValue('ZENMUX_OAUTH_CLIENT_ID', DEFAULT_CLIENT_ID)),
  scopes: z.array(String).default(envScopes()),
  callbackPort: z.number().step(1).min(0).max(65_535).default(0),
  proxyUrl: z.string().default(''),
  browserAutoOpen: z.boolean().default(process.env.ZENMUX_OAUTH_NO_BROWSER !== '1'),
  accessTokenRef: z.string().role('credential-ref').default('ZENMUX_OAUTH_ACCESS_TOKEN'),
  tokenSetRef: z.string().role('credential-ref').default('ZENMUX_OAUTH_TOKENS'),
  loginTimeoutMs: z.number().min(1).max(MAX_TIMER_DELAY_MS).default(5 * 60_000),
  requestTimeoutMs: z.number().min(1).max(MAX_TIMER_DELAY_MS).default(30_000),
  refreshSkewMs: z.number().min(0).max(MAX_TIMER_DELAY_MS).default(60_000),
  refreshRetryMs: z.number().min(1).max(MAX_TIMER_DELAY_MS).default(30_000),
})

interface ResolvedConfig extends Omit<Config, 'accessTokenRef' | 'tokenSetRef'> {
  readonly accessTokenRef: CredentialRef
  readonly tokenSetRef: CredentialRef
}

interface OAuthMetadata {
  readonly issuer: string
  readonly authorizationEndpoint: string
  readonly tokenEndpoint: string
  readonly revocationEndpoint: string
}

interface StoredTokenSet {
  readonly version: 1
  readonly accessToken: string
  readonly refreshToken: string
  readonly tokenType: 'Bearer'
  readonly expiresAt: number
  readonly scope?: string
}

interface PendingLogin {
  readonly server: Server
  readonly state: string
  readonly verifier: string
  readonly redirectUri: string
  readonly authorizationUrl: string
  readonly timeout: NodeJS.Timeout
}

interface TokenResponse {
  readonly accessToken: string
  readonly refreshToken?: string
  readonly expiresIn: number
  readonly tokenType: 'Bearer'
  readonly scope?: string
}

/** Resolve and judge config facts that depend on more than one schema field. */
function resolveConfig(config: Config): ResolvedConfig {
  const oauthUrl = new URL(config.oauthOrigin)
  const isLoopbackHttp = oauthUrl.protocol === 'http:'
    && (oauthUrl.hostname === '127.0.0.1' || oauthUrl.hostname === 'localhost' || oauthUrl.hostname === '[::1]')
  if ((oauthUrl.protocol !== 'https:' && !isLoopbackHttp)
    || oauthUrl.pathname !== '/'
    || oauthUrl.search.length > 0
    || oauthUrl.hash.length > 0) {
    throw new Error('zenmux: oauthOrigin must be an HTTPS origin (or loopback HTTP for development)')
  }
  const accessTokenRef = credentialRef(config.accessTokenRef)
  const tokenSetRef = credentialRef(config.tokenSetRef)
  if (accessTokenRef === tokenSetRef) {
    throw new Error('zenmux: accessTokenRef and tokenSetRef must be different credential references')
  }
  const scopes = [...new Set(config.scopes)]
  if (!scopes.includes('inference:invoke')) {
    throw new Error('zenmux: scopes must include "inference:invoke"')
  }
  if (!scopes.includes('offline_access')) {
    throw new Error('zenmux: scopes must include "offline_access" so the login can refresh')
  }
  for (const scope of scopes) {
    if (!/^[\x21-\x7E]+$/u.test(scope)) {
      throw new Error(`zenmux: invalid OAuth scope ${JSON.stringify(scope)}`)
    }
  }
  return Object.freeze({
    oauthOrigin: oauthUrl.origin,
    clientId: config.clientId,
    scopes,
    callbackPort: config.callbackPort,
    proxyUrl: config.proxyUrl.trim() || process.env.HTTPS_PROXY?.trim() || process.env.https_proxy?.trim() || '',
    browserAutoOpen: config.browserAutoOpen,
    accessTokenRef,
    tokenSetRef,
    loginTimeoutMs: config.loginTimeoutMs,
    requestTimeoutMs: config.requestTimeoutMs,
    refreshSkewMs: config.refreshSkewMs,
    refreshRetryMs: config.refreshRetryMs,
  })
}

/** Response subset shared by native fetch and the SOCKS HTTP transport. */
interface OAuthHttpResponse {
  readonly ok: boolean
  readonly status: number
  text(): Promise<string>
}

interface OAuthRequestInit {
  readonly method: 'POST'
  readonly headers: Record<string, string>
  readonly body: URLSearchParams
}

/** Create the explicitly configured or environment-inherited OAuth proxy transport. */
function createProxyAgent(proxyUrl: string): HttpsProxyAgent<string> | SocksProxyAgent | undefined {
  if (proxyUrl.length === 0) return undefined
  const parsed = new URL(proxyUrl)
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    return new HttpsProxyAgent(parsed)
  }
  if (parsed.protocol === 'socks4a:' || parsed.protocol === 'socks5h:') {
    return new SocksProxyAgent(parsed)
  }
  throw new Error('zenmux: proxyUrl must use http://, https://, socks4a://, or socks5h://')
}

/** Require one non-empty string field from untrusted JSON. */
function stringField(record: Record<string, unknown>, field: string): string {
  const value = record[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`ZenMux OAuth response field "${field}" must be a non-empty string`)
  }
  return value
}

/** Parse one JSON object returned across the OAuth wire boundary. */
function parseJsonObject(text: string, subject: string): Record<string, unknown> {
  if (Buffer.byteLength(text, 'utf8') > MAX_WIRE_JSON_BYTES) {
    throw new Error(`${subject} exceeded ${MAX_WIRE_JSON_BYTES} bytes`)
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (cause) {
    throw new Error(`${subject} was not valid JSON`, { cause })
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${subject} must be a JSON object`)
  }
  return value as Record<string, unknown>
}

/** Render an OAuth error without exposing token response bodies. */
function oauthError(record: Record<string, unknown>, fallback: string): Error {
  const code = typeof record.error === 'string' ? record.error : undefined
  const description = typeof record.error_description === 'string' ? record.error_description : undefined
  return new Error([fallback, code, description].filter(value => value !== undefined).join(': '))
}

/** Validate authorization-server metadata and keep credentials on the ZenMux origin. */
function parseMetadata(record: Record<string, unknown>, expectedOrigin: string): OAuthMetadata {
  if (stringField(record, 'issuer') !== expectedOrigin) {
    throw new Error(`ZenMux OAuth metadata issuer must be ${expectedOrigin}`)
  }
  const challengeMethods = record.code_challenge_methods_supported
  if (!Array.isArray(challengeMethods) || !challengeMethods.includes('S256')) {
    throw new Error('ZenMux OAuth metadata does not advertise PKCE S256')
  }
  const grants = record.grant_types_supported
  if (!Array.isArray(grants) || !grants.includes('authorization_code') || !grants.includes('refresh_token')) {
    throw new Error('ZenMux OAuth metadata must advertise authorization_code and refresh_token grants')
  }
  const authMethods = record.token_endpoint_auth_methods_supported
  if (!Array.isArray(authMethods) || !authMethods.includes('none')) {
    throw new Error('ZenMux OAuth metadata does not allow a public client at the token endpoint')
  }
  const sameOriginEndpoint = (field: string): string => {
    const value = stringField(record, field)
    const url = new URL(value)
    if (url.origin !== expectedOrigin) {
      throw new Error(`ZenMux OAuth metadata field "${field}" must use the ${expectedOrigin} origin`)
    }
    return url.href
  }
  return Object.freeze({
    issuer: expectedOrigin,
    authorizationEndpoint: sameOriginEndpoint('authorization_endpoint'),
    tokenEndpoint: sameOriginEndpoint('token_endpoint'),
    revocationEndpoint: sameOriginEndpoint('revocation_endpoint'),
  })
}

/** Validate a token endpoint success response. */
function parseTokenResponse(record: Record<string, unknown>): TokenResponse {
  const accessToken = stringField(record, 'access_token')
  const refreshToken = record.refresh_token
  if (refreshToken !== undefined && (typeof refreshToken !== 'string' || refreshToken.length === 0)) {
    throw new Error('ZenMux OAuth response field "refresh_token" must be a non-empty string when present')
  }
  const expiresIn = record.expires_in
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('ZenMux OAuth response field "expires_in" must be a positive number')
  }
  const tokenType = stringField(record, 'token_type')
  if (tokenType.toLowerCase() !== 'bearer') {
    throw new Error('ZenMux OAuth response token_type must be Bearer')
  }
  const scope = record.scope
  if (scope !== undefined && typeof scope !== 'string') {
    throw new Error('ZenMux OAuth response field "scope" must be a string when present')
  }
  return Object.freeze({
    accessToken,
    ...refreshToken === undefined ? {} : { refreshToken },
    expiresIn,
    tokenType: 'Bearer',
    ...scope === undefined ? {} : { scope },
  })
}

/** Parse the private versioned token-set credential. */
function parseStoredTokenSet(raw: string): StoredTokenSet {
  const record = parseJsonObject(raw, 'stored ZenMux OAuth token set')
  if (record.version !== TOKEN_SET_VERSION) {
    throw new Error(`stored ZenMux OAuth token set has unsupported version ${String(record.version)}`)
  }
  const expiresAt = record.expiresAt
  if (!Number.isSafeInteger(expiresAt) || (expiresAt as number) <= 0) {
    throw new Error('stored ZenMux OAuth token set expiresAt must be a positive safe integer')
  }
  const tokenType = stringField(record, 'tokenType')
  if (tokenType !== 'Bearer') throw new Error('stored ZenMux OAuth token set tokenType must be Bearer')
  const scope = record.scope
  if (scope !== undefined && typeof scope !== 'string') {
    throw new Error('stored ZenMux OAuth token set scope must be a string when present')
  }
  return Object.freeze({
    version: TOKEN_SET_VERSION,
    accessToken: stringField(record, 'accessToken'),
    refreshToken: stringField(record, 'refreshToken'),
    tokenType: 'Bearer',
    expiresAt: expiresAt as number,
    ...scope === undefined ? {} : { scope },
  })
}

/** Constant-time comparison for a browser callback's untrusted state value. */
function statesMatch(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected)
  const receivedBytes = Buffer.from(received)
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes)
}

/** Generate one RFC 7636 verifier or callback state value. */
function randomBase64Url(bytes: number): string {
  return randomBytes(bytes).toString('base64url')
}

/** Derive an RFC 7636 S256 challenge. */
function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url')
}

/** Send a minimal callback page whose content never includes credentials or provider errors. */
function callbackPage(response: ServerResponse, status: number, title: string, message: string): void {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(`<!doctype html><meta charset="utf-8"><title>${title}</title><style>body{font:16px system-ui;max-width:42rem;margin:4rem auto;padding:0 1rem}h1{font-size:1.5rem}</style><h1>${title}</h1><p>${message}</p>`)
}

/** One plugin instance's login, persistence, refresh, and disposal lifecycle. */
class ZenMuxOAuthController {
  private readonly lifetime = new AbortController()
  private readonly proxyAgent: HttpsProxyAgent<string> | SocksProxyAgent | undefined
  private metadataValue: OAuthMetadata | undefined
  private pending: PendingLogin | undefined
  private refreshTimer: NodeJS.Timeout | undefined
  private queueTail: Promise<void> = Promise.resolve()
  private tokenSet: StoredTokenSet | undefined

  /** @param ctx - injected command and credential services. @param config - resolved deployment values. */
  constructor(private readonly ctx: Context, private readonly config: ResolvedConfig) {
    this.proxyAgent = createProxyAgent(config.proxyUrl)
  }

  /** Restore stored state, repair its access-token mirror, and begin refresh scheduling. */
  async start(): Promise<void> {
    const hit = await this.ctx.credentials.resolve(this.config.tokenSetRef)
    if (hit === undefined) return
    this.tokenSet = parseStoredTokenSet(hit.value)
    await this.repairMirror(this.tokenSet)
    this.scheduleRefresh(this.tokenSet)
  }

  /** Execute `/zenmux` without placing OAuth material in the session log. */
  async command(rawInput: string): Promise<{ kind: 'success' | 'error'; text: string }> {
    const input = rawInput.trim()
    if (input === '' || input === 'status') return { kind: 'success', text: await this.status() }
    if (input === 'login') {
      try {
        const url = await this.beginLogin()
        return {
          kind: 'success',
          text: [
            'Open this URL to sign in to ZenMux:',
            `${OAUTH_ORIGIN_LINE_PREFIX}${this.config.oauthOrigin}`,
            url,
            '',
            'Then run /zenmux status after the browser reports success.',
            ...this.config.browserAutoOpen ? [] : [BROWSER_AUTO_OPEN_DISABLED_LINE],
          ].join('\n'),
        }
      } catch (error) {
        return { kind: 'error', text: error instanceof Error ? error.message : 'ZenMux OAuth login failed.' }
      }
    }
    if (input === 'logout') {
      try {
        const warning = await this.enqueue(() => this.logout())
        return { kind: 'success', text: warning ?? 'ZenMux OAuth credentials removed.' }
      } catch (error) {
        return { kind: 'error', text: error instanceof Error ? error.message : 'ZenMux OAuth logout failed.' }
      }
    }
    return { kind: 'error', text: 'Usage: /zenmux [login|status|logout]' }
  }

  /** Stop admission, close the loopback listener, abort I/O, and await token mutations. */
  async dispose(): Promise<void> {
    this.lifetime.abort(new Error('zenmux disposed'))
    if (this.refreshTimer !== undefined) clearTimeout(this.refreshTimer)
    this.refreshTimer = undefined
    await this.stopPending()
    await this.queueTail
  }

  /** Current human-readable state without exposing token values. */
  private async status(): Promise<string> {
    await this.refreshForStatus()
    const tokenSet = this.tokenSet
    if (tokenSet !== undefined) {
      const expires = new Date(tokenSet.expiresAt).toISOString()
      return `ZenMux OAuth is connected. Access token expiry: ${expires}.`
    }
    const manual = await this.ctx.credentials.resolve(this.config.accessTokenRef)
    if (manual !== undefined) {
      return `No ZenMux OAuth session is stored. ${this.config.accessTokenRef} is configured separately.`
    }
    return 'ZenMux is not connected. Run /zenmux login.'
  }

  /** Refresh a stale token before reporting browser-visible connection state. */
  private async refreshForStatus(): Promise<void> {
    const tokenSet = this.tokenSet
    if (tokenSet === undefined || tokenSet.expiresAt - Date.now() > this.config.refreshSkewMs) return
    try {
      await this.enqueue(async () => {
        const current = this.tokenSet
        if (current !== undefined && current.expiresAt - Date.now() <= this.config.refreshSkewMs) {
          await this.refresh()
        }
      })
    } catch (error) {
      this.ctx.logger.warn(
        'zenmux: token refresh on status failed: %s',
        error instanceof Error ? error.message : String(error),
      )
      this.scheduleRefreshRetry()
    }
  }

  /** Read the OAuth state for the DSH Web card without recording another command. */
  async browserStatus(): Promise<{ connected: boolean; detail: string }> {
    return {
      connected: this.tokenSet !== undefined,
      detail: await this.status(),
    }
  }

  /** Start or reuse one pending loopback login and return its browser URL. */
  private async beginLogin(): Promise<string> {
    if (this.pending !== undefined) return this.pending.authorizationUrl
    const metadata = await this.metadata()
    const verifier = randomBase64Url(32)
    const state = randomBase64Url(32)
    const server = createServer((request, response) => {
      void this.handleCallback(request, response).catch(() => {
        this.ctx.logger.warn('zenmux: loopback callback handler failed')
        if (response.headersSent) response.destroy()
        else callbackPage(response, 500, 'ZenMux login failed', 'The local callback failed. Return to DeepSeek Harness and try again.')
      })
    })
    server.on('clientError', (_error, socket) => {
      socket.destroy()
    })
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        reject(error)
      }
      server.once('error', onError)
      server.listen(this.config.callbackPort, CALLBACK_HOST, () => {
        server.off('error', onError)
        resolve()
      })
    })
    const address = server.address() as AddressInfo | null
    if (address === null) {
      await new Promise<void>(resolve => server.close(() => {
        resolve()
      }))
      throw new Error('zenmux: loopback callback server did not publish an address')
    }
    const redirectUri = `http://${CALLBACK_HOST}:${address.port}${CALLBACK_PATH}`
    const authorization = new URL(metadata.authorizationEndpoint)
    authorization.searchParams.set('response_type', 'code')
    authorization.searchParams.set('client_id', this.config.clientId)
    authorization.searchParams.set('redirect_uri', redirectUri)
    authorization.searchParams.set('scope', this.config.scopes.join(' '))
    authorization.searchParams.set('state', state)
    authorization.searchParams.set('code_challenge', pkceChallenge(verifier))
    authorization.searchParams.set('code_challenge_method', 'S256')
    const timeout = setTimeout(() => {
      if (this.pending?.server !== server) return
      this.pending = undefined
      server.close()
    }, this.config.loginTimeoutMs)
    timeout.unref()
    this.pending = {
      server,
      state,
      verifier,
      redirectUri,
      authorizationUrl: authorization.href,
      timeout,
    }
    return authorization.href
  }

  /** Accept exactly one valid callback and exchange it through the serialized token writer. */
  private async handleCallback(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const pending = this.pending
    if (pending === undefined) {
      callbackPage(response, 410, 'ZenMux login expired', 'Return to DeepSeek Harness and start a new login.')
      return
    }
    const url = new URL(request.url ?? '/', pending.redirectUri)
    if (request.method !== 'GET' || url.pathname !== CALLBACK_PATH) {
      callbackPage(response, 404, 'Not found', 'This loopback listener accepts only the ZenMux OAuth callback.')
      return
    }
    const state = url.searchParams.get('state')
    if (state === null || !statesMatch(pending.state, state)) {
      callbackPage(response, 400, 'ZenMux login rejected', 'The OAuth state value did not match. Start a new login from DeepSeek Harness.')
      return
    }
    const providerError = url.searchParams.get('error')
    const code = url.searchParams.get('code')
    this.pending = undefined
    clearTimeout(pending.timeout)
    pending.server.close()
    if (providerError !== null) {
      callbackPage(response, 400, 'ZenMux login denied', 'Authorization was not completed. You may close this tab.')
      return
    }
    if (code === null || code.length === 0) {
      callbackPage(response, 400, 'ZenMux login rejected', 'The authorization response did not contain a code.')
      return
    }
    try {
      await this.enqueue(async () => {
        const token = await this.exchangeCode(code, pending)
        if (token.refreshToken === undefined) {
          throw new Error('ZenMux OAuth login did not return a refresh token for the offline_access scope')
        }
        await this.commitTokenResponse(token, token.refreshToken)
      })
      callbackPage(response, 200, 'ZenMux connected', 'Login succeeded. You may close this tab and return to DeepSeek Harness.')
    } catch {
      this.ctx.logger.warn('zenmux: authorization-code exchange failed')
      callbackPage(response, 502, 'ZenMux login failed', 'The authorization code could not be exchanged. Return to DeepSeek Harness and try again.')
    }
  }

  /** Fetch and cache validated ZenMux authorization-server metadata. */
  private async metadata(): Promise<OAuthMetadata> {
    if (this.metadataValue !== undefined) return this.metadataValue
    const response = await this.fetch(`${this.config.oauthOrigin}/.well-known/oauth-authorization-server`)
    const record = parseJsonObject(await response.text(), 'ZenMux OAuth metadata')
    if (!response.ok) throw oauthError(record, `ZenMux OAuth metadata request failed with HTTP ${response.status}`)
    this.metadataValue = parseMetadata(record, this.config.oauthOrigin)
    return this.metadataValue
  }

  /** Exchange an authorization code with its exact loopback URI and verifier. */
  private async exchangeCode(code: string, pending: PendingLogin): Promise<TokenResponse> {
    const metadata = await this.metadata()
    return this.tokenRequest(metadata.tokenEndpoint, new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      code,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier,
    }))
  }

  /** Refresh the current token set, preserving a non-rotated refresh token. */
  private async refresh(): Promise<void> {
    const current = this.tokenSet
    if (current === undefined) return
    const metadata = await this.metadata()
    const token = await this.tokenRequest(metadata.tokenEndpoint, new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      refresh_token: current.refreshToken,
    }))
    await this.commitTokenResponse(token, token.refreshToken ?? current.refreshToken)
  }

  /** Execute one form-encoded token request and validate its JSON response. */
  private async tokenRequest(endpoint: string, body: URLSearchParams): Promise<TokenResponse> {
    const response = await this.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const record = parseJsonObject(await response.text(), 'ZenMux OAuth token response')
    if (!response.ok) throw oauthError(record, `ZenMux OAuth token request failed with HTTP ${response.status}`)
    return parseTokenResponse(record)
  }

  /** Commit the recoverable token set first, then its raw LLM credential mirror. */
  private async commitTokenResponse(token: TokenResponse, refreshToken: string): Promise<void> {
    const expiresAt = Math.round(Date.now() + token.expiresIn * 1000)
    const next: StoredTokenSet = Object.freeze({
      version: TOKEN_SET_VERSION,
      accessToken: token.accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresAt,
      ...token.scope === undefined ? {} : { scope: token.scope },
    })
    await this.ctx.credentials.set(this.config.tokenSetRef, JSON.stringify(next))
    this.tokenSet = next
    await this.ctx.credentials.set(this.config.accessTokenRef, next.accessToken)
    this.scheduleRefresh(next)
  }

  /** Repair a crash between token-set commit and access-token mirror commit. */
  private async repairMirror(tokenSet: StoredTokenSet): Promise<void> {
    const mirror = await this.ctx.credentials.resolve(this.config.accessTokenRef)
    if (mirror?.value === tokenSet.accessToken) return
    await this.ctx.credentials.set(this.config.accessTokenRef, tokenSet.accessToken)
  }

  /** Schedule early refresh or a bounded-delay timer for expiries beyond Node's timer range. */
  private scheduleRefresh(tokenSet: StoredTokenSet): void {
    if (this.refreshTimer !== undefined) clearTimeout(this.refreshTimer)
    const desiredDelay = Math.max(0, tokenSet.expiresAt - Date.now() - this.config.refreshSkewMs)
    const delay = Math.min(desiredDelay, MAX_TIMER_DELAY_MS)
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined
      if (desiredDelay > MAX_TIMER_DELAY_MS) {
        this.scheduleRefresh(tokenSet)
        return
      }
      void this.enqueue(() => this.refresh()).catch(() => {
        this.scheduleRefreshRetry()
      })
    }, delay)
    this.refreshTimer.unref()
  }

  /** Retry a failed refresh until success, logout, or plugin disposal. */
  private scheduleRefreshRetry(): void {
    if (this.lifetime.signal.aborted || this.tokenSet === undefined) return
    this.ctx.logger.warn('zenmux: background token refresh failed; retrying in %d ms', this.config.refreshRetryMs)
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined
      void this.enqueue(() => this.refresh()).catch(() => {
        this.scheduleRefreshRetry()
      })
    }, this.config.refreshRetryMs)
    this.refreshTimer.unref()
  }

  /** Revoke remotely when possible, then remove only this plugin's local mirror. */
  private async logout(): Promise<string | undefined> {
    await this.stopPending()
    const current = this.tokenSet
    let warning: string | undefined
    if (current !== undefined) {
      try {
        const metadata = await this.metadata()
        const response = await this.fetch(metadata.revocationEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: this.config.clientId,
            token: current.refreshToken,
            token_type_hint: 'refresh_token',
          }),
        })
        if (!response.ok) warning = `ZenMux OAuth credentials removed locally; remote revocation returned HTTP ${response.status}.`
      } catch {
        warning = 'ZenMux OAuth credentials removed locally; remote revocation could not be confirmed.'
      }
      const mirror = await this.ctx.credentials.resolve(this.config.accessTokenRef)
      if (mirror?.value === current.accessToken) await this.ctx.credentials.unset(this.config.accessTokenRef)
    }
    await this.ctx.credentials.unset(this.config.tokenSetRef)
    this.tokenSet = undefined
    if (this.refreshTimer !== undefined) clearTimeout(this.refreshTimer)
    this.refreshTimer = undefined
    return warning
  }

  /** Stop a pending listener and wait until its socket is no longer accepting callbacks. */
  private async stopPending(): Promise<void> {
    const pending = this.pending
    if (pending === undefined) return
    this.pending = undefined
    clearTimeout(pending.timeout)
    await new Promise<void>(resolve => pending.server.close(() => {
      resolve()
    }))
  }

  /** Serialize token mutations while keeping the queue usable after one failure. */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queueTail.then(operation)
    this.queueTail = run.then(() => {}, () => {})
    return run
  }

  /** Fetch under both the plugin lifetime and a per-request timeout. */
  private fetch(input: string, init?: OAuthRequestInit): Promise<OAuthHttpResponse> {
    const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(this.config.requestTimeoutMs)])
    if (this.proxyAgent === undefined) return fetch(input, { ...init, signal })
    return new Promise((resolve, reject) => {
      const request = httpsRequest(input, {
        method: init?.method ?? 'GET',
        headers: init?.headers,
        agent: this.proxyAgent,
        signal,
      }, (response) => {
        response.setEncoding('utf8')
        const chunks: string[] = []
        let bytes = 0
        response.on('data', (chunk: string) => {
          bytes += Buffer.byteLength(chunk, 'utf8')
          if (bytes > MAX_WIRE_JSON_BYTES) {
            response.destroy(new Error(`ZenMux OAuth response exceeded ${MAX_WIRE_JSON_BYTES} bytes`))
            return
          }
          chunks.push(chunk)
        })
        response.once('error', reject)
        response.once('end', () => {
          const status = response.statusCode ?? 0
          const text = chunks.join('')
          resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(text) })
        })
      })
      request.once('error', reject)
      if (init !== undefined) request.write(init.body.toString())
      request.end()
    })
  }
}

/**
 * Mount the ZenMux OAuth controller and `/zenmux` human command.
 * @param ctx - context carrying commands and writable credentials.
 * @param config - validated OAuth deployment configuration.
 * @returns startup after stored credentials are repaired and refresh is scheduled.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const controller = new ZenMuxOAuthController(ctx, resolveConfig(config))
  await controller.start()
  ctx.effect(() => () => controller.dispose(), 'zenmux.lifecycle')
  ctx.inject(['webServer'], (httpCtx) => {
    httpCtx.effect(() => httpCtx.webServer.register({
      kind: 'exact',
      path: ZENMUX_BROWSER_STATUS_PATH,
      handler: async (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { Allow: 'GET' })
          response.end()
          return
        }
        const body = JSON.stringify(await controller.browserStatus())
        response.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        response.end(body)
      },
    }), 'zenmux: browser OAuth status')
  })
  ctx.commands.register({
    name: 'zenmux',
    description: 'sign in to ZenMux with OAuth PKCE or view its authentication status',
    input: { hint: '[login|status|logout]' },
    handler: invocation => controller.command(invocation.rawInput),
  })
}
