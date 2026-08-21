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
let react_jsx_runtime = require("react/jsx-runtime");
react_jsx_runtime = __toESM(react_jsx_runtime);

//#region src/model-search.ts
function normalized(value) {
	return value.trim().toLocaleLowerCase();
}
/** Filter provider groups by provider name/id or model name/id/description. */
function filterModelGroups(groups, query) {
	const needle = normalized(query);
	if (needle === "") return groups.map((group) => ({
		...group,
		models: group.models
	}));
	return groups.flatMap((group) => {
		const models = normalized(group.name).includes(needle) || normalized(group.id).includes(needle) ? group.models : group.models.filter((model) => [
			model.name,
			model.id,
			model.description ?? ""
		].some((value) => normalized(value).includes(needle)));
		return models.length === 0 ? [] : [{
			...group,
			models
		}];
	});
}

//#endregion
//#region src/model-search-client.tsx
const MODEL_SELECT_PRIORITY = -10;
const STYLE_ID = "@zenmux/dsh-plugins/searchable-model-select";
const styles = `
.zenmux-model-select{min-width:0;position:relative}
.zenmux-model-select__trigger{min-width:0;max-width:220px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:transparent;border:0;border-radius:24px;outline:none;display:flex;align-items:center;gap:4px;padding:0 6px 0 8px;font-size:13px;font-weight:500;line-height:20px}
.zenmux-model-select__trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.zenmux-model-select__trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.zenmux-model-select__trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}
.zenmux-model-select__trigger-label{overflow:hidden;min-width:0;text-overflow:ellipsis;white-space:nowrap}
.zenmux-model-select__trigger-effort{color:var(--dsw-alias-label-caption);flex:none}
.zenmux-model-select__chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s}
.zenmux-model-select__chevron--open{transform:rotate(180deg)}
.zenmux-model-select__menu{z-index:20;position:absolute;right:0;bottom:calc(100% + 8px);width:min(320px,calc(100vw - 32px));max-height:min(440px,calc(100vh - 96px));overflow:hidden;display:flex;flex-direction:column;padding:4px;border:1px solid var(--dsw-alias-border-inverted);border-radius:12px;background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}
.zenmux-model-select__cell,.zenmux-model-select__option{width:100%;color:inherit;cursor:pointer;text-align:left;background:transparent;border:0;border-radius:10px;outline:none;display:flex;align-items:center;gap:8px}
.zenmux-model-select__cell{height:40px;padding:0 10px;font-size:14px;line-height:22px}
.zenmux-model-select__option{min-height:38px;padding:6px 8px}
.zenmux-model-select__cell:hover,.zenmux-model-select__option:hover:not(:disabled),.zenmux-model-select__option:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.zenmux-model-select__cell-label{overflow:hidden;min-width:0;flex:auto;text-overflow:ellipsis;white-space:nowrap}
.zenmux-model-select__cell-value{overflow:hidden;min-width:0;flex:0 auto;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap}
.zenmux-model-select__search-wrap{padding:4px 4px 6px}
.zenmux-model-select__search{box-sizing:border-box;width:100%;height:34px;padding:0 10px;border:1px solid var(--dsw-alias-border-secondary);border-radius:9px;outline:none;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.zenmux-model-select__search::placeholder{color:var(--dsw-alias-label-tertiary)}
.zenmux-model-select__search:focus{border-color:var(--dsw-alias-border-l3);box-shadow:0 0 0 2px var(--dsw-alias-interactive-bg-hover)}
.zenmux-model-select__groups{min-height:0;overflow-y:auto}
.zenmux-model-select__group+.zenmux-model-select__group{margin-top:4px}
.zenmux-model-select__group-title{position:sticky;z-index:1;top:0;padding:5px 8px 3px;background:var(--dsw-specific-menu);color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:500;line-height:18px}
.zenmux-model-select__option-copy{display:flex;min-width:0;flex:1;flex-direction:column}
.zenmux-model-select__model-name{overflow:hidden;color:inherit;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;line-height:20px}
.zenmux-model-select__description{overflow:hidden;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px}
.zenmux-model-select__check{display:grid;flex:0 0 18px;place-items:center;color:var(--dsw-alias-label-primary)}
.zenmux-model-select__status,.zenmux-model-select__empty{padding:10px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.zenmux-model-select__error,.zenmux-model-select__warning{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px;padding:7px 8px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.zenmux-model-select__warning{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label)}
.zenmux-model-select__retry{flex:none;padding:0;border:0;background:transparent;color:inherit;cursor:pointer;font:inherit;font-weight:600}
.zenmux-model-select__toast{position:absolute;right:0;bottom:calc(100% + 8px);width:280px;padding:9px 11px;border:1px solid var(--dsw-alias-border-secondary);border-radius:10px;background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
`;
function localeCopy() {
	return (document.documentElement.lang || navigator.language).toLocaleLowerCase().startsWith("zh") ? {
		empty: "没有匹配的模型。",
		placeholder: "搜索模型名称或 ID",
		searchAria: "搜索模型"
	} : {
		empty: "No matching models.",
		placeholder: "Search models by name or ID",
		searchAria: "Search models"
	};
}
function Chevron({ direction = "down" }) {
	return direction === "right" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		"aria-hidden": "true",
		height: "14",
		viewBox: "0 0 14 14",
		width: "14",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
			d: "m5.25 2.75 4.25 4.25-4.25 4.25",
			fill: "none",
			stroke: "currentColor",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			strokeWidth: "1.25"
		})
	}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		"aria-hidden": "true",
		height: "14",
		viewBox: "0 0 14 14",
		width: "14",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
			d: "m2.75 5.25 4.25 4.25 4.25-4.25",
			fill: "none",
			stroke: "currentColor",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			strokeWidth: "1.25"
		})
	});
}
function Check() {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
		"aria-hidden": "true",
		height: "16",
		viewBox: "0 0 16 16",
		width: "16",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
			d: "m3.25 8.25 3 3 6.5-6.5",
			fill: "none",
			stroke: "currentColor",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			strokeWidth: "1.5"
		})
	});
}
/** Composer model selector that retains DSH selection semantics and adds local catalog search. */
function SearchableModelSelect({ locked, available, directory, load, select, t }) {
	const state = (0, react.useSyncExternalStore)(directory.subscribe, directory.getSnapshot);
	const [open, setOpen] = (0, react.useState)(false);
	const [pane, setPane] = (0, react.useState)("root");
	const [query, setQuery] = (0, react.useState)("");
	const [selectionError, setSelectionError] = (0, react.useState)();
	const rootRef = (0, react.useRef)(null);
	const triggerRef = (0, react.useRef)(null);
	const searchRef = (0, react.useRef)(null);
	const itemRefs = (0, react.useRef)([]);
	const id = (0, react.useId)();
	const copy = localeCopy();
	const choices = (0, react.useMemo)(() => state.groups.flatMap((group) => group.models.map((model) => ({
		group,
		model,
		selection: {
			provider: group.id,
			model: model.id,
			...model.reasoning?.defaultEffort === void 0 ? {} : { reasoningEffort: model.reasoning.defaultEffort }
		}
	}))), [state.groups]);
	const currentChoice = state.current === null ? void 0 : choices.find((choice) => choice.selection.provider === state.current?.provider && choice.selection.model === state.current.model);
	const reasoning = currentChoice?.model.reasoning;
	const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
	const effortLabel = reasoning === void 0 ? void 0 : effectiveEffort === void 0 ? t("effort.providerDefault") : reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort;
	const effortChoices = (0, react.useMemo)(() => reasoning === void 0 ? [] : [...reasoning.defaultEffort === void 0 ? [{
		key: "provider-default",
		effort: void 0,
		label: t("effort.providerDefault"),
		description: void 0
	}] : [], ...reasoning.efforts.map((effort) => ({
		key: `effort:${effort.id}`,
		effort: effort.id,
		label: effort.name,
		description: effort.description
	}))], [reasoning, t]);
	const filteredGroups = (0, react.useMemo)(() => filterModelGroups(state.groups, query), [query, state.groups]);
	const filteredCount = filteredGroups.reduce((count, group) => count + group.models.length, 0);
	const busy = state.status === "selecting";
	const modelLabel = currentChoice?.model.name ?? t("trigger.fallback");
	const triggerLabel = effortLabel === void 0 ? modelLabel : `${modelLabel} · ${effortLabel}`;
	(0, react.useEffect)(() => {
		if (available) load();
	}, [available, load]);
	(0, react.useEffect)(() => {
		if (!open) return;
		const closeOutside = (event) => {
			if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
		};
		document.addEventListener("mousedown", closeOutside);
		return () => document.removeEventListener("mousedown", closeOutside);
	}, [open]);
	(0, react.useEffect)(() => {
		if (open && pane === "model") queueMicrotask(() => searchRef.current?.focus());
	}, [open, pane]);
	if (!available) return null;
	itemRefs.current = [];
	let itemIndex = 0;
	const itemRef = () => {
		const at = itemIndex;
		itemIndex += 1;
		return (node) => {
			itemRefs.current[at] = node;
		};
	};
	const close = (restoreFocus = false) => {
		setOpen(false);
		setPane("root");
		setQuery("");
		if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus());
	};
	const show = () => {
		setSelectionError(void 0);
		setPane("root");
		setQuery("");
		setOpen(true);
		load();
	};
	const settleSelection = (accepted) => {
		if (accepted) close(true);
		else setSelectionError(directory.getSnapshot().error ?? t("error.action", { message: "Unknown error" }));
	};
	const choose = (selection) => {
		if (state.current?.provider === selection.provider && state.current?.model === selection.model) close(true);
		else select(selection).then(settleSelection);
	};
	const chooseEffort = (reasoningEffort) => {
		if (state.current === null) return;
		if (effectiveEffort === reasoningEffort) close(true);
		else select({
			provider: state.current.provider,
			model: state.current.model,
			...reasoningEffort === void 0 ? {} : { reasoningEffort }
		}).then(settleSelection);
	};
	const moveFocus = (offset) => {
		const items = itemRefs.current.filter((item) => item !== null);
		if (items.length === 0) return;
		const active = items.findIndex((item) => item === document.activeElement);
		items[(Math.max(active, 0) + offset + items.length) % items.length]?.focus();
	};
	const onKeyDown = (event) => {
		if (event.key === "Escape" && open) {
			event.preventDefault();
			if (pane !== "root") {
				setPane("root");
				setQuery("");
			} else close(true);
		} else if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
			event.preventDefault();
			moveFocus(event.key === "ArrowDown" ? 1 : -1);
		}
	};
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
		className: "zenmux-model-select",
		onKeyDown,
		ref: rootRef,
		children: [
			/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				"aria-controls": open ? `${id}-menu` : void 0,
				"aria-expanded": open,
				"aria-haspopup": "menu",
				"aria-label": triggerLabel,
				className: "zenmux-model-select__trigger",
				disabled: locked,
				onClick: () => open ? close() : show(),
				ref: triggerRef,
				title: triggerLabel,
				type: "button",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "zenmux-model-select__trigger-label",
						children: modelLabel
					}),
					effortLabel === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "zenmux-model-select__trigger-effort",
						children: effortLabel
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `zenmux-model-select__chevron${open ? " zenmux-model-select__chevron--open" : ""}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, {})
					})
				]
			}),
			open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"aria-busy": state.status === "loading" || busy,
				"aria-label": t("menu.aria"),
				className: "zenmux-model-select__menu",
				id: `${id}-menu`,
				role: "menu",
				children: [
					pane === "root" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						className: "zenmux-model-select__cell",
						onClick: () => setPane("model"),
						ref: itemRef(),
						role: "menuitem",
						type: "button",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "zenmux-model-select__cell-label",
								children: t("menu.model")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "zenmux-model-select__cell-value",
								children: modelLabel
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, { direction: "right" })
						]
					}), reasoning === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						className: "zenmux-model-select__cell",
						onClick: () => setPane("effort"),
						ref: itemRef(),
						role: "menuitem",
						type: "button",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "zenmux-model-select__cell-label",
								children: t("menu.effort")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "zenmux-model-select__cell-value",
								children: effortLabel
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, { direction: "right" })
						]
					})] }) : null,
					pane === "model" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "zenmux-model-select__search-wrap",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								"aria-label": copy.searchAria,
								className: "zenmux-model-select__search",
								onChange: (event) => setQuery(event.currentTarget.value),
								placeholder: copy.placeholder,
								ref: searchRef,
								type: "search",
								value: query
							})
						}),
						state.status === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "zenmux-model-select__status",
							children: t("status.loading")
						}) : null,
						state.error === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "zenmux-model-select__error",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("error.action", { message: state.error }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "zenmux-model-select__retry",
								onClick: load,
								type: "button",
								children: t("action.reload")
							})]
						}),
						state.failures.map((failure) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "zenmux-model-select__warning",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("warning.groupLoad", {
								name: failure.name,
								message: failure.message
							}) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "zenmux-model-select__retry",
								onClick: load,
								type: "button",
								children: t("action.reload")
							})]
						}, failure.id)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "zenmux-model-select__groups scrollable",
							children: filteredGroups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								"aria-label": group.name,
								className: "zenmux-model-select__group",
								role: "group",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "zenmux-model-select__group-title",
									children: group.name
								}), group.models.map((model) => {
									const selected = state.current?.provider === group.id && state.current.model === model.id;
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										"aria-checked": selected,
										className: "zenmux-model-select__option",
										disabled: busy,
										onClick: () => choose({
											provider: group.id,
											model: model.id
										}),
										ref: itemRef(),
										role: "menuitemradio",
										title: `${model.name} · ${model.id}`,
										type: "button",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "zenmux-model-select__option-copy",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "zenmux-model-select__model-name",
												children: model.name
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "zenmux-model-select__description",
												children: model.id
											})]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "zenmux-model-select__check",
											children: selected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Check, {}) : null
										})]
									}, `${group.id}:${model.id}`);
								})]
							}, group.id))
						}),
						state.status === "ready" && filteredCount === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "zenmux-model-select__empty",
							children: query.trim() === "" ? t("empty.models") : copy.empty
						}) : null
					] }) : null,
					pane === "effort" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: effortChoices.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "zenmux-model-select__empty",
						children: t("empty.efforts")
					}) : effortChoices.map((level) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						"aria-checked": effectiveEffort === level.effort,
						className: "zenmux-model-select__option",
						disabled: busy,
						onClick: () => chooseEffort(level.effort),
						ref: itemRef(),
						role: "menuitemradio",
						type: "button",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "zenmux-model-select__option-copy",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "zenmux-model-select__model-name",
								children: level.label
							}), level.description === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "zenmux-model-select__description",
								children: level.description
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "zenmux-model-select__check",
							children: effectiveEffort === level.effort ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Check, {}) : null
						})]
					}, level.key)) }) : null
				]
			}) : null,
			selectionError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "zenmux-model-select__toast",
				role: "alert",
				children: selectionError
			})
		]
	});
}
function installStyles() {
	if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return;
	const style = document.createElement("style");
	style.dataset.plugin = "@zenmux/dsh-plugins";
	style.dataset.pluginCss = STYLE_ID;
	style.textContent = styles;
	document.head.appendChild(style);
}
/** Shadow DSH's single composer model slot with the searchable equivalent. */
function installSearchableModelSelect(ctx) {
	installStyles();
	ctx.slots.inject("conversation.input.model", () => ctx.slots.register({
		name: "conversation.input.model",
		locale: "model",
		priority: MODEL_SELECT_PRIORITY,
		inject: (sessionId) => {
			const directory = ctx.modelDirectories.directoryFor(sessionId);
			const available = ctx.sessions.subagentAddress(sessionId) === void 0;
			return {
				available,
				directory: directory.store,
				load: () => {
					if (available) directory.load().catch(() => void 0);
				},
				select: (selection) => available ? directory.select(selection).then(() => true, () => false) : Promise.resolve(false)
			};
		}
	}, SearchableModelSelect));
}

//#endregion
//#region src/shared.ts
/** Exact command-result marker used to disable DSH Web's automatic popup. */
const BROWSER_AUTO_OPEN_DISABLED_LINE = "ZenMux browser auto-open is disabled.";
/** Prefix for the trusted OAuth origin emitted alongside an authorization URL. */
const OAUTH_ORIGIN_LINE_PREFIX = "ZenMux OAuth origin: ";
/** Same-origin, read-only browser endpoint used to refresh OAuth command cards. */
const ZENMUX_BROWSER_STATUS_PATH = "/zenmux/oauth/status";

//#endregion
//#region src/client.ts
/** Client plugin name. */
const name = "zenmux-client";
/** Services required for command acknowledgements and command-row registration. */
const inject = [
	"slots",
	"commandUi",
	"modelDirectories",
	"sessions"
];
const AUTHORIZE_PATH = "/oauth/authorize";
const STATUS_POLL_INTERVAL_MS = 1e3;
const STATUS_POLL_LIMIT = 300;
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
/** Read and validate the host's credential-free OAuth state response. */
async function fetchZenMuxBrowserStatus(signal) {
	const response = await fetch(ZENMUX_BROWSER_STATUS_PATH, {
		headers: { Accept: "application/json" },
		...signal === void 0 ? {} : { signal }
	});
	if (!response.ok) return void 0;
	const value = await response.json();
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const connected = Reflect.get(value, "connected");
	const detail = Reflect.get(value, "detail");
	if (typeof connected !== "boolean" || typeof detail !== "string") return void 0;
	return {
		connected,
		detail
	};
}
/** Prompt the host to refresh stale OAuth credentials when the Web UI becomes active. */
function installOAuthWakeRefresh() {
	let controller;
	const refresh = () => {
		if (document.visibilityState !== "visible") return;
		controller?.abort();
		controller = new AbortController();
		fetchZenMuxBrowserStatus(controller.signal).catch(() => {});
	};
	document.addEventListener("visibilitychange", refresh);
	refresh();
	return () => {
		document.removeEventListener("visibilitychange", refresh);
		controller?.abort();
	};
}
/** Poll only while a login card is waiting, and stop as soon as it becomes connected. */
function useZenMuxBrowserStatus(authorizationUrl) {
	const [status, setStatus] = (0, react.useState)();
	(0, react.useEffect)(() => {
		setStatus(void 0);
		if (authorizationUrl === void 0) return;
		const controller = new AbortController();
		let timer;
		let attempts = 0;
		const poll = async () => {
			attempts += 1;
			try {
				const next = await fetchZenMuxBrowserStatus(controller.signal);
				if (controller.signal.aborted) return;
				if (next !== void 0) {
					setStatus(next);
					if (next.connected) return;
				}
			} catch {
				if (controller.signal.aborted) return;
			}
			if (attempts < STATUS_POLL_LIMIT) timer = setTimeout(() => void poll(), STATUS_POLL_INTERVAL_MS);
		};
		poll();
		return () => {
			controller.abort();
			if (timer !== void 0) clearTimeout(timer);
		};
	}, [authorizationUrl]);
	return status;
}
/** ZenMux-specific durable command row with a popup-blocker-safe link fallback. */
function ZenMuxCommandCard({ node }) {
	const outcome = node.outcome;
	const url = authorizationUrlFromText(outcome?.text);
	const browserStatus = useZenMuxBrowserStatus(url);
	const connected = browserStatus?.connected === true;
	const state = outcome === null ? "正在准备登录…" : outcome.kind === "error" ? "执行失败" : connected ? "已连接" : url === void 0 ? "已完成" : "等待浏览器授权";
	const detail = outcome?.kind === "error" ? outcome.text ?? "ZenMux 命令执行失败。" : connected ? browserStatus.detail : url === void 0 ? outcome?.text : "如果授权窗口没有自动打开，请点击下面的按钮。";
	return (0, react.createElement)("section", {
		style: cardStyle,
		"data-zenmux-command": true
	}, (0, react.createElement)("div", { style: headerStyle }, (0, react.createElement)("span", null, "ZenMux"), (0, react.createElement)("span", null, state)), detail === void 0 ? null : (0, react.createElement)("p", { style: detailStyle }, detail), url === void 0 || connected ? null : (0, react.createElement)("a", {
		href: url,
		rel: "noopener noreferrer",
		style: buttonStyle,
		target: "_blank"
	}, "打开 ZenMux 登录"));
}
/** Mount popup behavior and the ZenMux command card into DSH Web. */
function apply(ctx) {
	installSearchableModelSelect(ctx);
	ctx.effect(installOAuthWakeRefresh, "zenmux.oauth-wake-refresh");
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
exports.fetchZenMuxBrowserStatus = fetchZenMuxBrowserStatus;
exports.inject = inject;
exports.installOAuthWakeRefresh = installOAuthWakeRefresh;
exports.name = name;
exports.openAuthorizationWindow = openAuthorizationWindow;
return module.exports; } });
//# sourceMappingURL=client.js.map