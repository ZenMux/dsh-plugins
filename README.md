# @zenmux/dsh-plugins

English | [中文](README.zh.md)

ZenMux OAuth 2.0 Authorization Code login with PKCE S256 for interactive Harness deployments. The plugin registers `/zenmux [login|status|logout]`, receives the authorization response on a single-use `127.0.0.1` loopback listener, persists the versioned access/refresh token set through `ctx.credentials`, and refreshes before expiry.

## Install in DSH

Install the published npm bundle into the DSH Web profile, then start DSH normally:

```sh
dsh plugin --profile web add @zenmux/dsh-plugins
dsh web
```

For repository testing, use `dsh plugin --profile web add github:ZenMux/dsh-plugins` instead.

The package declares `dsh.bundle.patch`, so the plugin manager adds its `cordis.patch.yml` automatically. The patch mounts the `zenmux` OAuth controller and adds a `zenmux` provider to DSH's existing pi-ai adapter. It does not inject deployment-specific proxy configuration or replace the built-in DeepSeek route.

## Login

Run `/zenmux login`; DSH Web opens the returned ZenMux authorization URL in a new tab and also renders an **Open ZenMux login** fallback link. Approve access and return after the callback page says **ZenMux connected**. `/zenmux status` reports connection and expiry without returning tokens. `/zenmux logout` attempts remote refresh-token revocation, clears the stored OAuth set, and removes the mirrored access token only when it still matches the OAuth-owned value.

The bundled public client uses the registered callback `http://127.0.0.1:<ephemeral-port>/callback` and requests `inference:invoke offline_access`. Set `ZENMUX_OAUTH_NO_BROWSER=1` to keep the manual link without automatically opening a new tab. The listener rejects other paths, mismatched state, duplicate callbacks, and callbacks after `loginTimeoutMs`; it binds only to loopback and closes after one accepted response or timeout.

ZenMux discovery, token, and revocation requests connect directly by default. Deployments that require a proxy may set `proxyUrl` explicitly in their DSH profile or export `HTTPS_PROXY`/`https_proxy`; explicit plugin config takes priority. HTTP, HTTPS, and remote-DNS SOCKS proxy URLs are accepted. Browser traffic must be able to reach the same authorization service independently. If the configured route terminates TLS with a local CA, add the CA before Node starts, for example `NODE_EXTRA_CA_CERTS=/absolute/path/to/ca.pem dsh web`. Do not use `NODE_TLS_REJECT_UNAUTHORIZED=0`: disabling verification would expose authorization codes and refresh tokens.

## ZenMux model route

The bundle supplies this provider profile to DSH's existing `llm-pi-ai` entry:

```yaml
llm-pi-ai:
  providers:
    zenmux:
      displayName: ZenMux
      baseURL: https://zenmux.ai/api/anthropic
      api: anthropic-messages
      apiKeyEnv: ZENMUX_OAUTH_ACCESS_TOKEN
      cacheRetention: short
      thinkingBudgets:
        minimal: 1024
        low: 2048
        medium: 5120
        high: 10240
      models:
        - id: deepseek/deepseek-v4-pro
          name: ZenMux · DeepSeek V4 Pro
          reasoningEfforts:
            off: null
            minimal: minimal
            low: low
            medium: medium
            high: high
        - id: deepseek/deepseek-v4-flash
          name: ZenMux · DeepSeek V4 Flash
          reasoningEfforts:
            off: null
            minimal: minimal
            low: low
            medium: medium
            high: high
```

After login, select **ZenMux · DeepSeek V4 Pro** or **ZenMux · DeepSeek V4 Flash** in the model selector. This route deliberately prefers Anthropic Messages so DSH/pi-ai can apply native Anthropic prompt caching and thinking budgets. DSH's default remains the official DeepSeek route, so an existing conversation does not silently change providers. If `accessTokenRef` is customized, apply that same reference to `llm-pi-ai.providers.zenmux.apiKeyEnv`; do not paste an OAuth token into the model form.

The bundled models are safe starting entries. In **Settings → Models**, the ZenMux provider's `models` array can be replaced, edited, or extended with any ZenMux model IDs and their capacities/reasoning levels. Current DSH automatic model discovery supports OpenAI-compatible `/models` routes but not `anthropic-messages`, so this Anthropic-first route uses manual model entries rather than presenting a broken refresh action.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `oauthOrigin` | `ZENMUX_OAUTH_ORIGIN` or `https://zenmux.ai` | Authorization-server origin; HTTPS is required except for loopback development |
| `clientId` | ZenMux Harness public client | Registered public OAuth client id |
| `scopes` | `inference:invoke`, `offline_access` | Required inference and refresh scopes |
| `callbackPort` | `0` | Loopback port; zero selects a free OS port |
| `proxyUrl` | empty | Optional deployment-supplied `http://`, `https://`, `socks4a://`, or `socks5h://` proxy; otherwise inherits `HTTPS_PROXY`/`https_proxy`, then connects directly |
| `browserAutoOpen` | disabled only when `ZENMUX_OAUTH_NO_BROWSER=1` | Automatically open the login URL in DSH Web while retaining the manual link |
| `accessTokenRef` | `ZENMUX_OAUTH_ACCESS_TOKEN` | Raw access-token mirror read by the LLM provider |
| `tokenSetRef` | `ZENMUX_OAUTH_TOKENS` | Versioned JSON access/refresh token set |
| `loginTimeoutMs` | `300000` | Pending loopback-login lifetime |
| `requestTimeoutMs` | `30000` | Discovery, token, and revocation request timeout |
| `refreshSkewMs` | `60000` | Refresh lead time before expiry |
| `refreshRetryMs` | `30000` | Delay between failed background refresh attempts |

Both credential references must be distinct writable references. Environment-supplied credentials are intentionally read-only in [`dsh-credentials-local`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/credentials/credentials-local); choose unshadowed references rather than expecting OAuth login to overwrite an exported variable.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ZENMUX_OAUTH_ORIGIN` | `https://zenmux.ai` | OAuth authorization-server origin |
| `ZENMUX_OAUTH_CLIENT_ID` | bundled public client | Override the OAuth public client ID |
| `ZENMUX_OAUTH_SCOPES` | `inference:invoke offline_access` | Whitespace-separated login scopes |
| `ZENMUX_API_BASE_URL` | `https://zenmux.ai/api/v1` | Generic ZenMux API base; its origin is used to derive `/api/anthropic` |
| `ZENMUX_ANTHROPIC_BASE_URL` | derived from `ZENMUX_API_BASE_URL` | Exact Anthropic Messages endpoint override |
| `ZENMUX_OAUTH_NO_BROWSER` | unset | Set to `1` to suppress automatic browser opening |
| `HTTPS_PROXY` / `https_proxy` | unset | OAuth discovery/token/revocation proxy when `proxyUrl` is empty |

`CODEX_HOME`, `ZENMUX_OAUTH_STATE_DIR`, and `ZENMUX_OAUTH_STORAGE` belong to Codex-style file/keychain clients and are intentionally not consumed: DSH owns persistence through its credentials service. `ZENMUX_MODELS_CATALOG_URL` is also not consumed until upstream DSH supports discovery for `anthropic-messages`; accepting it without changing behavior would be misleading.

## Persistence and refresh

The plugin discovers endpoints from `<oauthOrigin>/.well-known/oauth-authorization-server` and accepts metadata only when the issuer and every credential-bearing endpoint remain on that configured origin. It requires HTTPS except for loopback development, authorization-code and refresh grants, public-client token authentication, and PKCE S256.

One JSON credential stores `accessToken`, `refreshToken`, `tokenType`, `expiresAt`, optional scope, and format version. A token exchange commits that recoverable set before updating the raw access-token mirror; startup repairs the mirror when a process stopped between those writes. Refresh-token rotation replaces the stored refresh token, while a response that omits it preserves the current one. Failed background refresh retries at `refreshRetryMs` without deleting the last token set.

## Model Experience

### Provider authorization

#### What the model sees

No OAuth state, token, expiry, or command result. The consuming LLM adapter uses the mirrored access token only as the provider request's `Authorization: Bearer …` header.

#### Token effect

Zero direct token effect; authentication data is absent from model input and retained history.

#### KV Cache effect

The bundled Anthropic route requests `cacheRetention: short`. DSH/pi-ai adds Anthropic ephemeral cache control to eligible prompt blocks; actual cache reads/writes still depend on the selected model and ZenMux upstream response. OAuth itself changes only request headers and does not alter the model-visible prefix.

## Known Limitations and Deferred Work

- **Two bundled model entries** — the package declares `deepseek/deepseek-v4-pro` and `deepseek/deepseek-v4-flash`; users can replace the `models` array in DSH Settings, but automatic discovery is unavailable on the Anthropic protocol today.
- **Interactive command adapters only** — the shipped Web app can run `/zenmux`; headless and automation deployments that do not consume `ctx.commands` cannot initiate browser login, though they can use a token set created by another interactive run over the same Harness home.
- **Proxy availability is deployment-owned** — login and refresh fail closed when the configured SOCKS proxy is unavailable; the plugin does not silently fall back to a direct connection.
