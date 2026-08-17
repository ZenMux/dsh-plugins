# @zenmux/dsh-plugins

[English](README.md) | 中文

面向交互式 Harness 部署的 ZenMux OAuth 2.0 Authorization Code + PKCE S256 登录插件。插件注册 `/zenmux [login|status|logout]`，通过一次性的 `127.0.0.1` loopback 监听器接收授权响应，经 `ctx.credentials` 持久化带版本的 access/refresh token 集合，并在到期前刷新。

## 安装到 DSH

把已发布的 npm bundle 安装到 DSH Web profile，然后照常启动：

```sh
dsh plugin --profile web add @zenmux/dsh-plugins
dsh web
```

测试 GitHub 仓库版本时，改用 `dsh plugin --profile web add github:ZenMux/dsh-plugins`。

这个包声明了 `dsh.bundle.patch`，所以插件管理器会自动加入它的 `cordis.patch.yml`。该 patch 会挂载名为 `zenmux` 的 OAuth 控制器，并把 ZenMux 文本模型按协议拆到 Anthropic Messages 路由与 OpenAI 兼容兜底路由；它不会注入部署相关的代理配置，也不会替换内置 DeepSeek 路由。

## 登录

运行 `/zenmux login`；DSH Web 会在新标签页打开返回的 ZenMux 授权 URL，同时保留一个 **打开 ZenMux 登录** 的备用链接。批准访问，并在回调页面显示 **ZenMux connected** 后返回。`/zenmux status` 只报告连接状态与到期时间，不返回 token。`/zenmux logout` 尝试远端撤销 refresh token、清除本地 OAuth 集合，并且只在 access token 镜像仍等于 OAuth 所有值时删除该镜像。

随附的 public client 使用已登记的 `http://127.0.0.1:<临时端口>/callback` 回调并请求 `inference:invoke offline_access`。设置 `ZENMUX_OAUTH_NO_BROWSER=1` 可以禁止自动打开新标签页，同时保留手动登录链接。监听器拒绝其他路径、不匹配的 state、重复回调和超过 `loginTimeoutMs` 的回调；它只绑定 loopback，并在接受一个响应或超时后关闭。

ZenMux discovery、token 与 revocation 请求默认直连。确实需要代理的部署，可以在自己的 DSH profile 中显式设置 `proxyUrl`，或导出 `HTTPS_PROXY`/`https_proxy`；插件配置优先。支持 HTTP、HTTPS 与远端 DNS SOCKS 代理 URL。浏览器需要独立访问同一个授权服务。如果配置的链路使用本地 CA 终止 TLS，请在 Node 启动前加入 CA，例如 `NODE_EXTRA_CA_CERTS=/绝对路径/ca.pem dsh web`。不要使用 `NODE_TLS_REJECT_UNAUTHORIZED=0`：关闭校验会暴露 authorization code 与 refresh token。

## ZenMux 模型路由

bundle 会把两个提供方 profile 加到 DSH 已有的 `llm-pi-ai` entry：

```yaml
llm-pi-ai:
  providers:
    zenmux:
      displayName: ZenMux · Anthropic
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
        # 由 GET /api/anthropic/v1/models 生成的 126 个模型。
    zenmux-models:
      displayName: ZenMux · OpenAI
      baseURL: https://zenmux.ai/api/v1
      api: openai-completions
      apiKeyEnv: ZENMUX_OAUTH_ACCESS_TOKEN
      models:
        # 由 GET /api/v1/models 生成的 24 个仅支持 OpenAI 的文本模型。
```

登录后，**ZenMux · Anthropic** 展示 `/api/anthropic/v1/models` 返回的全部模型，并通过 `cacheRetention: short` 加入 Anthropic ephemeral prompt cache 控制。Claude Fable 5 等同时存在于 OpenAI 列表的模型只出现在这个组。**ZenMux · OpenAI** 只保留其余文本模型，两组不重复，同时覆盖 `/api/v1/models` 的全部文本模型。composer 选择器仍支持按提供方和模型名称／ID／描述搜索。如果自定义了 `accessTokenRef`，两个 provider route 必须使用同一个引用。

每次发布前运行 `pnpm sync:models`，同时刷新 `/api/v1/models` 与 `/api/anthropic/v1/models`；`pnpm check:models` 会在任一快照不一致时失败。`output_modalities` 不含 `text` 的条目会被排除。DSH 设置页只能发现 OpenAI 目录，因此发布生成器是协议分区的权威来源。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `oauthOrigin` | `ZENMUX_OAUTH_ORIGIN` 或 `https://zenmux.ai` | OAuth 授权服务器 origin；除 loopback 开发外必须使用 HTTPS |
| `clientId` | ZenMux Harness public client | 已登记的 public OAuth client id |
| `scopes` | `inference:invoke`、`offline_access` | 必需的推理与刷新 scope |
| `callbackPort` | `0` | loopback 端口；零表示由操作系统选择空闲端口 |
| `proxyUrl` | 空 | 部署方可提供 `http://`、`https://`、`socks4a://` 或 `socks5h://` 代理；未提供时继承 `HTTPS_PROXY`/`https_proxy`，再无则直连 |
| `browserAutoOpen` | 仅 `ZENMUX_OAUTH_NO_BROWSER=1` 时关闭 | 在 DSH Web 自动打开登录 URL，同时始终保留手动链接 |
| `accessTokenRef` | `ZENMUX_OAUTH_ACCESS_TOKEN` | LLM 提供方读取的原始 access token 镜像 |
| `tokenSetRef` | `ZENMUX_OAUTH_TOKENS` | 带版本的 JSON access/refresh token 集合 |
| `loginTimeoutMs` | `300000` | 待完成 loopback 登录的存活时间 |
| `requestTimeoutMs` | `30000` | discovery、token 与 revocation 请求超时 |
| `refreshSkewMs` | `60000` | 到期前的提前刷新时间 |
| `refreshRetryMs` | `30000` | 后台刷新失败后的重试间隔 |

两个凭据引用必须不同且可写。由环境提供的凭据在 [`dsh-credentials-local`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/credentials/credentials-local) 中刻意保持只读；应选择没有被环境遮蔽的引用，而不是期待 OAuth 登录覆盖已导出的变量。

### 环境变量

| 变量 | 默认值 | 用途 |
|---|---|---|
| `ZENMUX_OAUTH_ORIGIN` | `https://zenmux.ai` | OAuth 授权服务器 origin |
| `ZENMUX_OAUTH_CLIENT_ID` | 随包 public client | 覆盖 OAuth public client ID |
| `ZENMUX_OAUTH_SCOPES` | `inference:invoke offline_access` | 以空白分隔的登录 scopes |
| `ZENMUX_API_BASE_URL` | `https://zenmux.ai/api/v1` | 通用 ZenMux API base；使用其 origin 派生 `/api/anthropic` |
| `ZENMUX_ANTHROPIC_BASE_URL` | 从 `ZENMUX_API_BASE_URL` 派生 | 精确覆盖 Anthropic Messages 端点 |
| `ZENMUX_OAUTH_NO_BROWSER` | 未设置 | 设为 `1` 时禁止自动打开浏览器 |
| `HTTPS_PROXY` / `https_proxy` | 未设置 | `proxyUrl` 为空时用于 OAuth discovery/token/revocation 的代理 |

`CODEX_HOME`、`ZENMUX_OAUTH_STATE_DIR` 和 `ZENMUX_OAUTH_STORAGE` 属于 Codex 风格的文件／钥匙串客户端，DSH 由 credentials service 负责持久化，因此刻意不读取这些变量。`ZENMUX_MODELS_CATALOG_URL` 和 `ZENMUX_ANTHROPIC_MODELS_CATALOG_URL` 只作为 `pnpm sync:models` 的构建期输入，不改变正在运行的 DSH profile。

## 持久化与刷新

插件从 `<oauthOrigin>/.well-known/oauth-authorization-server` 发现端点，并且只在 issuer 和所有携带凭据的端点都位于配置的 origin 时接受元数据。除 loopback 开发外必须使用 HTTPS，并要求 authorization-code 与 refresh grant、public-client token 认证和 PKCE S256。

一个 JSON 凭据存储 `accessToken`、`refreshToken`、`tokenType`、`expiresAt`、可选 scope 和格式版本。token exchange 先提交可恢复集合，再更新原始 access token 镜像；如果进程在两次写入之间停止，启动时会修复镜像。refresh token 轮换会替换已存 token，而未返回 refresh token 的响应会保留当前值。后台刷新失败后按 `refreshRetryMs` 重试，不删除最后一份 token 集合。

## 模型体验

### 提供方授权

#### 模型看到什么

看不到 OAuth state、token、到期时间或命令结果。消费该凭据的 LLM 适配器只把镜像 access token 用作提供方请求的 `Authorization: Bearer …` 标头。

#### Token 影响

没有直接 token 影响；认证数据不会出现在模型输入与保留历史中。

#### KV Cache 影响

随包 Anthropic 路由请求 `cacheRetention: short`。DSH/pi-ai 会给适用的 prompt block 加入 Anthropic ephemeral cache control；是否产生 cache read/write 仍取决于所选模型与 ZenMux 上游响应。OAuth 本身只改变请求标头，不改变模型可见的请求前缀。

## 已知限制与暂缓事项

- **目录是发布时快照**——两个协议列表只会在维护者运行 `pnpm sync:models` 后变化，运行时启动不依赖远端目录。
- **仅限交互式命令适配器**——随附 Web 应用可以运行 `/zenmux`；不消费 `ctx.commands` 的 headless 与自动化部署无法发起浏览器登录，但可使用另一次交互运行在同一 Harness home 中创建的 token 集合。
- **代理可用性由部署负责**——配置的 SOCKS 代理不可用时，登录与刷新会以失败关闭；插件不会悄悄回退到直连。
