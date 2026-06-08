# OpsPilot

个人服务状态监控面板，包含 Next.js 前端和 Go + SQLite 后端。

## 启动

一键启动前后端：

```bash
./dev.sh --seed
```

不重新灌数据：

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
go run . -seed
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

- `server/`：Go REST API + SQLite 存储 + seed 数据
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

远端查看密钥：

```bash
ssh root@161.118.203.175 'cat /root/opspilot-secrets.txt'
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
  -H "Authorization: Bearer opspilot-dev-token" \
  -H "Content-Type: application/json" \
  -d '{"service_key":"pikpak-115-sg2","status":"running","message":"running"}'
```

```bash
curl -X POST http://localhost:8080/api/progress \
  -H "Authorization: Bearer opspilot-dev-token" \
  -H "Content-Type: application/json" \
  -d '{"service_key":"pikpak-115-sg2","task_id":"pikpak_115_main","name":"PikPak → 115 网盘迁移","stage":"upload","total":50480,"processed":37965,"success":37965,"failed":249,"progress":75.2,"total_bytes":6597069766656,"done_bytes":4810363371520,"instant_files":24130,"uploaded_files":13835,"queue_size":12017,"cursor":"1184273","download_speed":42991616,"upload_speed":29360128,"current_file":"文件名已隐藏","current_stage":"upload"}'
```
