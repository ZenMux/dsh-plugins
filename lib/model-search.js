function normalized(value) {
    return value.trim().toLocaleLowerCase();
}
/** Filter provider groups by provider name/id or model name/id/description. */
export function filterModelGroups(groups, query) {
    const needle = normalized(query);
    if (needle === '')
        return groups.map(group => ({ ...group, models: group.models }));
    return groups.flatMap((group) => {
        const providerMatches = normalized(group.name).includes(needle) || normalized(group.id).includes(needle);
        const models = providerMatches
            ? group.models
            : group.models.filter(model => [model.name, model.id, model.description ?? '']
                .some(value => normalized(value).includes(needle)));
        return models.length === 0 ? [] : [{ ...group, models }];
    });
}
//# sourceMappingURL=model-search.js.map