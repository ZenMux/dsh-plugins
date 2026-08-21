/** ZenMux browser integration for the DSH Web command surface. */
import { createElement, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { CommandResult } from '@deepseek-ai/dsh-commands/types'
import type { CommandRowProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { installSearchableModelSelect } from './model-search-client.js'
import {
  BROWSER_AUTO_OPEN_DISABLED_LINE,
  OAUTH_ORIGIN_LINE_PREFIX,
  ZENMUX_BROWSER_STATUS_PATH,
} from './shared.js'

/** Client plugin name. */
export const name = 'zenmux-client'
/** Services required for command acknowledgements and command-row registration. */
export const inject = ['slots', 'commandUi', 'modelDirectories', 'sessions']

const AUTHORIZE_PATH = '/oauth/authorize'
const STATUS_POLL_INTERVAL_MS = 1_000
const STATUS_POLL_LIMIT = 300
export { BROWSER_AUTO_OPEN_DISABLED_LINE } from './shared.js'

/** Public, credential-free OAuth state returned by the host browser route. */
export interface ZenMuxBrowserStatus {
  readonly connected: boolean
  readonly detail: string
}

/** Accept production/custom HTTPS authorization servers and loopback HTTP development servers. */
function isAllowedAuthorizationUrl(url: URL, expectedOrigin: string): boolean {
  const isLoopbackHttp = url.protocol === 'http:'
    && (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]')
  return (url.protocol === 'https:' || isLoopbackHttp)
    && url.origin === expectedOrigin
    && url.pathname === AUTHORIZE_PATH
}

const cardStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-secondary, rgba(127, 127, 127, 0.28))',
  borderRadius: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '12px 14px',
}

const headerStyle: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  fontSize: 13,
  fontWeight: 600,
  justifyContent: 'space-between',
}

const detailStyle: CSSProperties = {
  color: 'var(--dsw-alias-text-secondary, #888)',
  fontSize: 12,
  lineHeight: 1.5,
  margin: 0,
  whiteSpace: 'pre-wrap',
}

const buttonStyle: CSSProperties = {
  alignSelf: 'flex-start',
  background: 'var(--dsw-alias-accent-primary, #4f6ef7)',
  borderRadius: 8,
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  padding: '7px 12px',
  textDecoration: 'none',
}

/** Return a validated ZenMux authorization URL embedded in a command result. */
export function authorizationUrlFromText(text: string | undefined): string | undefined {
  if (text === undefined) return undefined
  const lines = text.split(/\r?\n/u)
  const expectedOrigin = lines
    .find(line => line.startsWith(OAUTH_ORIGIN_LINE_PREFIX))
    ?.slice(OAUTH_ORIGIN_LINE_PREFIX.length)
  if (expectedOrigin === undefined) return undefined
  for (const line of lines) {
    if (!line.startsWith('https://') && !line.startsWith('http://')) continue
    try {
      const url = new URL(line)
      if (isAllowedAuthorizationUrl(url, expectedOrigin)) return url.href
    } catch {
      // Ignore non-URL result lines and keep looking for the authorization URL.
    }
  }
  return undefined
}

/** Extract a safe authorization URL only from a successful command result. */
export function authorizationUrlFromResult(result: CommandResult): string | undefined {
  return result.kind === 'success' && !result.text?.split(/\r?\n/u).includes(BROWSER_AUTO_OPEN_DISABLED_LINE)
    ? authorizationUrlFromText(result.text)
    : undefined
}

/** Open authorization in a separate, opener-isolated browser tab. */
export function openAuthorizationWindow(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Read and validate the host's credential-free OAuth state response. */
export async function fetchZenMuxBrowserStatus(signal?: AbortSignal): Promise<ZenMuxBrowserStatus | undefined> {
  const response = await fetch(ZENMUX_BROWSER_STATUS_PATH, {
    headers: { Accept: 'application/json' },
    ...signal === undefined ? {} : { signal },
  })
  if (!response.ok) return undefined
  const value: unknown = await response.json()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const connected = Reflect.get(value, 'connected')
  const detail = Reflect.get(value, 'detail')
  if (typeof connected !== 'boolean' || typeof detail !== 'string') return undefined
  return { connected, detail }
}

/** Poll only while a login card is waiting, and stop as soon as it becomes connected. */
function useZenMuxBrowserStatus(authorizationUrl: string | undefined): ZenMuxBrowserStatus | undefined {
  const [status, setStatus] = useState<ZenMuxBrowserStatus>()
  useEffect(() => {
    setStatus(undefined)
    if (authorizationUrl === undefined) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const poll = async (): Promise<void> => {
      attempts += 1
      try {
        const next = await fetchZenMuxBrowserStatus(controller.signal)
        if (controller.signal.aborted) return
        if (next !== undefined) {
          setStatus(next)
          if (next.connected) return
        }
      } catch {
        if (controller.signal.aborted) return
      }
      if (attempts < STATUS_POLL_LIMIT) timer = setTimeout(() => void poll(), STATUS_POLL_INTERVAL_MS)
    }
    void poll()
    return () => {
      controller.abort()
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [authorizationUrl])
  return status
}

/** ZenMux-specific durable command row with a popup-blocker-safe link fallback. */
function ZenMuxCommandCard({ node }: CommandRowProps): ReactNode {
  const outcome = node.outcome
  const url = authorizationUrlFromText(outcome?.text)
  const browserStatus = useZenMuxBrowserStatus(url)
  const connected = browserStatus?.connected === true
  const state = outcome === null
    ? '正在准备登录…'
    : outcome.kind === 'error'
      ? '执行失败'
      : connected
        ? '已连接'
        : url === undefined ? '已完成' : '等待浏览器授权'
  const detail = outcome?.kind === 'error'
    ? outcome.text ?? 'ZenMux 命令执行失败。'
    : connected
      ? browserStatus.detail
      : url === undefined ? outcome?.text : '如果授权窗口没有自动打开，请点击下面的按钮。'

  return createElement('section', { style: cardStyle, 'data-zenmux-command': true },
    createElement('div', { style: headerStyle },
      createElement('span', null, 'ZenMux'),
      createElement('span', null, state),
    ),
    detail === undefined ? null : createElement('p', { style: detailStyle }, detail),
    url === undefined || connected ? null : createElement('a', {
      href: url,
      rel: 'noopener noreferrer',
      style: buttonStyle,
      target: '_blank',
    }, '打开 ZenMux 登录'),
  )
}

/** Mount popup behavior and the ZenMux command card into DSH Web. */
export function apply(ctx: Context): void {
  installSearchableModelSelect(ctx)

  ctx.on('command/executed', (_sessionId, commandName, result) => {
    if (commandName !== 'zenmux') return
    const url = authorizationUrlFromResult(result)
    if (url !== undefined) openAuthorizationWindow(url)
  })

  ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({
    key: 'zenmux',
    name: 'conversation.chat.commandview',
  }, ZenMuxCommandCard))
}
