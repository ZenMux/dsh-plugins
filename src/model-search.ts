/** Minimal model shapes needed by the browser-side selector search. */
export interface SearchableModel {
  readonly id: string
  readonly name: string
  readonly description?: string
}

export interface SearchableModelGroup<Model extends SearchableModel = SearchableModel> {
  readonly id: string
  readonly name: string
  readonly models: readonly Model[]
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase()
}

/** Filter provider groups by provider name/id or model name/id/description. */
export function filterModelGroups<Group extends SearchableModelGroup>(
  groups: readonly Group[],
  query: string,
): SearchableModelGroup<Group['models'][number]>[] {
  const needle = normalized(query)
  if (needle === '') return groups.map(group => ({ ...group, models: group.models }))

  return groups.flatMap((group) => {
    const providerMatches = normalized(group.name).includes(needle) || normalized(group.id).includes(needle)
    const models = providerMatches
      ? group.models
      : group.models.filter(model => [model.name, model.id, model.description ?? '']
          .some(value => normalized(value).includes(needle)))
    return models.length === 0 ? [] : [{ ...group, models }]
  })
}
