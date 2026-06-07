下面是收敛后的**个人使用第一版 PRD**。核心原则是：**不要做成 Grafana，不做复杂监控平台，只做一个自己能快速看服务状态和任务进度的小面板。**

# PRD：个人服务状态面板 V1

## 1. 产品目标

做一个个人使用的 Web 面板，用来统一查看自己运行的各种服务、脚本、任务、数据同步程序的状态。

第一版只解决三个问题：

1. 哪些服务现在是正常的？
2. 哪些服务挂了、超时了、很久没更新？
3. 数据任务现在跑到哪里了？

本产品不是 Grafana，不做复杂指标分析，不做通用图表平台，不做大型运维系统。

---

## 2. 使用对象

仅面向个人使用。

典型使用者：

* 自己维护多个后端服务
* 自己跑一些定时任务、爬虫、数据同步、AI Agent
* 想打开一个页面快速知道所有东西是否正常

---

## 3. 第一版范围

### 要做

V1 只做以下功能：

1. 服务列表
2. 服务详情
3. 心跳上报
4. 任务进度上报
5. 简单状态判断
6. 简单异常提示
7. 一个总览页面
8. 本地配置或简单后台配置

### 不做

V1 明确不做：

* 不做复杂仪表盘拖拽
* 不做 Prometheus 接入
* 不做复杂图表
* 不做多用户权限
* 不做复杂告警系统
* 不做日志全文搜索
* 不做 Kubernetes / Docker 深度监控
* 不做插件市场
* 不做多租户

---

## 4. 核心概念

### 4.1 服务

服务是面板里的一个监控对象，可以是：

* 一个后端 API
* 一个爬虫
* 一个定时脚本
* 一个数据同步任务
* 一个 AI Agent
* 一个 Worker
* 一个本地长期运行程序

### 4.2 服务状态

第一版只保留 4 种状态：

| 状态  | 含义               |
| --- | ---------------- |
| 正常  | 最近有心跳，且没有失败状态    |
| 运行中 | 任务正在执行，有进度更新     |
| 异常  | 主动上报失败，或超过时间没有心跳 |
| 未知  | 刚创建，还没有收到任何数据    |

### 4.3 任务进度

任务进度用于展示脚本、同步任务、爬虫等执行到哪里。

字段包括：

* 总数
* 已处理数量
* 成功数量
* 失败数量
* 当前阶段
* 进度百分比
* 最近更新时间
* 当前状态说明

---

## 5. 页面设计

## 5.1 总览页

### 目标

打开页面后，一眼知道整体是否正常。

### 页面内容

顶部展示 4 个数字卡片：

* 服务总数
* 正常数量
* 运行中数量
* 异常数量

下方展示服务卡片列表。

每个服务卡片显示：

* 服务名称
* 当前状态
* 最近心跳时间
* 最近进度
* 最近错误信息
* 更新时间

### 交互

* 点击服务卡片进入服务详情
* 支持手动刷新
* 支持每 30 秒自动刷新
* 异常服务排在最前面

---

## 5.2 服务列表页

第一版可以和总览页合并，不单独做复杂列表。

服务列表字段：

| 字段   | 说明                            |
| ---- | ----------------------------- |
| 服务名称 | 服务显示名称                        |
| 类型   | api、script、crawler、sync、agent |
| 状态   | 正常、运行中、异常、未知                  |
| 最近心跳 | 最近一次 heartbeat 时间             |
| 最近进度 | 例如 62%                        |
| 最近消息 | 服务上报的 message                 |
| 操作   | 查看详情                          |

### 筛选能力

V1 只做简单筛选：

* 全部
* 正常
* 运行中
* 异常

---

## 5.3 服务详情页

### 页面内容

服务详情页展示：

1. 基础信息

   * 服务名称
   * 服务 key
   * 服务类型
   * 当前状态
   * 创建时间

2. 当前状态

   * 最近心跳时间
   * 最近更新时间
   * 最近消息
   * 最近错误

3. 任务进度

   * 当前阶段
   * 总数
   * 已处理数量
   * 成功数量
   * 失败数量
   * 进度条

4. 最近事件

   * 最近 20 条上报记录
   * 包括 heartbeat、progress、error

5. 接入说明

   * 心跳上报地址
   * 进度上报地址
   * 示例 curl 命令

---

## 6. 服务接入方式

V1 只支持两种接入方式。

---

## 6.1 Heartbeat 心跳上报

服务定时向面板后端上报自己还活着。

接口：

```http
POST /api/heartbeat
```

请求示例：

```json
{
  "service_key": "order-sync",
  "status": "ok",
  "message": "running"
}
```

说明：

* service_key 用于识别服务
* status 可以是 ok 或 error
* message 是状态说明

状态规则：

* 5 分钟内有 heartbeat：正常
* 超过 5 分钟没有 heartbeat：异常
* status = error：异常

---

## 6.2 Progress 进度上报

任务型服务上报当前执行进度。

接口：

```http
POST /api/progress
```

请求示例：

```json
{
  "service_key": "order-sync",
  "task_name": "订单同步",
  "status": "running",
  "stage": "syncing",
  "total": 10000,
  "processed": 6200,
  "success": 6150,
  "failed": 50,
  "message": "正在同步订单数据"
}
```

状态规则：

* status = running：运行中
* status = success：正常
* status = error：异常
* 超过 10 分钟没有进度更新：异常或疑似卡住

---

## 7. 状态判断规则

V1 使用非常简单的规则。

### 正常

满足任意一个：

* 最近 5 分钟内收到 heartbeat，且状态不是 error
* 最近任务状态为 success

### 运行中

满足：

* 最近任务状态为 running
* 最近 10 分钟内有 progress 更新

### 异常

满足任意一个：

* heartbeat 上报 status = error
* progress 上报 status = error
* 超过 5 分钟没有 heartbeat
* 任务 running 但超过 10 分钟没有进度更新

### 未知

满足：

* 服务刚创建
* 没有任何上报数据

---

## 8. 数据模型

## 8.1 services 表

| 字段                | 类型       | 说明       |
| ----------------- | -------- | -------- |
| id                | string   | 服务 ID    |
| service_key       | string   | 服务唯一标识   |
| name              | string   | 服务名称     |
| type              | string   | 服务类型     |
| status            | string   | 当前状态     |
| message           | text     | 最近状态说明   |
| last_heartbeat_at | datetime | 最近心跳时间   |
| last_progress_at  | datetime | 最近进度更新时间 |
| created_at        | datetime | 创建时间     |
| updated_at        | datetime | 更新时间     |

---

## 8.2 service_progress 表

| 字段          | 类型       | 说明                    |
| ----------- | -------- | --------------------- |
| id          | string   | 进度 ID                 |
| service_key | string   | 服务唯一标识                |
| task_name   | string   | 任务名称                  |
| status      | string   | running、success、error |
| stage       | string   | 当前阶段                  |
| total       | number   | 总数                    |
| processed   | number   | 已处理                   |
| success     | number   | 成功                    |
| failed      | number   | 失败                    |
| message     | text     | 当前说明                  |
| created_at  | datetime | 创建时间                  |
| updated_at  | datetime | 更新时间                  |

---

## 8.3 service_events 表

| 字段          | 类型       | 说明                       |
| ----------- | -------- | ------------------------ |
| id          | string   | 事件 ID                    |
| service_key | string   | 服务唯一标识                   |
| event_type  | string   | heartbeat、progress、error |
| status      | string   | 状态                       |
| message     | text     | 事件说明                     |
| raw_payload | json     | 原始上报数据                   |
| created_at  | datetime | 创建时间                     |

---

## 9. API 设计

## 9.1 获取总览

```http
GET /api/dashboard
```

返回：

```json
{
  "total": 5,
  "healthy": 3,
  "running": 1,
  "error": 1,
  "services": []
}
```

---

## 9.2 获取服务列表

```http
GET /api/services
```

---

## 9.3 获取服务详情

```http
GET /api/services/:service_key
```

---

## 9.4 创建服务

```http
POST /api/services
```

请求：

```json
{
  "service_key": "order-sync",
  "name": "订单同步服务",
  "type": "sync"
}
```

---

## 9.5 心跳上报

```http
POST /api/heartbeat
```

---

## 9.6 进度上报

```http
POST /api/progress
```

---

## 10. 前端页面

V1 只需要 3 个页面：

```text
/dashboard        总览页
/services/:key    服务详情页
/settings         简单配置页
```

### 总览页

展示所有服务状态。

### 服务详情页

展示单个服务的状态、进度和最近事件。

### 设置页

用于新增服务、编辑服务名称、删除服务。

---

## 11. 技术建议

### 前端

推荐：

* React / Next.js
* TypeScript
* Tailwind CSS
* 简单图表可以先不用
* 进度条和状态卡片自己实现即可

### 后端

推荐：

* FastAPI / Node.js / NestJS 均可
* 个人项目优先选择自己熟悉的技术

### 数据库

V1 推荐：

* SQLite：最简单，适合个人本地使用
* PostgreSQL：如果未来可能部署到服务器，建议直接用 PostgreSQL

### 部署

个人第一版建议：

* Docker Compose
* 一个前端服务
* 一个后端服务
* 一个数据库

---

## 12. 第一版验收标准

V1 完成后，应满足以下效果：

1. 可以创建一个服务
2. 服务可以通过接口上报心跳
3. 服务可以通过接口上报任务进度
4. 总览页可以看到所有服务状态
5. 异常服务会排在前面
6. 服务详情页可以看到最近状态、进度和事件
7. 服务超过一段时间不上报，会自动变成异常
8. 页面可以手动刷新或自动刷新

---

## 13. 推荐开发顺序

### 第一步：后端基础

* 建表
* 创建服务 API
* 服务列表 API
* 服务详情 API

### 第二步：数据上报

* heartbeat API
* progress API
* event 记录

### 第三步：状态计算

* 根据最近心跳判断状态
* 根据最近进度判断状态
* 异常服务排序

### 第四步：前端总览

* 状态统计卡片
* 服务卡片列表
* 自动刷新

### 第五步：服务详情

* 基础信息
* 当前进度
* 最近事件

### 第六步：简单配置

* 新增服务
* 编辑服务
* 删除服务

---

## 14. V1 不要超过的边界

第一版不要为了“以后可能有用”提前做复杂功能。

尤其不要做：

* 自定义图表
* 多级权限
* 复杂告警
* 插件系统
* 指标查询语言
* Dashboard 编辑器
* 多环境复杂配置

第一版只要能稳定回答：

> 我的服务还活着吗？
> 我的任务跑到哪里了？
> 哪个东西出问题了？

就算成功。

建议你把第一版控制在 **1 个周末到 1 周内能做出来** 的范围。最小可用版本甚至可以只做：`服务列表 + heartbeat 上报 + progress 上报 + 自动异常判断`。

