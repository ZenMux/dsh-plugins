# ZenMux for DeepSeek Harness

[English](https://github.com/ZenMux/dsh-plugins/blob/main/README.md) · [GitHub](https://github.com/ZenMux/dsh-plugins) · [ZenMux](https://zenmux.ai)

在 DeepSeek Harness（DSH）中直接使用 ZenMux 模型，无需复制 API Key。通过浏览器完成 OAuth 登录，在模型选择器中搜索完整目录，并由插件为模型选择支持缓存的协议。

## 功能

- 浏览器 OAuth 登录与自动 Token 刷新。
- 当前随包目录包含 150 个可搜索的文本模型。
- 126 个模型通过 Anthropic Messages 调用，并启用提示词缓存控制。
- 24 个仅支持 OpenAI 的模型通过 Chat Completions 调用。
- 提供 `/zenmux login`、`/zenmux status`、`/zenmux logout` 命令。

## 安装

```sh
dsh plugin --profile web add @zenmux/dsh-plugins@latest
dsh web
```

## 登录

在 DSH 对话中运行：

```text
/zenmux login
```

在浏览器中批准 ZenMux 授权，然后返回 DSH。使用 `/zenmux status` 查看连接状态；使用 `/zenmux logout` 退出当前安装实例。

## 选择模型

打开模型选择器，可按模型名称或 ID 搜索。

- **ZenMux · Anthropic**：通过 Anthropic Messages 调用并支持提示词缓存；Claude Fable 5 位于这个分组。
- **ZenMux · OpenAI**：其余仅支持 OpenAI 的模型。

首次满足条件的 Anthropic 请求可能产生 cache creation；后续具有相同前缀的请求才会产生 cache read。

## 更新

退出正在运行的 DSH，更新插件后重新启动：

```sh
dsh plugin --profile web add @zenmux/dsh-plugins@latest
dsh web
```

检查版本：

```sh
dsh plugin --profile web list --depth 0
```

## 常见问题

### 已是最新版，但仍只有几个模型

旧的手工模型配置覆盖了插件目录。在 `~/.dsh/settings.yaml` 中，只删除 `llm-pi-ai.providers.zenmux` 和 `llm-pi-ai.providers.zenmux-models` 下的 `models:` 数组，然后重启 DSH。不要删除凭据引用或其他 provider。

### 出现 `API key is invalid` 或 `AUTH`

重新运行 `/zenmux login`。

### 网络或 TLS 错误

OAuth 请求默认直连，也支持显式 HTTP(S)/SOCKS 代理。使用自定义 TLS 中间代理时，可能还需要在 DSH 启动前设置 `NODE_EXTRA_CA_CERTS`。高级部署细节见 [实现与发布说明](https://github.com/ZenMux/dsh-plugins/tree/main/docs/sdd)。

## 开发

```sh
pnpm install
pnpm test
```

模型目录是从 ZenMux 的 OpenAI 与 Anthropic 模型列表端点生成的发布快照。源码与问题追踪位于 [ZenMux/dsh-plugins](https://github.com/ZenMux/dsh-plugins)。

MIT License
