import { describe, expect, it, vi } from 'vitest'
import {
  authorizationUrlFromResult,
  authorizationUrlFromText,
  BROWSER_AUTO_OPEN_DISABLED_LINE,
  fetchZenMuxBrowserStatus,
  openAuthorizationWindow,
} from '../src/client.ts'

const ZENMUX_AI_ORIGIN = 'ZenMux OAuth origin: https://zenmux.ai'

describe('ZenMux DSH Web client', () => {
  it('extracts HTTPS and loopback-development authorization endpoints only', () => {
    const expected = 'https://zenmux.ai/oauth/authorize?state=test&code_challenge=challenge'
    expect(authorizationUrlFromText(`Open this URL:\n${ZENMUX_AI_ORIGIN}\n${expected}\nThen return.`)).toBe(expected)
    expect(authorizationUrlFromText(`${ZENMUX_AI_ORIGIN}\nhttps://evil.example/oauth/authorize?state=test`)).toBeUndefined()
    expect(authorizationUrlFromText(`${ZENMUX_AI_ORIGIN}\nhttps://zenmux.ai/not-oauth?state=test`)).toBeUndefined()
    expect(authorizationUrlFromText('ZenMux OAuth origin: https://zenmux.dev\nhttps://zenmux.dev/oauth/authorize?state=test')).toBe(
      'https://zenmux.dev/oauth/authorize?state=test',
    )
    expect(authorizationUrlFromText('ZenMux OAuth origin: http://127.0.0.1:4000\nhttp://127.0.0.1:4000/oauth/authorize?state=test')).toBe(
      'http://127.0.0.1:4000/oauth/authorize?state=test',
    )
    expect(authorizationUrlFromText('ZenMux OAuth origin: http://example.test\nhttp://example.test/oauth/authorize?state=test')).toBeUndefined()
  })

  it('does not auto-open when the host marks the login as manual', () => {
    expect(authorizationUrlFromResult({
      kind: 'success',
      text: `${ZENMUX_AI_ORIGIN}\nhttps://zenmux.ai/oauth/authorize?state=test\n${BROWSER_AUTO_OPEN_DISABLED_LINE}`,
    })).toBeUndefined()
  })

  it('ignores authorization-looking text from failed commands', () => {
    expect(authorizationUrlFromResult({
      kind: 'error',
      text: `${ZENMUX_AI_ORIGIN}\nhttps://zenmux.ai/oauth/authorize?state=test`,
    })).toBeUndefined()
  })

  it('opens the authorization URL without exposing the opener', () => {
    const open = vi.fn()
    vi.stubGlobal('window', { open })
    openAuthorizationWindow('https://zenmux.ai/oauth/authorize?state=test')
    expect(open).toHaveBeenCalledWith(
      'https://zenmux.ai/oauth/authorize?state=test',
      '_blank',
      'noopener,noreferrer',
    )
    vi.unstubAllGlobals()
  })

  it('reads only a valid credential-free browser status response', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      connected: true,
      detail: 'ZenMux OAuth is connected.',
    }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ connected: 'yes' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchZenMuxBrowserStatus()).resolves.toEqual({
      connected: true,
      detail: 'ZenMux OAuth is connected.',
    })
    await expect(fetchZenMuxBrowserStatus()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith('/zenmux/oauth/status', {
      headers: { Accept: 'application/json' },
    })
    vi.unstubAllGlobals()
  })
})
