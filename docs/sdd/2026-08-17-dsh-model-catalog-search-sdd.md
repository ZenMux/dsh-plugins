# DSH ZenMux Model Catalog and Search

## Background / Problem

The ZenMux DSH bundle originally exposed only two manually declared DeepSeek models through an Anthropic Messages route. Expanding the provider to the full ZenMux catalog makes DSH's unfiltered composer menu impractical, while replacing the existing route would silently change the wire protocol of already-selected sessions.

## Goals

- Bundle every language model returned by ZenMux `GET /api/v1/models` at release time.
- Preserve the existing `zenmux` Anthropic route and its provider ID for backward compatibility.
- Add a searchable DSH composer model selector without modifying upstream DSH packages.
- Search case-insensitively across provider name/id and model name/id/description.
- Keep catalog generation deterministic, reviewable, and testable.

## Non-goals

- Route embedding, image-generation, or transcription models through DSH's language-model seam.
- Fetch and mutate the model catalog during DSH startup.
- Replace DSH's `/model` command popup or Settings model-discovery workflow.
- Change OAuth scopes, token storage, refresh, or logout behavior.

## Affected Files / Modules

- `cordis.patch.yml`: retains `zenmux` and adds the generated `zenmux-models` OpenAI-compatible provider route.
- `scripts/sync-zenmux-models.mjs`: validates `/models`, selects text-output entries, maps supported metadata, and replaces only the marked generated block.
- `src/model-search.ts`: pure provider/model filtering.
- `src/model-search-client.tsx`: searchable composer selector registered at a lower single-slot priority than DSH's built-in selector.
- `src/client.ts` and `package.json`: client service/dependency wiring.
- `tests/model-catalog.spec.ts`, `tests/model-search.spec.ts`, and `tests/loader-composition.spec.ts`: generation, matching, and bundle coverage.

## Data Model / API Changes

No ZenMux server API changes are introduced. The package adds a DSH provider route:

- Provider ID: `zenmux-models`
- Display name: `ZenMux`
- Protocol: `openai-completions`
- Base URL: `ZENMUX_API_BASE_URL` or `https://zenmux.ai/api/v1`
- Credential reference: `ZENMUX_OAUTH_ACCESS_TOKEN`

The generator reads each `/models` entry's `id`, `display_name`, `context_length`, `input_modalities`, `output_modalities`, and `capabilities.reasoning`. It retains only entries whose output modalities include `text`. DSH supports text and image input, so other advertised input modalities are not copied. The endpoint order is preserved and duplicate/invalid IDs are skipped.

## Control Flow

1. Before release, `pnpm sync:models` fetches the current ZenMux `/models` response.
2. The generator validates the top-level `data` array, selects text-output entries, and renders a deterministic YAML catalog between explicit markers in `cordis.patch.yml`.
3. DSH Loader merges both ZenMux routes into the existing pi-ai adapter. Existing `zenmux` selections retain Anthropic Messages; new catalog selections use `zenmux-models` with OpenAI Chat Completions.
4. In DSH Web, the ZenMux client waits for the upstream `modelDirectories` service, then registers a priority `-10` occupant for the single `conversation.input.model` slot. Lower priority wins DSH slot shadowing, so the searchable component replaces the visual occupant while reusing the same per-session directory and `selectModel` action.
5. Search filtering is browser-local and never changes Host catalog state or sends a request.

## Edge Cases

- A live catalog with no text-output entries aborts generation instead of deleting the bundled list.
- YAML strings use single-quote escaping so display names cannot change the generated structure.
- Embedding, image, and transcription entries are excluded even though the general OpenAI-compatible listing may advertise them.
- Addressed subagent sessions remain unavailable for model selection, matching upstream DSH behavior.
- Selection failures retain the previous selection and surface the directory error.
- Clearing or closing the selector resets the query; provider matches retain the provider's whole model group.

## Validation Plan

- Run `pnpm check:models` against the live endpoint.
- Run `pnpm test` for TypeScript build, OAuth regression coverage, loader composition, catalog generation, and search filtering.
- Pack and install the local artifact into the DSH Web profile.
- Verify the Host publishes the generated ZenMux group, the composer renders one model selector, search narrows by both display name and ID, and a selection still submits through the shared directory.

## Rollout / Backward Compatibility

The `zenmux` provider ID, its two DeepSeek entries, Anthropic endpoint, and OAuth credential reference remain unchanged. The new route is additive. The built-in selector remains installed as a higher-priority fallback and becomes visible again if the ZenMux client contribution unloads. A future release refreshes the checked-in catalog explicitly; runtime startup remains deterministic and does not depend on ZenMux `/models` availability.

## Open Questions

None.
