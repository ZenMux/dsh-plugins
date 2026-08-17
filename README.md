# ZenMux for DeepSeek Harness

[中文说明](https://github.com/ZenMux/dsh-plugins/blob/main/README.zh.md) · [GitHub](https://github.com/ZenMux/dsh-plugins) · [ZenMux](https://zenmux.ai)

Use ZenMux models in DeepSeek Harness (DSH) without copying an API key. Sign in through your browser, search the full model catalog, and let the plugin choose the cache-capable protocol for each model.

## Features

- Browser OAuth login with automatic token refresh.
- 150 searchable text models in the current bundled catalog.
- 126 models routed through Anthropic Messages with prompt-cache controls.
- 24 OpenAI-only models routed through Chat Completions.
- `/zenmux login`, `/zenmux status`, and `/zenmux logout` commands.

## Install

### DSH Desktop on macOS

Quit DSH Desktop completely, then run:

```sh
DSH_HOME="$HOME/Library/Application Support/DSH Desktop/dsh-home" \
dsh plugin --profile web add @zenmux/dsh-plugins@latest
```

Reopen DSH Desktop after installation.

### DSH CLI / Web

```sh
dsh plugin --profile web add @zenmux/dsh-plugins@latest
dsh web
```

Desktop and CLI use different DSH home directories. Install the plugin in each one you use.

## Sign in

In a DSH conversation, run:

```text
/zenmux login
```

Approve the ZenMux authorization page and return to DSH. Check the connection with `/zenmux status`; disconnect this installation with `/zenmux logout`.

## Choose a model

Open the model selector and search by model name or ID.

- **ZenMux · Anthropic**: cache-capable models using Anthropic Messages. Claude Fable 5 belongs here.
- **ZenMux · OpenAI**: the remaining OpenAI-only models.

The first eligible Anthropic request can create a prompt cache. Later requests with the same prefix can report cache reads.

## Update

Quit the running DSH process, repeat the matching install command with `@latest`, then restart DSH. Confirm the installed version with:

```sh
dsh plugin --profile web list --depth 0
```

For Desktop, prefix that command with the Desktop `DSH_HOME` shown above.

## Troubleshooting

### The latest plugin still shows only a few models

An older manual model list is overriding the bundled catalog. In the active DSH home's `settings.yaml`, remove only the `models:` arrays under `llm-pi-ai.providers.zenmux` and `llm-pi-ai.providers.zenmux-models`, then restart DSH. Keep credential references and unrelated providers.

### Desktop updated, but CLI did not (or the reverse)

They use separate DSH homes. Update the profile that belongs to the app you are running.

### `API key is invalid` or `AUTH`

Run `/zenmux login` in that installation. Each DSH home stores its own OAuth credentials.

### Network or TLS errors

OAuth requests connect directly by default and can use an explicit HTTP(S)/SOCKS proxy. Custom TLS interception may also require `NODE_EXTRA_CA_CERTS` before DSH starts. See the [implementation and rollout notes](https://github.com/ZenMux/dsh-plugins/tree/main/docs/sdd) for advanced deployment details.

## Development

```sh
pnpm install
pnpm test
```

Model catalogs are release snapshots generated from ZenMux's OpenAI and Anthropic model-list endpoints. Source and issue tracking live at [ZenMux/dsh-plugins](https://github.com/ZenMux/dsh-plugins).

MIT License
