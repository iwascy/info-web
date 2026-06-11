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
cp ../config/auth.example.json ../config/auth.json
# 修改 ../config/auth.json 中的 username/password
go mod tidy
go run .
```

```bash
cd /Users/hcy/code/info-web/web
npm install
NEXT_PUBLIC_API_BASE=http://localhost:8080 npm run dev
```

打开 `http://localhost:3000`。

后端启动时会读取登录配置文件，默认路径为 `config/auth.json`，也可以通过 `OPSPILOT_AUTH_CONFIG` 指定：

```json
{
  "username": "opspilot",
  "password": "change-me"
}
```

前端登录页使用配置文件中的账号密码登录。登录成功后，后端会返回面板会话令牌给浏览器保存，用于调用受保护的面板 API。首次启动时后端会生成真实接入令牌并打印在 API 日志里，也可以通过 `OPSPILOT_TOKEN` 显式指定；被监控服务上报接口仍使用该接入令牌作为 `Authorization: Bearer`。

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
- 登录配置：`/etc/opspilot-auth.json`
- 证书：Let's Encrypt，certbot 自动续期

远端查看密钥与登录配置：

```bash
ssh root@161.118.203.175 'cat /root/opspilot-secrets.txt'
ssh root@161.118.203.175 'cat /etc/opspilot-auth.json'
```

远端常用操作：

```bash
systemctl status opspilot-api opspilot-web nginx
journalctl -u opspilot-api -f
journalctl -u opspilot-web -f
systemctl restart opspilot-api opspilot-web
```

## 上报示例

```bash
curl -X POST http://localhost:8080/api/heartbeat \
  -H "Authorization: Bearer <OPSPILOT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"service_key":"your-service-key","name":"服务展示名","type":"worker","status":"running","message":"running"}'
```

```bash
curl -X POST http://localhost:8080/api/progress \
  -H "Authorization: Bearer <OPSPILOT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"service_key":"your-service-key","task_id":"stable-task-id","name":"任务展示名","stage":"running","total":1000,"processed":420,"success":410,"failed":2,"progress":42.0}'
```
