/**
 * Package-owned invariant companion for `dsh-zenmux-oauth`.
 * @module dsh-zenmux-oauth/invariant
 */
const PACKAGE_NAME = 'dsh-zenmux-oauth';
/** Cordis companion plugin name. */
export const name = 'zenmux-oauth-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/**
 * No runtime invariant: the plugin's state is private and its only published
 * values commit through the credentials service, whose provider owns update invariants.
 */
const install = () => { };
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
/* jscpd:ignore-end */
//# sourceMappingURL=invariant.js.map