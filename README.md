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

```sh
dsh plugin --profile web add @zenmux/dsh-plugins@latest
dsh web
```

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

Quit the running DSH process, update the plugin, then restart DSH:

```sh
dsh plugin --profile web add @zenmux/dsh-plugins@latest
dsh web
```

Confirm the installed version with:

```sh
dsh plugin --profile web list --depth 0
```

## Troubleshooting

### The latest plugin still shows only a few models

An older manual model list is overriding the bundled catalog. In `~/.dsh/settings.yaml`, remove only the `models:` arrays under `llm-pi-ai.providers.zenmux` and `llm-pi-ai.providers.zenmux-models`, then restart DSH. Keep credential references and unrelated providers.

### `API key is invalid` or `AUTH`

Run `/zenmux login` again.

### Network or TLS errors

OAuth requests connect directly by default and can use an explicit HTTP(S)/SOCKS proxy. Custom TLS interception may also require `NODE_EXTRA_CA_CERTS` before DSH starts. See the [implementation and rollout notes](https://github.com/ZenMux/dsh-plugins/tree/main/docs/sdd) for advanced deployment details.

## Development

```sh
pnpm install
pnpm test
```

Model catalogs are release snapshots generated from ZenMux's OpenAI and Anthropic model-list endpoints. Source and issue tracking live at [ZenMux/dsh-plugins](https://github.com/ZenMux/dsh-plugins).

MIT License
