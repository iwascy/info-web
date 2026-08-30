# info-web 设计文档

## 目标

实现 PRD 中的个人服务状态面板 V1：不做复杂监控平台，只提供服务状态、心跳、任务进度、异常提示和最近事件。

## 非目标

- 不接入 Prometheus、Grafana、Kubernetes 或 Docker 深度监控。
- 不做多用户权限、多租户、复杂告警或全文日志搜索。
- 不做可拖拽仪表盘和复杂图表。

## 架构

```mermaid
flowchart LR
  Service["外部服务/脚本"] --> Heartbeat["POST /api/heartbeat"]
  Service --> Progress["POST /api/progress"]
  UI["Next.js 页面"] --> Query["查询 API"]
  Heartbeat --> DB["SQLite"]
  Progress --> DB
  Query --> DB
```

应用采用 Go API + Next.js 前端结构：

- `server/main.go`：REST API、Bearer 认证、SQLite 数据读写、状态刷新和受控运维动作。
- `web/app/*`：Next.js 页面；根布局中的 `AppProviders` 统一管理 SWR 自动刷新。
- `/dashboard`：总览，只返回有限条最近任务和告警，统计值由数据库全量聚合。
- `/services/[key]`：通用服务详情。
- `/sync`：服务端筛选、搜索和分页的任务列表。
- `/migration/pikpak-115`：PikPak 到 115 的专属迁移工作台，是该任务唯一 canonical 页面。

旧地址 `/services/pikpak-115` 和 `/sync/pikpak-to-115-migration` 永久重定向到迁移工作台。桌面端侧栏和窄屏四列导航均提供一级入口，不再把迁移能力嵌在通用服务页中。

## 数据模型

SQLite 中主要维护以下数据：

- `services`：服务基础信息、当前状态、最近心跳、最近进度和最近错误。
- `sync_tasks`：同步与迁移任务的当前快照。
- `events`：最近事件来源，事件类型包括 `heartbeat`、`progress`、`error`。
- `alerts`：触发、恢复与静默的告警记录。
- `settings`：接入 token、面板 token 和行为配置。

列表接口使用统一分页 envelope：`items`、`total`、`page`、`page_size`、`counts`。`counts` 始终基于完整筛选域计算，不按当前页截断。任务默认 `current` 视图包含全部非成功任务和最近 7 天完成的成功任务；告警徽标使用轻量 `/api/alerts/count`，避免定时拉取完整告警列表。

## 状态规则

状态在查询和上报后刷新：

- `healthy`：5 分钟内心跳正常，或最近任务状态为 `success`。
- `running`：任务状态为 `running` 且 10 分钟内有进度更新。
- `stale`：原本运行中的任务超过 10 分钟没有进度更新；状态持久化并产生去重告警，新进度上报可恢复真实状态。
- `error`：心跳或进度主动报告错误，或服务心跳超过 5 分钟。
- `unknown`：刚创建且没有任何上报数据。

`stale` 不等同于 `running` 或 `paused`。页面不会向失联/错误任务提供“恢复”按钮，因为通用状态接口不能真正启动外部 worker。

## 技术选型

- Go + chi：提供轻量 API、认证和 SQLite 数据访问。
- Next.js + React + TypeScript：承载面板页面和客户端交互。
- SQLite：零外部服务依赖。
- 原生 CSS：界面规模小，避免引入 Tailwind 配置和额外构建复杂度。

## 已知限制

- 没有编辑服务的 UI，API 已支持 `PUT /api/services/:service_key`。
- 没有后台定时任务，状态在查询和上报时刷新，足够满足 V1 页面展示。
- 暂停/恢复接口只修改面板中的任务状态，不能代替外部 worker 的控制协议。

## 安全考量

- API 对必填字段、状态枚举、服务类型和数值字段做了基础校验。
- SQL 使用 prepared statements，避免拼接用户输入。
- 面板查询和运维动作使用 panel Bearer token；上报接口使用独立 ingest Bearer token。
- “全量查漏”只允许面板认证用户触发。二进制、环境文件和日志路径仅能由可信的服务启动环境配置，命令参数保持固定；HTTP 请求不能传入这些值，响应也不泄露路径。并发执行由互斥状态限制。

## 刷新模型

根布局的 `AppProviders` 为所有页面提供同一份 SWR 配置。自动刷新开关和 10/30/60/300 秒间隔保存在浏览器本地存储，顶栏与设置页操作同一状态；“立即刷新”通过全局 SWR mutate 重新校验现有查询，不整页重载。

## 变更记录

- 2026-08-30：迁移工作台提升为一级导航和 canonical 页面；任务/告警改为服务端分页与全局计数；新增 `stale` 状态；统一全局刷新和加载态；恢复受控“全量查漏”入口。
