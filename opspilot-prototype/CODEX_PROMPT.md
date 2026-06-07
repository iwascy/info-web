# 任务：实现 OpsPilot —— 个人服务状态监控面板（前端 + Go 后端 API）

## 背景
OpsPilot 是一个个人服务状态 & 数据同步进度监控面板，回答三个问题：① 我的服务还活着吗？② 同步任务跑到哪了？③ 哪个服务/任务出了异常？

已有一套**完整的、零依赖的静态 HTML 原型**作为视觉与交互的"唯一事实来源"，你的任务是把它落地成**生产级的 Next.js 前端 + Go 后端**，并实现配套 REST API。

## ⚠️ 第一步必做：先读懂现有原型
原型目录：`/Users/hcy/code/info-web/opspilot-prototype/`
请先完整阅读以下文件，**视觉、配色、布局、组件、交互必须 1:1 还原，不要自己重新设计 UI**：
- `assets/app.css` —— 完整设计系统（CSS 变量、卡片、徽章、进度条、表格、时间线、阶段流等）
- `assets/app.js` —— 外壳布局(renderShell)、图表函数(sparkline/lineChart/donut/gauge)、toast/modal 等
- `assets/data.js` —— mock 数据结构 + 格式化辅助函数（这是数据模型的参考）
- `assets/icons.js` —— Lucide 风格图标集（前端改用 lucide-react）
- 页面：`dashboard.html` `services.html` `service-detail.html` `sync.html` `sync-detail.html` `alerts.html` `logs.html` `settings.html` `api-docs.html` `pikpak-115.html`

## 技术栈（已锁定，不要改）
- **前端**：Next.js（App Router）+ React + TypeScript + Tailwind CSS + lucide-react + SWR（或 TanStack Query）做数据请求与轮询刷新
- **后端**：Go（推荐 chi 或 gin 路由）+ SQLite（推荐 `modernc.org/sqlite` 纯 Go 驱动，免 CGO）
- **数据接入模型**：各被监控服务**主动 PUSH** 上报（调 `POST /api/heartbeat`、`POST /api/progress`），用 `Authorization: Bearer <token>` 鉴权
- 前后端分离部署，前端通过 `NEXT_PUBLIC_API_BASE` 指向后端

## 设计系统（摘自 app.css，以原型实际值为准）
- 深色科技风、玻璃拟态卡片、蓝紫径向辉光 + 工程网格背景
- 主色：Blue `#3785FF`、Cyan `#17D5EB`、Green `#29D684`、Yellow `#F8B831`、Red `#FF5B6F`、Purple `#975CFF`
- 文字：主 `#ECF4FF`、次 `#94A6C3`；边框 `#2D4469`；面板 `#0B1930`；背景 `#050C1A`/`#061426`
- 卡片圆角 16px、侧边栏宽 220–232px、玻璃卡 `rgba(11,25,48,.82)` + `blur(16px)`
- 状态色一致性、异常优先（error 永远排最前、红色高亮整行）

## 数据模型（基于真实服务字段，见下方说明）
模型来自真实 Go 服务 `telegram_saver` 的 `Event` 与 `savedSyncState` 结构，请在 Go 端定义对应 struct 并建 SQLite 表：

### Service（服务）
```
id, service_key(唯一), name, type(sync|api|crawler|script|agent|worker),
status(healthy|running|warning|error|unknown|paused), message,
last_heartbeat_at, last_progress_at, heartbeat_timeout_sec(默认90), created_at
```
排序：error > warning > running > unknown > healthy > paused

### SyncTask（同步任务 / 进度）
```
id, service_key, task_id, name, status(running|success|error|paused), stage,
total, processed, success, failed, skipped, progress(0-100), message,
started_at, updated_at,
-- 迁移类扩展字段（pikpak→115 用）：
total_bytes, done_bytes, instant_files(秒传命中), uploaded_files, queue_size,
cursor(断点游标), download_speed, upload_speed, current_file, current_stage,
window_start, window_end, window_enabled
```
排序：error > running > warning > success > paused

### Event（事件流，对应真实 Event 结构）
```
id, service_key, task_id, type(heartbeat|progress|error|system),
level(info|warning|error|success), message, stage(download|upload|forward|...),
percentage, current(字节), total(字节), file_name, status, download_speed, upload_speed,
raw_payload(JSON原文), created_at
```

### Alert（告警）
```
id, service_key, task_id, severity(high|medium|low), title, message,
status(firing|resolved|muted), triggered_at, resolved_at
```

### BatchRecord（批次记录） & ErrorSample（异常样本）
```
BatchRecord: id, task_id, range, total, success, failed, duration, created_at
ErrorSample: id, task_id, file, code, reason, level, payload(JSON), created_at
```

## REST API 规格
后端统一前缀 `/api`，全部返回 JSON。

### 上报接口（被监控服务调用，需 Bearer 鉴权）
- `POST /api/heartbeat` —— body: `{service_key, status, message?}`；写入/更新 Service + 落 Event(type=heartbeat)
- `POST /api/progress` —— body: `{service_key, task_id, name?, stage, total, processed, success, failed, skipped?, progress, message?, 以及迁移扩展字段}`；写入/更新 SyncTask + 落 Event(type=progress)；速度/字节/当前文件等字段可选

### 查询接口（前端调用）
- `GET /api/dashboard` —— 汇总：各状态服务计数、健康度、运行中任务、最近告警、（系统资源可选）
- `GET /api/services` / `POST /api/services` / `GET /api/services/{key}` / `DELETE /api/services/{key}`
- `GET /api/sync-tasks` / `GET /api/sync-tasks/{id}`（详情含 stages、batches、error_samples、吞吐序列）
- `GET /api/alerts` / `POST /api/alerts/{id}/resolve` / `POST /api/alerts/{id}/mute`
- `GET /api/events?type=&q=&limit=`（支持类型过滤 + 搜索）
- `GET /api/settings` / `PUT /api/settings` / `POST /api/token/reset`（接入令牌管理）

### 告警自动生成规则（后端后台 goroutine 定时跑）
- 心跳超过 `heartbeat_timeout_sec` 未上报 → 服务置 error + 触发 high 告警
- 进度长时间无更新（卡住）→ warning/error 告警
- 失败率超阈值 → 告警

## 页面清单（对应原型逐页还原为 React 页面）
| 路由 | 原型文件 | 要点 |
|---|---|---|
| `/` | dashboard.html | 指标卡、健康度环图、最近告警、系统资源、服务表、任务进度、快捷操作 |
| `/services` | services.html | 表格/网格切换、状态过滤 chips（带计数）、实时搜索、删除确认 |
| `/services/[key]` | service-detail.html | 头部卡、4 指标卡、心跳时间线、关联任务、事件历史（JSON 高亮） |
| `/sync` | sync.html | 4 指标、hero 任务卡、可过滤任务表 |
| `/sync/[id]` | sync-detail.html | 五段阶段流、吞吐折线、gauge、批次表、异常样本（折叠 JSON） |
| `/alerts` | alerts.html | 按严重度排序、resolve/mute/全部恢复、过滤 chips |
| `/logs` | logs.html | 事件时间线、类型过滤、搜索、JSON 高亮、导出 |
| `/settings` | settings.html | 新增服务向导、令牌复制/重置、偏好开关、危险操作 |
| `/api-docs` | api-docs.html | 接入文档（curl 片段 + 复制）、全 endpoint 表 |
| `/services/pikpak-115` | **pikpak-115.html** | 见下方专属说明 |

## 专属页面：pikpak→115 迁移（重点）
这是第一个真实接入的服务（新加坡二号机），原型 `pikpak-115.html` 已做好。**它是 sync-detail 的特化版**，后端只需把 SyncTask 的迁移扩展字段存好并通过 `GET /api/sync-tasks/{id}` 返回，前端按原型渲染：
- 顶部状态条：暂停/恢复按钮、调度时间窗、断点游标(cursor)、运行时长
- 指标行：文件总进度、**115 秒传命中数 + 命中率**、队列积压、失败数
- 迁移进度：**双口径**（字节 `done_bytes/total_bytes` + 文件数 `success/total`）、秒传/实传分段条、**当前正在传的文件名**
- 两端账号健康卡：PikPak（来源，流量+token 过期）/ 115（目标，配额+秒传率）
- 迁移管线：扫描 → 下载/中转 → 上传 115 → sha1 校验 → 完成
- **双线实时吞吐图**：下载侧(PikPak) vs 上传侧(115) 两条线
- 最近文件表：每个文件走了哪条路径（秒传 / API 中转 / 下载+上传）
- 异常样本：限流(429 自动暂停)、配额不足、源失效(404)、秒传未命中回退，带原始 payload
- 暂停/恢复要调后端接口：`POST /api/sync-tasks/{id}/pause` 和 `/resume`

> 注意：被监控的实际服务建在 `telegram_saver`（Go）的 transfer/sync 引擎之上，其上报字段 = `Event{Stage, Current/Total(bytes), FileName, DownloadSpeed, UploadSpeed, ...}` + `savedSyncState{LastSyncedMsgID, TotalSynced, TotalFailed, QueueSize, Paused, ...}`。`POST /api/progress` 的 body 要能完整承接这些字段。

## 工程结构建议
```
opspilot/
├── web/                 # Next.js 前端
│   ├── app/             # 路由页面
│   ├── components/      # 复用组件（Card/Badge/Chart/Sidebar/Topbar...）
│   ├── lib/             # api client、格式化函数（移植 data.js 的 fmtBytes/fmtNumber/fmtRelative 等）
│   └── styles/          # 全局样式（移植 app.css 的设计系统到 Tailwind theme + globals.css）
└── server/              # Go 后端
    ├── main.go
    ├── internal/api/    # handlers
    ├── internal/store/  # SQLite 存储层 + migrations
    ├── internal/model/  # structs
    └── internal/alert/  # 告警检测 goroutine
```

## 验收标准
1. 前端视觉与原型 1:1（配色/布局/动效/玻璃卡/图表），响应式可用
2. 所有页面接真实后端 API（不再用 mock），SWR 轮询刷新，刷新按钮带 spin 动画
3. Go 后端：SQLite 自动建表、Bearer 鉴权、上报接口幂等、告警自动生成 goroutine 跑通
4. `POST /api/progress` 能完整接收 pikpak→115 的迁移扩展字段并在专属页正确渲染
5. 提供 seed 脚本，用原型 `data.js` 里的 mock 数据灌库，便于演示
6. README：如何启动前端、后端、如何用 curl 上报心跳/进度（参考原型 api-docs.html）

## 实现顺序
1. 读原型 → 抽取设计系统到 Tailwind + globals.css
2. Go 后端：模型 + SQLite + 上报/查询接口 + seed
3. 前端：外壳布局(sidebar/topbar) + 复用组件 + 图表
4. 逐页实现并接后端
5. pikpak→115 专属页 + 暂停/恢复
6. 告警 goroutine + README
