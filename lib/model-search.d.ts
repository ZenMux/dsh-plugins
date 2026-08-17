/** Minimal model shapes needed by the browser-side selector search. */
export interface SearchableModel {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
}
export interface SearchableModelGroup<Model extends SearchableModel = SearchableModel> {
    readonly id: string;
    readonly name: string;
    readonly models: readonly Model[];
}
/** Filter provider groups by provider name/id or model name/id/description. */
export declare function filterModelGroups<Group extends SearchableModelGroup>(groups: readonly Group[], query: string): SearchableModelGroup<Group['models'][number]>[];
//# sourceMappingURL=model-search.d.ts.map