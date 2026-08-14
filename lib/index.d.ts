/**
 * ZenMux OAuth 2.0 Authorization Code + PKCE controller. A human command starts
 * one loopback login, and the controller persists and refreshes the resulting
 * token set while mirroring its access token into the credential reference used
 * by the existing OpenAI-compatible LLM adapter.
 * @module dsh-zenmux-oauth
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin name. */
export declare const name = "zenmux-oauth";
/** Services required for login commands and durable token storage. */
export declare const inject: string[];
/** User-configurable ZenMux OAuth deployment values. */
export interface Config {
    /** Registered ZenMux public OAuth client id. */
    clientId: string;
    /** OAuth scopes requested at interactive login. */
    scopes: string[];
    /** Loopback callback port; zero asks the OS for a free port. */
    callbackPort: number;
    /** Optional SOCKS proxy URL for ZenMux discovery and token traffic. */
    proxyUrl: string;
    /** Credential reference exposed to LLM provider profiles. */
    accessTokenRef: string;
    /** Credential reference holding the complete versioned OAuth token set. */
    tokenSetRef: string;
    /** How long an unfinished browser login remains valid. */
    loginTimeoutMs: number;
    /** Per-request timeout for discovery, token, and revocation calls. */
    requestTimeoutMs: number;
    /** Refresh this long before the access-token expiry. */
    refreshSkewMs: number;
    /** Delay before retrying a failed background refresh. */
    refreshRetryMs: number;
}
/** Validated Cordis configuration. */
export declare const Config: z<Config>;
/**
 * Mount the ZenMux OAuth controller and `/zenmux` human command.
 * @param ctx - context carrying commands and writable credentials.
 * @param config - validated OAuth deployment configuration.
 * @returns startup after stored credentials are repaired and refresh is scheduled.
 */
export declare function apply(ctx: Context, config: Config): Promise<void>;
//# sourceMappingURL=index.d.ts.map