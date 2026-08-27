function positiveInteger(value) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}
function modelsFromPayload(payload) {
    if (typeof payload !== 'object' || payload === null || !Array.isArray(Reflect.get(payload, 'data'))) {
        throw new Error('ZenMux model response does not contain a data array');
    }
    const models = [];
    const seen = new Set();
    for (const raw of Reflect.get(payload, 'data')) {
        if (typeof raw !== 'object' || raw === null)
            continue;
        const entry = raw;
        const id = typeof entry.id === 'string' ? entry.id.trim() : '';
        const outputs = Array.isArray(entry.output_modalities) ? entry.output_modalities : [];
        if (id === '' || seen.has(id) || !outputs.includes('text'))
            continue;
        seen.add(id);
        const inputs = Array.isArray(entry.input_modalities) && entry.input_modalities.includes('image')
            ? ['text', 'image']
            : ['text'];
        const capabilities = typeof entry.capabilities === 'object' && entry.capabilities !== null
            ? entry.capabilities
            : undefined;
        const contextWindow = positiveInteger(entry.context_length);
        const maxTokens = positiveInteger(entry.max_output_tokens);
        let name = id;
        if (typeof entry.display_name === 'string' && entry.display_name.trim() !== '')
            name = entry.display_name.trim();
        else if (typeof entry.name === 'string' && entry.name.trim() !== '')
            name = entry.name.trim();
        models.push({
            id,
            name,
            ...contextWindow === undefined ? {} : { contextWindow },
            ...maxTokens === undefined ? {} : { maxTokens },
            input: inputs,
            ...capabilities?.reasoning === true ? {
                reasoningEfforts: { off: null, minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' },
            } : {},
        });
    }
    return models;
}
export function partitionRefreshModels(openaiPayload, anthropicPayload) {
    const openai = modelsFromPayload(openaiPayload);
    const anthropic = modelsFromPayload(anthropicPayload);
    const anthropicIds = new Set(anthropic.map(model => model.id));
    return {
        anthropicModels: anthropic,
        openaiOnlyModels: openai.filter(model => !anthropicIds.has(model.id)),
    };
}
//# sourceMappingURL=model-refresh.js.map