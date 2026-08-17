# DSH ZenMux Model Catalog and Search

## Background / Problem

The ZenMux DSH bundle originally exposed only two manually declared DeepSeek models through an Anthropic Messages route. Expanding the provider to the full ZenMux catalog makes DSH's unfiltered composer menu impractical, while replacing the existing route would silently change the wire protocol of already-selected sessions.

## Goals

- Bundle every text model returned by ZenMux `GET /api/v1/models` at release time.
- Route every model advertised by `/api/anthropic/v1/models` through Anthropic Messages with prompt-cache controls.
- Put only the remaining OpenAI-only text models on the OpenAI-compatible route, with no duplicate IDs between groups.
- Add a searchable DSH composer model selector without modifying upstream DSH packages.
- Search case-insensitively across provider name/id and model name/id/description.
- Keep catalog generation deterministic, reviewable, and testable.

## Non-goals

- Route embedding, image-generation, or transcription models through DSH's language-model seam.
- Fetch and mutate the model catalog during DSH startup.
- Replace DSH's `/model` command popup or Settings model-discovery workflow.
- Change OAuth scopes, token storage, refresh, or logout behavior.

## Affected Files / Modules

- `cordis.patch.yml`: contains generated, disjoint Anthropic and OpenAI catalogs.
- `scripts/sync-zenmux-models.mjs`: validates both listing endpoints, maps metadata, partitions by protocol, and replaces both marked generated blocks.
- `src/model-search.ts`: pure provider/model filtering.
- `src/model-search-client.tsx`: searchable composer selector registered at a lower single-slot priority than DSH's built-in selector.
- `src/client.ts` and `package.json`: client service/dependency wiring.
- `tests/model-catalog.spec.ts`, `tests/model-search.spec.ts`, and `tests/loader-composition.spec.ts`: generation, matching, and bundle coverage.

## Data Model / API Changes

No ZenMux server API changes are introduced. The package adds a DSH provider route:

- Provider ID: `zenmux-models`
- Display name: `ZenMux · OpenAI`
- Protocol: `openai-completions`
- Base URL: `ZENMUX_API_BASE_URL` or `https://zenmux.ai/api/v1`
- Credential reference: `ZENMUX_OAUTH_ACCESS_TOKEN`

The `zenmux` route keeps the `ZenMux · Anthropic` display name, `anthropic-messages`, `/api/anthropic`, and `cacheRetention: short`. The generator reads each listing entry's `id`, `display_name`, `context_length`, `input_modalities`, `output_modalities`, and `capabilities.reasoning`. It retains text-output models, preserves endpoint order, and removes every Anthropic-supported ID from the OpenAI catalog.

## Control Flow

1. Before release, `pnpm sync:models` fetches the OpenAI and Anthropic model listings.
2. The generator validates both `data` arrays, selects text-output entries, assigns shared IDs to Anthropic, and assigns only the remainder to OpenAI.
3. DSH Loader merges both generated routes into the pi-ai adapter. Anthropic requests receive native prompt caching and thinking budgets; OpenAI-only models use Chat Completions.
4. In DSH Web, the ZenMux client waits for the upstream `modelDirectories` service, then registers a priority `-10` occupant for the single `conversation.input.model` slot. Lower priority wins DSH slot shadowing, so the searchable component replaces the visual occupant while reusing the same per-session directory and `selectModel` action.
5. Search filtering is browser-local and never changes Host catalog state or sends a request.

## Edge Cases

- Either live catalog becoming empty aborts generation instead of deleting a bundled list.
- YAML strings use single-quote escaping so display names cannot change the generated structure.
- Embedding, image, and transcription entries are excluded even though the general OpenAI-compatible listing may advertise them.
- Addressed subagent sessions remain unavailable for model selection, matching upstream DSH behavior.
- Selection failures retain the previous selection and surface the directory error.
- Clearing or closing the selector resets the query; provider matches retain the provider's whole model group.

## Validation Plan

- Run `pnpm check:models` against both live endpoints.
- Run `pnpm test` for TypeScript build, OAuth regression coverage, loader composition, catalog generation, and search filtering.
- Pack and install the local artifact into the DSH Web profile.
- Verify the Host publishes 126 Anthropic and 24 OpenAI-only models, Fable 5 appears only under Anthropic, and search/selection still use the shared directory.

## Rollout / Backward Compatibility

The provider IDs and OAuth credential reference remain unchanged. Models previously selected from `zenmux-models` may need one explicit reselection when their catalog row moves to `zenmux`; DSH intentionally does not rewrite persisted provider IDs. The built-in selector remains a fallback if the ZenMux client unloads. Runtime startup remains deterministic and does not depend on listing availability.

## Open Questions

None.
