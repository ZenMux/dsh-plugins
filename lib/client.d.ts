import type { Context } from '@deepseek-ai/cordis';
import type { CommandResult } from '@deepseek-ai/dsh-commands/types';
/** Client plugin name. */
export declare const name = "zenmux-client";
/** Services required for command acknowledgements and command-row registration. */
export declare const inject: string[];
export { BROWSER_AUTO_OPEN_DISABLED_LINE } from './shared.js';
/** Public, credential-free OAuth state returned by the host browser route. */
export interface ZenMuxBrowserStatus {
    readonly connected: boolean;
    readonly detail: string;
}
/** Return a validated ZenMux authorization URL embedded in a command result. */
export declare function authorizationUrlFromText(text: string | undefined): string | undefined;
/** Extract a safe authorization URL only from a successful command result. */
export declare function authorizationUrlFromResult(result: CommandResult): string | undefined;
/** Open authorization in a separate, opener-isolated browser tab. */
export declare function openAuthorizationWindow(url: string): void;
/** Read and validate the host's credential-free OAuth state response. */
export declare function fetchZenMuxBrowserStatus(signal?: AbortSignal): Promise<ZenMuxBrowserStatus | undefined>;
/** Mount popup behavior and the ZenMux command card into DSH Web. */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=client.d.ts.map