# DSH Session Header

## Background / Problem

ZenMux usage logs can group model calls into an agent conversation only when inference requests carry `x-zenmux-session-id`. DSH already places the current conversation ID in `GenerateOptions.sessionId`, but the pi-ai provider profile accepts only static headers and therefore cannot map that value into a request header.

## Goals

- Add `x-zenmux-session-id` to every inference request routed through `zenmux` or `zenmux-models`.
- Use the exact DSH `GenerateOptions.sessionId`.
- Keep concurrent sessions isolated.
- Preserve existing request headers.

## Non-goals

- Add the header to OAuth, model-catalog, or non-ZenMux requests.
- Generate a replacement ID when DSH does not provide a session ID.
- Modify DSH or pi-ai packages.

## Affected Files / Modules

- `src/session-header.ts`: LLM middleware, async session propagation, and scoped fetch header injection.
- `src/index.ts`: optional `llm` service attachment.
- `package.json`: declares the DSH LLM peer and development dependency.
- `tests/session-header.spec.ts`: verifies ZenMux-only header injection and header preservation.

## Data / API Changes

ZenMux inference requests gain one HTTP header:

```text
x-zenmux-session-id: <current DSH session id>
```

No public command, configuration, or persisted data shape changes.

## Control Flow

1. The plugin attaches to DSH's optional `llm` service.
2. An `llm/stream` middleware checks the provider and `GenerateOptions.sessionId`.
3. For ZenMux routes, `AsyncLocalStorage` scopes that ID to each async iterator operation.
4. A lifecycle-bound `fetch` wrapper merges the request's existing headers and sets `x-zenmux-session-id`.
5. Other providers and plugin-side OAuth/catalog requests run without that async scope and remain unchanged.

## Edge Cases

- Requests without `sessionId` are passed through unchanged.
- Concurrent sessions receive their own IDs through isolated async contexts.
- An existing `x-zenmux-session-id` is replaced by the authoritative DSH session ID.
- Plugin disposal removes the middleware and restores `fetch` when the installed wrapper is still active.

## Validation

- Build and run the complete test suite.
- Verify a ZenMux adapter request receives the session header.
- Verify existing headers remain present.
- Verify a non-ZenMux adapter request does not receive the header.

## Rollout / Backward Compatibility

The change is additive and requires no settings migration. Older DSH calls without `GenerateOptions.sessionId` retain previous behavior.

## Open Questions

None.
