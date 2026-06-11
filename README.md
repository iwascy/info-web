# OpsPilot

个人服务状态监控面板，包含 Next.js 前端和 Go + SQLite 后端。

## 启动

一键启动前后端：

```bash
./dev.sh
```

可用环境变量覆盖端口：

```bash
API_PORT=8080 WEB_PORT=3000 ./dev.sh
```

手动启动：

```bash
cd /Users/hcy/code/info-web/server
go mod tidy
go run .
```

```bash
cd /Users/hcy/code/info-web/web
npm install
NEXT_PUBLIC_API_BASE=http://localhost:8080 npm run dev
```

打开 `http://localhost:3000`。

默认上报令牌：`opspilot-dev-token`，也可以用 `OPSPILOT_TOKEN` 覆盖。

## 目录

- `server/`：Go REST API + SQLite 存储
- `web/`：Next.js App Router 前端
- `opspilot-prototype/`：静态 HTML 原型，仅作为视觉参考

## 生产部署

当前生产站点：

- URL: `https://web-info.cccy.fun`
- 服务器：甲骨文新加坡2号机 `161.118.203.175`
- 部署目录：`/opt/opspilot`
- API systemd：`opspilot-api.service`
- Web systemd：`opspilot-web.service`
- Nginx 配置：`/etc/nginx/sites-available/web-info.cccy.fun`
- 证书：Let's Encrypt，certbot 自动续期
- Jenkins 部署任务：`https://jenkins.cccy.fun/job/info-web-prod/`
- Jenkins 监控：`opspilot-jenkins-heartbeat.timer` 每分钟探测 `https://jenkins.cccy.fun/login` 并上报服务 `jenkins-cccy`
- Jenkins 远端部署脚本：`/usr/local/bin/info-web-deploy.sh`

远端查看密钥：

```bash
ssh root@161.118.203.175 'cat /root/opspilot-secrets.txt'
```

远端常用操作：

```bash
systemctl status opspilot-api opspilot-web nginx
systemctl status opspilot-jenkins-heartbeat.timer opspilot-jenkins-heartbeat.service
journalctl -u opspilot-api -f
journalctl -u opspilot-web -f
journalctl -u opspilot-jenkins-heartbeat.service -f
systemctl restart opspilot-api opspilot-web
/usr/local/bin/info-web-deploy.sh
```

## 上报示例

```bash
curl -X POST http://localhost:8080/api/heartbeat \
  -H "Authorization: Bearer <OPS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"service_key":"your-service-key","name":"服务展示名","type":"worker","status":"running","message":"running"}'
```

```bash
curl -X POST http://localhost:8080/api/progress \
  -H "Authorization: Bearer <OPS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"service_key":"your-service-key","task_id":"stable-task-id","name":"任务展示名","stage":"running","total":1000,"processed":420,"success":410,"failed":2,"progress":42.0}'
```
