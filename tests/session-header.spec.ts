import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { LlmAdapter, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { installZenMuxSessionHeader, ZENMUX_SESSION_HEADER } from '../src/session-header.js'

class FetchingAdapter extends LlmAdapter {
  async *stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    await fetch('https://zenmux.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'x-existing': 'kept' },
    })
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  vi.unstubAllGlobals()
})

describe('ZenMux session header', () => {
  it('adds the current DSH session id only to ZenMux provider requests', async () => {
    const seen: Headers[] = []
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Headers(init?.headers))
      return Promise.resolve(new Response('{}', { status: 200 }))
    }))
    const ctx = new Context()
    context = ctx
    await ctx.plugin(LlmRuntime)
    await ctx.plugin({
      inject: ['llm'],
      apply(pluginCtx: Context) {
        pluginCtx.llm.registerAdapter(['zenmux', 'other'], new FetchingAdapter())
        const uninstall = installZenMuxSessionHeader(pluginCtx)
        pluginCtx.effect(() => uninstall, 'test.zenmux-session-header')
      },
    })

    for await (const _chunk of ctx.llm.stream({
      provider: 'zenmux',
      model: 'model',
      messages: [],
      sessionId: 'session-123' as GenerateOptions['sessionId'],
    })) {
      // Consume the stream so the adapter performs its request.
    }
    for await (const _chunk of ctx.llm.stream({
      provider: 'other',
      model: 'model',
      messages: [],
      sessionId: 'session-456' as GenerateOptions['sessionId'],
    })) {
      // Consume the control request.
    }

    expect(seen[0]?.get(ZENMUX_SESSION_HEADER)).toBe('session-123')
    expect(seen[0]?.get('x-existing')).toBe('kept')
    expect(seen[1]?.has(ZENMUX_SESSION_HEADER)).toBe(false)
  })
})
