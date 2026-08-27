export interface RefreshModel {
    readonly id: string;
    readonly name: string;
    readonly contextWindow?: number;
    readonly maxTokens?: number;
    readonly input: readonly string[];
    readonly reasoningEfforts?: Readonly<Record<string, string | null>>;
}
export declare function partitionRefreshModels(openaiPayload: unknown, anthropicPayload: unknown): {
    readonly anthropicModels: readonly RefreshModel[];
    readonly openaiOnlyModels: readonly RefreshModel[];
};
//# sourceMappingURL=model-refresh.d.ts.map