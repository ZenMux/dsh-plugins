# Optional proxy configuration

## Background

The published bundle patch supplied a machine-specific SOCKS endpoint. Installations without a listener at that address failed OAuth discovery before the login URL could be returned.

## Goals

- Mount the OAuth controller without injecting deployment-specific network settings.
- Keep `proxyUrl` as an optional, explicitly configured capability.
- Inherit `HTTPS_PROXY` or `https_proxy` when plugin configuration is empty.
- Use direct requests when neither source supplies a proxy.

## Non-goals

- Detect desktop or operating-system proxy settings.
- Select or discover a proxy endpoint automatically.
- Change OAuth, credential, or provider behavior.

## Affected files

- `cordis.patch.yml`: remove the bundled `proxyUrl` value.
- `tests/loader-composition.spec.ts`: prevent deployment config from returning to the bundle patch.
- `src/index.ts`: resolve explicit config before environment variables and support HTTP(S) proxy URLs.
- `package.json`: provide the HTTP(S) proxy transport.
- `README.md` and `README.zh.md`: document configuration priority and direct fallback.

## Control flow and edge cases

The bundle mounts the plugin with no config block. Resolution uses the first non-empty value from explicit `proxyUrl`, `HTTPS_PROXY`, and `https_proxy`. HTTP(S) URLs use an HTTPS tunneling agent, remote-DNS SOCKS URLs use the SOCKS agent, and requests use native `fetch` when all sources are empty. Invalid schemes fail during plugin initialization, and an unavailable selected proxy continues to fail closed.

## Validation and rollout

Build and run the unit and real-composition tests, inspect the packed artifact, and publish as `0.1.2`. Existing profiles that explicitly set `proxyUrl` retain their chosen route; profiles without it inherit the environment before connecting directly.

## Compatibility and open questions

There are no API or credential-format changes. No open questions remain.
