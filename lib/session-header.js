import { AsyncLocalStorage } from 'node:async_hooks';
export const ZENMUX_SESSION_HEADER = 'x-zenmux-session-id';
const ZENMUX_PROVIDERS = new Set(['zenmux', 'zenmux-models']);
async function* streamWithSession(storage, sessionId, next) {
    const iterator = storage.run(sessionId, () => next()[Symbol.asyncIterator]());
    let exhausted = false;
    try {
        while (true) {
            const result = await storage.run(sessionId, () => iterator.next());
            if (result.done) {
                exhausted = true;
                return;
            }
            yield result.value;
        }
    }
    finally {
        if (!exhausted)
            await storage.run(sessionId, async () => iterator.return?.());
    }
}
function mergedHeaders(input, init, sessionId) {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers !== undefined) {
        new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    }
    headers.set(ZENMUX_SESSION_HEADER, sessionId);
    return headers;
}
/**
 * Add the current DSH session id to ZenMux inference requests.
 *
 * The LLM middleware scopes one session id through AsyncLocalStorage. The fetch
 * wrapper only acts inside that scope, so OAuth, catalog refreshes, other
 * providers, and concurrent sessions retain their own headers.
 */
export function installZenMuxSessionHeader(ctx) {
    const storage = new AsyncLocalStorage();
    const originalFetch = globalThis.fetch;
    const wrappedFetch = (input, init) => {
        const sessionId = storage.getStore();
        if (sessionId === undefined)
            return originalFetch(input, init);
        return originalFetch(input, { ...init, headers: mergedHeaders(input, init, sessionId) });
    };
    globalThis.fetch = wrappedFetch;
    const removeListener = ctx.on('llm/stream', (options, next) => {
        if (!ZENMUX_PROVIDERS.has(options.provider) || options.sessionId === undefined)
            return next();
        return streamWithSession(storage, String(options.sessionId), next);
    });
    return () => {
        removeListener();
        storage.disable();
        if (globalThis.fetch === wrappedFetch)
            globalThis.fetch = originalFetch;
    };
}
//# sourceMappingURL=session-header.js.map