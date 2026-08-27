# DSH ZenMux Runtime Model Refresh

## Background / Problem

The plugin's bundled catalog is a release snapshot, so newly published ZenMux models are absent until a plugin release. DSH's generic discovery reads only OpenAI-compatible routes and cannot refresh the Anthropic route.

## Goals

- Add `/zenmux models refresh` to fetch both ZenMux model listings with the current OAuth token.
- Persist the refreshed provider model arrays through DSH settings so a restart applies them.
- Keep the existing configuration when either listing fails or returns no usable models.

## Non-goals

- Runtime mutation of the active pi-ai adapter without restart.
- Changing OAuth scopes or exposing credentials in command output.
- Refreshing arbitrary non-ZenMux providers.

## Affected files

- `src/model-refresh.ts`: validates and partitions OpenAI and Anthropic listing payloads.
- `src/index.ts`: authenticated refresh command and settings persistence.

## Control flow and API

The command refreshes the OAuth token, requests `/api/v1/models` and `/api/anthropic/v1/models`, filters text-output entries, removes duplicate Anthropic IDs from the OpenAI group, and updates namespace `llm-pi-ai` provider overrides. The command reports counts and instructs the user to restart DSH.

## Edge cases and validation

Malformed responses, HTTP failures, missing authentication, empty groups, and unavailable settings fail without writing. Validate with TypeScript compilation and unit tests for payload filtering/partitioning.

## Rollout / compatibility

Existing static catalogs remain the fallback. The user settings layer overrides only model arrays; provider endpoints, credentials, and protocol settings remain unchanged.
