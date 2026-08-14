window.__ModuleLoader__.load({ id: "@zenmux/dsh-plugins", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let react = require("react");
react = __toESM(react);

//#region src/shared.ts
/** Exact command-result marker used to disable DSH Web's automatic popup. */
const BROWSER_AUTO_OPEN_DISABLED_LINE = "ZenMux browser auto-open is disabled.";
/** Prefix for the trusted OAuth origin emitted alongside an authorization URL. */
const OAUTH_ORIGIN_LINE_PREFIX = "ZenMux OAuth origin: ";

//#endregion
//#region src/client.ts
/** Client plugin name. */
const name = "zenmux-client";
/** Services required for command acknowledgements and command-row registration. */
const inject = ["slots", "commandUi"];
const AUTHORIZE_PATH = "/oauth/authorize";
/** Accept production/custom HTTPS authorization servers and loopback HTTP development servers. */
function isAllowedAuthorizationUrl(url, expectedOrigin) {
	const isLoopbackHttp = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]");
	return (url.protocol === "https:" || isLoopbackHttp) && url.origin === expectedOrigin && url.pathname === AUTHORIZE_PATH;
}
const cardStyle = {
	border: "1px solid var(--dsw-alias-border-secondary, rgba(127, 127, 127, 0.28))",
	borderRadius: 10,
	display: "flex",
	flexDirection: "column",
	gap: 10,
	padding: "12px 14px"
};
const headerStyle = {
	alignItems: "center",
	display: "flex",
	fontSize: 13,
	fontWeight: 600,
	justifyContent: "space-between"
};
const detailStyle = {
	color: "var(--dsw-alias-text-secondary, #888)",
	fontSize: 12,
	lineHeight: 1.5,
	margin: 0,
	whiteSpace: "pre-wrap"
};
const buttonStyle = {
	alignSelf: "flex-start",
	background: "var(--dsw-alias-accent-primary, #4f6ef7)",
	borderRadius: 8,
	color: "#fff",
	fontSize: 13,
	fontWeight: 600,
	padding: "7px 12px",
	textDecoration: "none"
};
/** Return a validated ZenMux authorization URL embedded in a command result. */
function authorizationUrlFromText(text) {
	if (text === void 0) return void 0;
	const lines = text.split(/\r?\n/u);
	const expectedOrigin = lines.find((line) => line.startsWith(OAUTH_ORIGIN_LINE_PREFIX))?.slice(OAUTH_ORIGIN_LINE_PREFIX.length);
	if (expectedOrigin === void 0) return void 0;
	for (const line of lines) {
		if (!line.startsWith("https://") && !line.startsWith("http://")) continue;
		try {
			const url = new URL(line);
			if (isAllowedAuthorizationUrl(url, expectedOrigin)) return url.href;
		} catch {}
	}
}
/** Extract a safe authorization URL only from a successful command result. */
function authorizationUrlFromResult(result) {
	return result.kind === "success" && !result.text?.split(/\r?\n/u).includes(BROWSER_AUTO_OPEN_DISABLED_LINE) ? authorizationUrlFromText(result.text) : void 0;
}
/** Open authorization in a separate, opener-isolated browser tab. */
function openAuthorizationWindow(url) {
	window.open(url, "_blank", "noopener,noreferrer");
}
/** ZenMux-specific durable command row with a popup-blocker-safe link fallback. */
function ZenMuxCommandCard({ node }) {
	const outcome = node.outcome;
	const url = authorizationUrlFromText(outcome?.text);
	const state = outcome === null ? "正在准备登录…" : outcome.kind === "error" ? "执行失败" : url === void 0 ? "已完成" : "等待浏览器授权";
	const detail = outcome?.kind === "error" ? outcome.text ?? "ZenMux 命令执行失败。" : url === void 0 ? outcome?.text : "如果授权窗口没有自动打开，请点击下面的按钮。";
	return (0, react.createElement)("section", {
		style: cardStyle,
		"data-zenmux-command": true
	}, (0, react.createElement)("div", { style: headerStyle }, (0, react.createElement)("span", null, "ZenMux"), (0, react.createElement)("span", null, state)), detail === void 0 ? null : (0, react.createElement)("p", { style: detailStyle }, detail), url === void 0 ? null : (0, react.createElement)("a", {
		href: url,
		rel: "noopener noreferrer",
		style: buttonStyle,
		target: "_blank"
	}, "打开 ZenMux 登录"));
}
/** Mount popup behavior and the ZenMux command card into DSH Web. */
function apply(ctx) {
	ctx.on("command/executed", (_sessionId, commandName, result) => {
		if (commandName !== "zenmux") return;
		const url = authorizationUrlFromResult(result);
		if (url !== void 0) openAuthorizationWindow(url);
	});
	ctx.slots.inject("conversation.chat.commandview", () => ctx.slots.register({
		key: "zenmux",
		name: "conversation.chat.commandview"
	}, ZenMuxCommandCard));
}

//#endregion
exports.BROWSER_AUTO_OPEN_DISABLED_LINE = BROWSER_AUTO_OPEN_DISABLED_LINE;
exports.apply = apply;
exports.authorizationUrlFromResult = authorizationUrlFromResult;
exports.authorizationUrlFromText = authorizationUrlFromText;
exports.inject = inject;
exports.name = name;
exports.openAuthorizationWindow = openAuthorizationWindow;
return module.exports; } });
//# sourceMappingURL=client.js.map