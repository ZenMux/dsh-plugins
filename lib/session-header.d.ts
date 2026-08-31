import type { Context } from '@deepseek-ai/cordis';
export declare const ZENMUX_SESSION_HEADER = "x-zenmux-session-id";
/**
 * Add the current DSH session id to ZenMux inference requests.
 *
 * The LLM middleware scopes one session id through AsyncLocalStorage. The fetch
 * wrapper only acts inside that scope, so OAuth, catalog refreshes, other
 * providers, and concurrent sessions retain their own headers.
 */
export declare function installZenMuxSessionHeader(ctx: Context): () => void;
//# sourceMappingURL=session-header.d.ts.map