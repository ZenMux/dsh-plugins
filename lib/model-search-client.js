import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, } from 'react';
import { filterModelGroups } from './model-search.js';
const MODEL_SELECT_PRIORITY = -10;
const STYLE_ID = '@zenmux/dsh-plugins/searchable-model-select';
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
    const language = document.documentElement.lang || navigator.language;
    return language.toLocaleLowerCase().startsWith('zh')
        ? { empty: '没有匹配的模型。', placeholder: '搜索模型名称或 ID', searchAria: '搜索模型' }
        : { empty: 'No matching models.', placeholder: 'Search models by name or ID', searchAria: 'Search models' };
}
function Chevron({ direction = 'down' }) {
    return direction === 'right'
        ? _jsx("svg", { "aria-hidden": "true", height: "14", viewBox: "0 0 14 14", width: "14", children: _jsx("path", { d: "m5.25 2.75 4.25 4.25-4.25 4.25", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.25" }) })
        : _jsx("svg", { "aria-hidden": "true", height: "14", viewBox: "0 0 14 14", width: "14", children: _jsx("path", { d: "m2.75 5.25 4.25 4.25 4.25-4.25", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.25" }) });
}
function Check() {
    return _jsx("svg", { "aria-hidden": "true", height: "16", viewBox: "0 0 16 16", width: "16", children: _jsx("path", { d: "m3.25 8.25 3 3 6.5-6.5", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.5" }) });
}
/** Composer model selector that retains DSH selection semantics and adds local catalog search. */
function SearchableModelSelect({ locked, available, directory, load, select, t }) {
    const state = useSyncExternalStore(directory.subscribe, directory.getSnapshot);
    const [open, setOpen] = useState(false);
    const [pane, setPane] = useState('root');
    const [query, setQuery] = useState('');
    const [selectionError, setSelectionError] = useState();
    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const searchRef = useRef(null);
    const itemRefs = useRef([]);
    const id = useId();
    const copy = localeCopy();
    const choices = useMemo(() => state.groups.flatMap(group => group.models.map(model => ({
        group,
        model,
        selection: {
            provider: group.id,
            model: model.id,
            ...model.reasoning?.defaultEffort === undefined ? {} : { reasoningEffort: model.reasoning.defaultEffort },
        },
    }))), [state.groups]);
    const currentChoice = state.current === null
        ? undefined
        : choices.find(choice => choice.selection.provider === state.current?.provider && choice.selection.model === state.current.model);
    const reasoning = currentChoice?.model.reasoning;
    const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
    const effortLabel = reasoning === undefined
        ? undefined
        : effectiveEffort === undefined
            ? t('effort.providerDefault')
            : reasoning.efforts.find(level => level.id === effectiveEffort)?.name ?? effectiveEffort;
    const effortChoices = useMemo(() => reasoning === undefined ? [] : [
        ...reasoning.defaultEffort === undefined
            ? [{ key: 'provider-default', effort: undefined, label: t('effort.providerDefault'), description: undefined }]
            : [],
        ...reasoning.efforts.map(effort => ({
            key: `effort:${effort.id}`,
            effort: effort.id,
            label: effort.name,
            description: effort.description,
        })),
    ], [reasoning, t]);
    const filteredGroups = useMemo(() => filterModelGroups(state.groups, query), [query, state.groups]);
    const filteredCount = filteredGroups.reduce((count, group) => count + group.models.length, 0);
    const busy = state.status === 'selecting';
    const modelLabel = currentChoice?.model.name ?? t('trigger.fallback');
    const triggerLabel = effortLabel === undefined ? modelLabel : `${modelLabel} · ${effortLabel}`;
    useEffect(() => {
        if (available)
            load();
    }, [available, load]);
    useEffect(() => {
        if (!open)
            return;
        const closeOutside = (event) => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', closeOutside);
        return () => document.removeEventListener('mousedown', closeOutside);
    }, [open]);
    useEffect(() => {
        if (open && pane === 'model')
            queueMicrotask(() => searchRef.current?.focus());
    }, [open, pane]);
    if (!available)
        return null;
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
        setPane('root');
        setQuery('');
        if (restoreFocus)
            queueMicrotask(() => triggerRef.current?.focus());
    };
    const show = () => {
        setSelectionError(undefined);
        setPane('root');
        setQuery('');
        setOpen(true);
        load();
    };
    const settleSelection = (accepted) => {
        if (accepted)
            close(true);
        else
            setSelectionError(directory.getSnapshot().error ?? t('error.action', { message: 'Unknown error' }));
    };
    const choose = (selection) => {
        if (state.current?.provider === selection.provider && state.current?.model === selection.model)
            close(true);
        else
            void select(selection).then(settleSelection);
    };
    const chooseEffort = (reasoningEffort) => {
        if (state.current === null)
            return;
        if (effectiveEffort === reasoningEffort)
            close(true);
        else
            void select({
                provider: state.current.provider,
                model: state.current.model,
                ...reasoningEffort === undefined ? {} : { reasoningEffort },
            }).then(settleSelection);
    };
    const moveFocus = (offset) => {
        const items = itemRefs.current.filter((item) => item !== null);
        if (items.length === 0)
            return;
        const active = items.findIndex(item => item === document.activeElement);
        items[(Math.max(active, 0) + offset + items.length) % items.length]?.focus();
    };
    const onKeyDown = (event) => {
        if (event.key === 'Escape' && open) {
            event.preventDefault();
            if (pane !== 'root') {
                setPane('root');
                setQuery('');
            }
            else
                close(true);
        }
        else if (open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            moveFocus(event.key === 'ArrowDown' ? 1 : -1);
        }
    };
    return _jsxs("div", { className: "zenmux-model-select", onKeyDown: onKeyDown, ref: rootRef, children: [_jsxs("button", { "aria-controls": open ? `${id}-menu` : undefined, "aria-expanded": open, "aria-haspopup": "menu", "aria-label": triggerLabel, className: "zenmux-model-select__trigger", disabled: locked, onClick: () => open ? close() : show(), ref: triggerRef, title: triggerLabel, type: "button", children: [_jsx("span", { className: "zenmux-model-select__trigger-label", children: modelLabel }), effortLabel === undefined ? null : _jsx("span", { className: "zenmux-model-select__trigger-effort", children: effortLabel }), _jsx("span", { className: `zenmux-model-select__chevron${open ? ' zenmux-model-select__chevron--open' : ''}`, children: _jsx(Chevron, {}) })] }), open ? _jsxs("div", { "aria-busy": state.status === 'loading' || busy, "aria-label": t('menu.aria'), className: "zenmux-model-select__menu", id: `${id}-menu`, role: "menu", children: [pane === 'root' ? _jsxs(_Fragment, { children: [_jsxs("button", { className: "zenmux-model-select__cell", onClick: () => setPane('model'), ref: itemRef(), role: "menuitem", type: "button", children: [_jsx("span", { className: "zenmux-model-select__cell-label", children: t('menu.model') }), _jsx("span", { className: "zenmux-model-select__cell-value", children: modelLabel }), _jsx(Chevron, { direction: "right" })] }), reasoning === undefined ? null : _jsxs("button", { className: "zenmux-model-select__cell", onClick: () => setPane('effort'), ref: itemRef(), role: "menuitem", type: "button", children: [_jsx("span", { className: "zenmux-model-select__cell-label", children: t('menu.effort') }), _jsx("span", { className: "zenmux-model-select__cell-value", children: effortLabel }), _jsx(Chevron, { direction: "right" })] })] }) : null, pane === 'model' ? _jsxs(_Fragment, { children: [_jsx("div", { className: "zenmux-model-select__search-wrap", children: _jsx("input", { "aria-label": copy.searchAria, className: "zenmux-model-select__search", onChange: event => setQuery(event.currentTarget.value), placeholder: copy.placeholder, ref: searchRef, type: "search", value: query }) }), state.status === 'loading' ? _jsx("div", { className: "zenmux-model-select__status", children: t('status.loading') }) : null, state.error === null ? null : _jsxs("div", { className: "zenmux-model-select__error", children: [_jsx("span", { children: t('error.action', { message: state.error }) }), _jsx("button", { className: "zenmux-model-select__retry", onClick: load, type: "button", children: t('action.reload') })] }), state.failures.map(failure => _jsxs("div", { className: "zenmux-model-select__warning", children: [_jsx("span", { children: t('warning.groupLoad', { name: failure.name, message: failure.message }) }), _jsx("button", { className: "zenmux-model-select__retry", onClick: load, type: "button", children: t('action.reload') })] }, failure.id)), _jsx("div", { className: "zenmux-model-select__groups scrollable", children: filteredGroups.map(group => _jsxs("section", { "aria-label": group.name, className: "zenmux-model-select__group", role: "group", children: [_jsx("div", { className: "zenmux-model-select__group-title", children: group.name }), group.models.map(model => {
                                            const selected = state.current?.provider === group.id && state.current.model === model.id;
                                            return _jsxs("button", { "aria-checked": selected, className: "zenmux-model-select__option", disabled: busy, onClick: () => choose({ provider: group.id, model: model.id }), ref: itemRef(), role: "menuitemradio", title: `${model.name} · ${model.id}`, type: "button", children: [_jsxs("span", { className: "zenmux-model-select__option-copy", children: [_jsx("span", { className: "zenmux-model-select__model-name", children: model.name }), _jsx("span", { className: "zenmux-model-select__description", children: model.id })] }), _jsx("span", { className: "zenmux-model-select__check", children: selected ? _jsx(Check, {}) : null })] }, `${group.id}:${model.id}`);
                                        })] }, group.id)) }), state.status === 'ready' && filteredCount === 0 ? _jsx("div", { className: "zenmux-model-select__empty", children: query.trim() === '' ? t('empty.models') : copy.empty }) : null] }) : null, pane === 'effort' ? _jsx(_Fragment, { children: effortChoices.length === 0 ? _jsx("div", { className: "zenmux-model-select__empty", children: t('empty.efforts') }) : effortChoices.map(level => _jsxs("button", { "aria-checked": effectiveEffort === level.effort, className: "zenmux-model-select__option", disabled: busy, onClick: () => chooseEffort(level.effort), ref: itemRef(), role: "menuitemradio", type: "button", children: [_jsxs("span", { className: "zenmux-model-select__option-copy", children: [_jsx("span", { className: "zenmux-model-select__model-name", children: level.label }), level.description === undefined ? null : _jsx("span", { className: "zenmux-model-select__description", children: level.description })] }), _jsx("span", { className: "zenmux-model-select__check", children: effectiveEffort === level.effort ? _jsx(Check, {}) : null })] }, level.key)) }) : null] }) : null, selectionError === undefined ? null : _jsx("div", { className: "zenmux-model-select__toast", role: "alert", children: selectionError })] });
}
function installStyles() {
    if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null)
        return;
    const style = document.createElement('style');
    style.dataset.plugin = '@zenmux/dsh-plugins';
    style.dataset.pluginCss = STYLE_ID;
    style.textContent = styles;
    document.head.appendChild(style);
}
/** Shadow DSH's single composer model slot with the searchable equivalent. */
export function installSearchableModelSelect(ctx) {
    installStyles();
    ctx.slots.inject('conversation.input.model', () => ctx.slots.register({
        name: 'conversation.input.model',
        locale: 'model',
        priority: MODEL_SELECT_PRIORITY,
        inject: (sessionId) => {
            const directory = ctx.modelDirectories.directoryFor(sessionId);
            const available = ctx.sessions.subagentAddress(sessionId) === undefined;
            return {
                available,
                directory: directory.store,
                load: () => { if (available)
                    void directory.load().catch(() => undefined); },
                select: (selection) => available
                    ? directory.select(selection).then(() => true, () => false)
                    : Promise.resolve(false),
            };
        },
    }, SearchableModelSelect));
}
//# sourceMappingURL=model-search-client.js.map