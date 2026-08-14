# dsh-zenmux-oauth

English | [中文](README.zh.md)

ZenMux OAuth 2.0 Authorization Code login with PKCE S256 for interactive Harness deployments. The plugin registers `/zenmux [login|status|logout]`, receives the authorization response on a single-use `127.0.0.1` loopback listener, persists the versioned access/refresh token set through `ctx.credentials`, and refreshes before expiry.

## Install in DSH

Install the bundle from GitHub into the published DSH Web profile, then start DSH normally:

```sh
dsh plugin --profile web add github:ilimei/dsh-zenmux-oauth
dsh web
```

After the package is published to npm, the shorter package spec will also work: `dsh plugin --profile web add dsh-zenmux-oauth`.

The package declares `dsh.bundle.patch`, so the plugin manager adds its `cordis.patch.yml` automatically. That patch mounts an otherwise idle controller and sets `proxyUrl` to `socks5h://127.0.0.1:1080`. Installing the package does not modify DSH's built-in base bundle.

## Login

Run `/zenmux login`, open the returned ZenMux URL, approve access, and return after the callback page says **ZenMux connected**. `/zenmux status` reports connection and expiry without returning tokens. `/zenmux logout` attempts remote refresh-token revocation, clears the stored OAuth set, and removes the mirrored access token only when it still matches the OAuth-owned value.

The bundled public client uses the registered callback `http://127.0.0.1:<ephemeral-port>/callback` and requests `inference:invoke offline_access`. The listener rejects other paths, mismatched state, duplicate callbacks, and callbacks after `loginTimeoutMs`; it binds only to loopback and closes after one accepted response or timeout.

The installed plugin bundle routes ZenMux discovery, token, and revocation requests through `socks5h://127.0.0.1:1080`; the `h` form keeps DNS resolution on the proxy side. Browser traffic must use the same route through the browser or system proxy. If that route terminates TLS with a local CA, add the CA before Node starts, for example `NODE_EXTRA_CA_CERTS=/absolute/path/to/ca.pem dsh web`. Do not use `NODE_TLS_REJECT_UNAUTHORIZED=0`: disabling verification would expose authorization codes and refresh tokens.

## LLM provider configuration

OAuth authentication and model routing remain separate. Point a pi-ai custom provider at ZenMux and name the mirrored credential:

```yaml
llm-pi-ai:
  providers:
    zenmux:
      displayName: ZenMux
      baseURL: https://zenmux.ai/api/v1
      api: openai-completions
      apiKeyEnv: ZENMUX_OAUTH_ACCESS_TOKEN
      models:
        - id: deepseek/deepseek-v4-flash
          name: DeepSeek V4 Flash through ZenMux
```

The Models page may create the same profile. Keep `apiKeyEnv` set to the configured `accessTokenRef`; do not paste an OAuth token into the model form.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `clientId` | ZenMux Harness public client | Registered public OAuth client id |
| `scopes` | `inference:invoke`, `offline_access` | Required inference and refresh scopes |
| `callbackPort` | `0` | Loopback port; zero selects a free OS port |
| `proxyUrl` | empty | Optional `socks4a://` or `socks5h://` proxy; the plugin bundle sets `socks5h://127.0.0.1:1080` |
| `accessTokenRef` | `ZENMUX_OAUTH_ACCESS_TOKEN` | Raw access-token mirror read by the LLM provider |
| `tokenSetRef` | `ZENMUX_OAUTH_TOKENS` | Versioned JSON access/refresh token set |
| `loginTimeoutMs` | `300000` | Pending loopback-login lifetime |
| `requestTimeoutMs` | `30000` | Discovery, token, and revocation request timeout |
| `refreshSkewMs` | `60000` | Refresh lead time before expiry |
| `refreshRetryMs` | `30000` | Delay between failed background refresh attempts |

Both credential references must be distinct writable references. Environment-supplied credentials are intentionally read-only in [`dsh-credentials-local`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/credentials/credentials-local); choose unshadowed references rather than expecting OAuth login to overwrite an exported variable.

## Persistence and refresh

The plugin discovers endpoints from `https://zenmux.ai/.well-known/oauth-authorization-server` and accepts metadata only when the issuer and every credential-bearing endpoint remain on the HTTPS ZenMux origin. It requires authorization-code and refresh grants, public-client token authentication, and PKCE S256.

One JSON credential stores `accessToken`, `refreshToken`, `tokenType`, `expiresAt`, optional scope, and format version. A token exchange commits that recoverable set before updating the raw access-token mirror; startup repairs the mirror when a process stopped between those writes. Refresh-token rotation replaces the stored refresh token, while a response that omits it preserves the current one. Failed background refresh retries at `refreshRetryMs` without deleting the last token set.

## Model Experience

### Provider authorization

#### What the model sees

No OAuth state, token, expiry, or command result. The consuming LLM adapter uses the mirrored access token only as the provider request's `Authorization: Bearer …` header.

#### Token effect

Zero direct token effect; authentication data is absent from model input and retained history.

#### KV Cache effect

None; authentication changes request headers rather than the model-visible request prefix.

## Known Limitations and Deferred Work

- **Provider setup remains explicit** — login stores credentials but does not choose a ZenMux model catalog or mutate `llm-pi-ai` settings, because available model ids and routing preferences belong to the provider profile.
- **Interactive command adapters only** — the shipped Web app can run `/zenmux`; headless and automation deployments that do not consume `ctx.commands` cannot initiate browser login, though they can use a token set created by another interactive run over the same Harness home.
- **Proxy availability is deployment-owned** — login and refresh fail closed when the configured SOCKS proxy is unavailable; the plugin does not silently fall back to a direct connection.
