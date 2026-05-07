# 部署 — test.javine.ai

把 `test.javine.ai` 通过 nginx 反代到本项目：
- 前端静态资源：`/var/test/javine.ai/html/`（由 `publish-frontend.sh` 发布）
- 后端 API：uvicorn `127.0.0.1:8000`（systemd 托管）

> 这份文档只覆盖**首次部署**与**重发布**。
> 日常运维（重启 / 备份 / 恢复 / 改密码 / 排错）请看 [`RUNBOOK.md`](./RUNBOOK.md)。

## 前置条件

- 域名 DNS 指向本机
- 已安装：`nginx`、`certbot`、`python3.11+ + venv`、`node 20+ + npm`
- `backend/.env` 已配置（`JWT_SECRET`、`SEED_EXCEL_PATH`、`TIMEZONE` 等）
- 数据库已 seed 完成（`cd backend && source .venv/bin/activate && python -m app.seed`）

## 一、首次部署

```bash
# 1) 准备前端发布目录，并把所有权交给 zhenjie（之后 publish 不再需要 sudo）
sudo mkdir -p /var/test/javine.ai/html
sudo chown -R zhenjie:zhenjie /var/test/javine.ai

# 2) 首次发布前端
/home/zhenjie/art-school-management/deploy/publish-frontend.sh

# 3) 安装 uvicorn systemd 服务
sudo cp /home/zhenjie/art-school-management/deploy/art-school-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now art-school-api
sudo systemctl status art-school-api --no-pager

# 4) 安装 nginx 站点
sudo cp /home/zhenjie/art-school-management/deploy/test.javine.ai.nginx.conf \
        /etc/nginx/sites-available/test.javine.ai
sudo ln -s /etc/nginx/sites-available/test.javine.ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5) 验证 HTTP
curl -I http://test.javine.ai/
curl -s http://test.javine.ai/api/health

# 6) 申请 HTTPS 证书（certbot 会自动改写 nginx 配置加 443）
sudo certbot --nginx -d test.javine.ai
```

## 二、改代码后重发布

```bash
# 前端
/home/zhenjie/art-school-management/deploy/publish-frontend.sh

# 后端
sudo systemctl restart art-school-api
```

## 三、产物清单

| 文件 | 用途 |
|---|---|
| `test.javine.ai.nginx.conf` | nginx server block（HTTP；certbot 会就地补 HTTPS）|
| `art-school-api.service` | systemd unit，跑 uvicorn |
| `publish-frontend.sh` | 一键 build + rsync 到 `/var/test/javine.ai/html/` |
| `README.md` | 本文（首次部署 / 重发布）|
| `RUNBOOK.md` | 日常运维（备份、恢复、改密码、排错…）|
