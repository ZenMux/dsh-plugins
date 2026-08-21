# OAuth wake refresh

## Background

Node timers pause while a laptop sleeps. After wake, DSH Web can submit a model
request before the scheduled OAuth refresh completes, briefly exposing an
expired access token as `API key is invalid`.

## Goals

- Refresh an expired or near-expiry token when DSH Web becomes active.
- Make the browser OAuth status endpoint wait for that refresh.
- Preserve the existing scheduled refresh and credential format.

## Non-goals

- Change the OAuth server, token rotation, model request pipeline, or login flow.

## Affected files

- `src/index.ts`: refresh before returning OAuth status.
- `src/client.ts`: probe OAuth status on mount and visibility restoration.
- `tests/zenmux-oauth.spec.ts`, `tests/client.spec.ts`: wake-refresh coverage.

## Control flow

On initial Web mount or `visibilitychange` to visible, the client calls the
credential-free status endpoint. If the stored token is inside the configured
refresh skew, the controller serializes a refresh through its existing queue,
persists the rotated token set and access-token mirror, then returns status.
Concurrent status calls re-check expiry inside the queue to avoid duplicate
refresh-token rotation.

## Edge cases

- Hidden pages do not probe.
- A failed wake refresh is logged and returned to the existing retry scheduler.
- Missing OAuth state and separately configured manual credentials are unchanged.

## Validation

- Unit test expired-token refresh through the real browser-status route.
- Unit test initial and visibility-restored client probes.
- Run the complete package test suite and package build.

## Rollout and compatibility

This is backward-compatible with existing credentials and DSH `0.1.0-rc.6+`.
No migration is required.

## Open questions

None.
