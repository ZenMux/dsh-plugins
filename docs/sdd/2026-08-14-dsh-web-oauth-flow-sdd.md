# DSH Web OAuth flow

## Background

The host command returns a ZenMux authorization URL, but DSH Web may not surface the corresponding command row. Users therefore see no response even though OAuth discovery succeeded.

## Goals

- Load a browser half from the same DSH plugin package.
- Open a successful `/zenmux login` authorization URL in a separate browser tab.
- Render a ZenMux-specific command card with a manual link when automatic popup handling is blocked.
- Refresh a waiting login card to the connected state without writing status probes into the conversation log.
- Prefer DSH's native Anthropic Messages route with prompt caching and selectable thinking levels.
- Support deployment OAuth/API environment overrides without embedding a proxy or test endpoint.

## Non-goals

- Change token persistence or proxy selection.
- Add a separate Web application or modify DSH's built-in packages.

## Affected files and contracts

- `src/client.ts`: DSH Web client plugin, safe URL extraction, popup, and command-row contribution.
- `tsdown.config.ts`: emits the DSH client-module wrapper at `lib/client.js`.
- `package.json`: declares the `./client` export and `dsh.client` dependency graph.
- `tests/client.spec.ts`: validates URL boundaries and popup arguments.
- `cordis.patch.yml`: names the plugin `zenmux` and supplies DeepSeek V4 Pro and V4 Flash through DSH's existing Anthropic Messages pi-ai adapter.
- `src/shared.ts`: browser auto-open and trusted-origin result markers shared by host/client halves.
- `src/index.ts`: optional DSH Web status route backed by the controller's in-memory OAuth state.

The host command includes its validated OAuth origin beside the authorization URL. The client observes the local `command/executed` acknowledgment and accepts only a successful HTTPS URL (or loopback HTTP development URL) whose origin exactly matches that marker. `ZENMUX_OAUTH_NO_BROWSER=1` adds an exact marker that suppresses auto-open while retaining the manual link.

## Control flow

1. DSH Web loads `@zenmux/dsh-plugins/client` through its client-module graph.
2. The user submits `/zenmux login`; the existing host plugin performs discovery and creates the loopback listener.
3. The Web client receives the successful command result and opens its validated authorization URL with `noopener,noreferrer`.
4. The durable command node uses the ZenMux card. Its link remains available when an automatic popup is blocked.
5. While a login card is waiting, it polls the same-origin `GET /zenmux/oauth/status` route once per second. The route is registered only when DSH's optional Web server service exists and returns no credentials.
6. Once the route reports a stored OAuth session, the card changes to `已连接`, shows the expiry detail, hides the login link, and stops polling. Replayed historical login cards follow the same path after a page reload.

## Edge cases

- Failed commands, non-ZenMux URLs, and other `/zenmux` subcommands never open a window.
- A URL whose origin differs from the host-emitted OAuth origin never opens.
- Replayed session logs render the link but do not trigger a new popup because `command/executed` is local-only.
- Status refreshes use the read-only Web route instead of `/zenmux status`, so they create no command lifecycle records. A missing Web route or transient request failure leaves the manual login state intact and retries for at most five minutes.
- Headless profiles do not provide `webServer`; optional Cordis injection therefore leaves their existing command-only behavior unchanged.
- Client-plugin unload removes both the listener and slot registration through Cordis lifecycle ownership.

## Validation and rollout

Run unit, loader-composition, package, and browser tests locally. Install the packed artifact into a local DSH Web profile, restart DSH, confirm the client bundle appears in `window.__DSH_BOOT__`, execute `/zenmux login`, and verify a ZenMux authorization tab plus the manual-link fallback before committing or publishing.

Release the two-model provider update as `0.1.4` only after the packed local artifact exposes both models and completes a real Anthropic Messages request through each one with a selectable reasoning level. Any alternate inference host used for local reachability testing belongs only in the local profile overlay and must not enter the package bundle or documentation.

## Compatibility and open questions

Headless DSH continues to load only the host half. DSH Web `0.1.0-rc.6` supplies the declared client dependencies. The provider route uses the OAuth mirror's default credential reference; deployments that change `accessTokenRef` must apply the same reference to `llm-pi-ai.providers.zenmux.apiKeyEnv`. DSH/pi-ai supports `cacheRetention` natively, but its current automatic catalog discovery excludes `anthropic-messages`; model-list edits therefore remain manual in Settings.
