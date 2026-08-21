# OAuth refresh on credential use

## Background

Timer-driven refresh can be delayed while a laptop sleeps. After wake, DSH can
submit a model request before the timer completes and expose an expired access
token as `API key is invalid`.

## Goals

- Check and refresh an expired or near-expiry token every time a consumer
  resolves the OAuth access-token credential.
- Preserve the credential format and existing provider configuration.

## Non-goals

- Change the OAuth server, token rotation, model request pipeline, or login flow.

## Affected files

- `src/index.ts`: wrap the credential provider's per-operation `resolve` seam.
- `tests/zenmux-oauth.spec.ts`: per-use refresh coverage.

## Control flow

DSH consumers resolve credentials once per model operation. For the configured
ZenMux access-token reference, the plugin serializes an expiry check through its
existing queue. If the token is inside the refresh skew, it refreshes and
persists the rotated token set before returning the credential. Concurrent
resolutions re-check expiry inside the queue to avoid duplicate rotation.

## Edge cases

- Non-ZenMux credential references pass through unchanged.
- A refresh failure rejects credential resolution instead of returning an
  expired token.
- Missing OAuth state and separately configured manual credentials are unchanged.

## Validation

- Unit test expired-token refresh through credential resolution.
- Verify a second resolution reuses the refreshed token without rotating again.
- Run the complete package test suite and package build.

## Rollout and compatibility

This is backward-compatible with existing credentials and DSH `0.1.0-rc.6+`.
No migration is required.

## Open questions

None.
