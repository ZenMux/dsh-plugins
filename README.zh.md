# @zenmux/dsh-plugins

[English](README.md) | 中文

面向交互式 Harness 部署的 ZenMux OAuth 2.0 Authorization Code + PKCE S256 登录插件。插件注册 `/zenmux [login|status|logout]`，通过一次性的 `127.0.0.1` loopback 监听器接收授权响应，经 `ctx.credentials` 持久化带版本的 access/refresh token 集合，并在到期前刷新。

## 安装到 DSH

从 GitHub 把 bundle 安装到已发布 DSH 的 Web profile，然后照常启动：

```sh
dsh plugin --profile web add github:ZenMux/dsh-plugins
dsh web
```

npm 包发布后可以这样安装：`dsh plugin --profile web add @zenmux/dsh-plugins`。

这个包声明了 `dsh.bundle.patch`，所以插件管理器会自动加入它的 `cordis.patch.yml`。该 patch 只挂载一个默认空闲的控制器。安装此包不会修改 DSH 内置的 base bundle，也不会注入部署环境相关配置。

## 登录

运行 `/zenmux login`，打开返回的 ZenMux URL，批准访问，并在回调页面显示 **ZenMux connected** 后返回。`/zenmux status` 只报告连接状态与到期时间，不返回 token。`/zenmux logout` 尝试远端撤销 refresh token、清除本地 OAuth 集合，并且只在 access token 镜像仍等于 OAuth 所有值时删除该镜像。

随附的 public client 使用已登记的 `http://127.0.0.1:<临时端口>/callback` 回调并请求 `inference:invoke offline_access`。监听器拒绝其他路径、不匹配的 state、重复回调和超过 `loginTimeoutMs` 的回调；它只绑定 loopback，并在接受一个响应或超时后关闭。

ZenMux discovery、token 与 revocation 请求默认直连。确实需要代理的部署，可以在自己的 DSH profile 中显式设置 `proxyUrl`，或导出 `HTTPS_PROXY`/`https_proxy`；插件配置优先。支持 HTTP、HTTPS 与远端 DNS SOCKS 代理 URL。浏览器需要独立访问同一个授权服务。如果配置的链路使用本地 CA 终止 TLS，请在 Node 启动前加入 CA，例如 `NODE_EXTRA_CA_CERTS=/绝对路径/ca.pem dsh web`。不要使用 `NODE_TLS_REJECT_UNAUTHORIZED=0`：关闭校验会暴露 authorization code 与 refresh token。

## LLM 提供方配置

OAuth 认证与模型路由彼此独立。把一个 pi-ai 自定义提供方指向 ZenMux，并点名镜像凭据：

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

Models 页面也可以创建同样的 profile。让 `apiKeyEnv` 指向配置的 `accessTokenRef`；不要把 OAuth token 粘贴到模型表单。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `clientId` | ZenMux Harness public client | 已登记的 public OAuth client id |
| `scopes` | `inference:invoke`、`offline_access` | 必需的推理与刷新 scope |
| `callbackPort` | `0` | loopback 端口；零表示由操作系统选择空闲端口 |
| `proxyUrl` | 空 | 部署方可提供 `http://`、`https://`、`socks4a://` 或 `socks5h://` 代理；未提供时继承 `HTTPS_PROXY`/`https_proxy`，再无则直连 |
| `accessTokenRef` | `ZENMUX_OAUTH_ACCESS_TOKEN` | LLM 提供方读取的原始 access token 镜像 |
| `tokenSetRef` | `ZENMUX_OAUTH_TOKENS` | 带版本的 JSON access/refresh token 集合 |
| `loginTimeoutMs` | `300000` | 待完成 loopback 登录的存活时间 |
| `requestTimeoutMs` | `30000` | discovery、token 与 revocation 请求超时 |
| `refreshSkewMs` | `60000` | 到期前的提前刷新时间 |
| `refreshRetryMs` | `30000` | 后台刷新失败后的重试间隔 |

两个凭据引用必须不同且可写。由环境提供的凭据在 [`dsh-credentials-local`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/credentials/credentials-local) 中刻意保持只读；应选择没有被环境遮蔽的引用，而不是期待 OAuth 登录覆盖已导出的变量。

## 持久化与刷新

插件从 `https://zenmux.ai/.well-known/oauth-authorization-server` 发现端点，并且只在 issuer 和所有携带凭据的端点都位于 HTTPS ZenMux origin 时接受元数据。它要求 authorization-code 与 refresh grant、public-client token 认证和 PKCE S256。

一个 JSON 凭据存储 `accessToken`、`refreshToken`、`tokenType`、`expiresAt`、可选 scope 和格式版本。token exchange 先提交可恢复集合，再更新原始 access token 镜像；如果进程在两次写入之间停止，启动时会修复镜像。refresh token 轮换会替换已存 token，而未返回 refresh token 的响应会保留当前值。后台刷新失败后按 `refreshRetryMs` 重试，不删除最后一份 token 集合。

## 模型体验

### 提供方授权

#### 模型看到什么

看不到 OAuth state、token、到期时间或命令结果。消费该凭据的 LLM 适配器只把镜像 access token 用作提供方请求的 `Authorization: Bearer …` 标头。

#### Token 影响

没有直接 token 影响；认证数据不会出现在模型输入与保留历史中。

#### KV Cache 影响

无；认证只改变请求标头，不改变模型可见的请求前缀。

## 已知限制与暂缓事项

- **提供方设置保持显式**——登录只保存凭据，不选择 ZenMux 模型目录，也不修改 `llm-pi-ai` settings；可用模型 id 与路由偏好属于提供方 profile。
- **仅限交互式命令适配器**——随附 Web 应用可以运行 `/zenmux`；不消费 `ctx.commands` 的 headless 与自动化部署无法发起浏览器登录，但可使用另一次交互运行在同一 Harness home 中创建的 token 集合。
- **代理可用性由部署负责**——配置的 SOCKS 代理不可用时，登录与刷新会以失败关闭；插件不会悄悄回退到直连。
