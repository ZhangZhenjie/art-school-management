# RUNBOOK — 日常运维操作

> 本文档面向已部署的生产环境（`https://test.javine.ai`）。
> 首次部署见 [README.md](./README.md)。

## 服务一览

| 组件 | 位置 | 说明 |
|---|---|---|
| nginx 站点 | `/etc/nginx/sites-available/test.javine.ai` | 静态托管 + `/api` 反代 |
| 静态资源 | `/var/test/javine.ai/html/` | `publish-frontend.sh` 同步目标 |
| systemd 服务 | `art-school-api.service` | uvicorn 监听 `127.0.0.1:8000` |
| SQLite DB | `/home/zhenjie/art-school-management/backend/art_school.db` | + `-wal` / `-shm` |
| 证书 | `/etc/letsencrypt/live/test.javine.ai/` | certbot 自动续期 |
| 排程 | APScheduler 内嵌进 uvicorn | 每月 1 日 00:05 SGT 生成当月课表 |

---

## 一、重启 / 状态 / 日志

```bash
# 重启后端（拉新代码）
sudo systemctl restart art-school-api

# 查看状态
sudo systemctl status art-school-api --no-pager

# 实时日志（uvicorn 标准输出 + APScheduler 日志）
journalctl -u art-school-api -f

# 最近 100 行
journalctl -u art-school-api -n 100 --no-pager

# nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
sudo systemctl reload nginx           # 改 nginx 配置后
```

---

## 二、重发布

```bash
# 前端：本地 build + rsync 到 /var/test/javine.ai/html/
/home/zhenjie/art-school-management/deploy/publish-frontend.sh
# nginx 不用重载，dist/ 内容直接被服务

# 后端：拉新代码后重启
sudo systemctl restart art-school-api
```

---

## 三、备份 SQLite

`*.db` + `*.db-wal` + `*.db-shm` 三个文件都要打包，否则 wal 里未 checkpoint 的写入会丢。

```bash
# 安全备份（让 SQLite 自己保证一致性）
cd /home/zhenjie/art-school-management/backend
sqlite3 art_school.db ".backup '/tmp/art_school-$(date +%F-%H%M).db'"

# 快速备份（要先停服务，否则有 wal 风险）
sudo systemctl stop art-school-api
cp -a art_school.db* /tmp/
sudo systemctl start art-school-api

# 定时备份示例（写到 ~/backups/，保留 30 天）
mkdir -p ~/backups
sqlite3 ~/art-school-management/backend/art_school.db \
  ".backup '$HOME/backups/art_school-$(date +%F-%H%M).db'"
find ~/backups -name 'art_school-*.db' -mtime +30 -delete
```

定时跑：`crontab -e`

```cron
# 每天凌晨 3:30 备份 SQLite
30 3 * * * sqlite3 /home/zhenjie/art-school-management/backend/art_school.db ".backup '/home/zhenjie/backups/art_school-$(date +\%F).db'" && find /home/zhenjie/backups -name 'art_school-*.db' -mtime +30 -delete
```

## 四、恢复 SQLite

```bash
sudo systemctl stop art-school-api
cd /home/zhenjie/art-school-management/backend
mv art_school.db art_school.db.bak.$(date +%F-%H%M)
rm -f art_school.db-wal art_school.db-shm
cp /path/to/backup.db art_school.db
sudo systemctl start art-school-api
```

---

## 五、重置账号密码

spec 规定只有两个硬编码账号 `Lucassss` / `XY_`，无注册接口。要改密码：

```bash
cd /home/zhenjie/art-school-management/backend
source .venv/bin/activate
python <<'PY'
from app.database import SessionLocal
from app.models.user import User
from app.routers.auth import hash_password

NEW = {"Lucassss": "新密码1", "XY_": "新密码2"}
with SessionLocal() as db:
    for username, pwd in NEW.items():
        u = db.query(User).filter(User.username == username).first()
        if u:
            u.password_hash = hash_password(pwd)
            print(f"  updated {username}")
    db.commit()
PY
```

> 改完不需要重启后端，下次登录就用新密码。

---

## 六、手动触发月度课表生成

正常情况下 APScheduler 每月 1 日 00:05 SGT 自动跑。手动触发：

```bash
TOKEN=$(curl -s -X POST https://test.javine.ai/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"XY_","password":"and2026!"}' \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')

# 当月（默认）
curl -s -X POST https://test.javine.ai/api/sessions/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{}'

# 指定月份
curl -s -X POST https://test.javine.ai/api/sessions/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"month":"2026-07"}'
```

幂等：已存在的记录不会重复生成。

---

## 七、HTTPS / 证书

certbot 已设置自动续期（`/etc/cron.d/certbot` 或 `systemd-timer`）。手动操作：

```bash
sudo certbot renew --dry-run            # 测试续期
sudo certbot certificates               # 看所有证书状态
sudo certbot renew                      # 立即续期到期证书
```

---

## 八、环境变量参考（`backend/.env`）

| 变量 | 含义 | 默认 |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy URL | `sqlite:///./art_school.db` |
| `JWT_SECRET` | JWT 签名密钥 | 必须改 |
| `JWT_ALGORITHM` | | `HS256` |
| `JWT_EXPIRE_MINUTES` | token 有效期（分钟）| `720` |
| `TIMEZONE` | 业务时区 | `Asia/Singapore` |
| `SEED_EXCEL_PATH` | seed 时读的 Excel 路径 | 相对 `backend/` 解析；`../Book1.xlsx` |

改完 `.env` 必须重启 systemd 服务。

---

## 九、常见排错

| 现象 | 排查 |
|---|---|
| 登录返回 401 | 密码错；或 JWT_SECRET 改过导致旧 token 失效（用户重新登录即可）|
| `/api/students` 返回 501 | 部署的代码版本旧；`sudo systemctl restart art-school-api` |
| 前端 `index.html` 是旧版 | `publish-frontend.sh` 没跑；浏览器缓存（hard reload）|
| nginx 502 | 后端没起：`systemctl status art-school-api` 看错误 |
| 时区不对（生成的课表日期偏移）| `.env` 的 `TIMEZONE` 没设；重启 |
| 证书快过期 | `sudo certbot renew`；查 `journalctl -u snap.certbot` |
| `INSERT` 报 UNIQUE 错 | 课时记录唯一键 (student_id, schedule_id, session_date) 已存在；幂等保护正常 |
| APScheduler 没跑 | `journalctl -u art-school-api` grep "scheduler"；当前日志不显式打印 INFO（uvicorn logger 配置原因），但 trigger 在内存注册 |

---

## 十、回滚

完全卸载 test.javine.ai 站点：

```bash
sudo systemctl disable --now art-school-api
sudo rm /etc/systemd/system/art-school-api.service
sudo systemctl daemon-reload

sudo rm /etc/nginx/sites-enabled/test.javine.ai
sudo rm /etc/nginx/sites-available/test.javine.ai
sudo nginx -t && sudo systemctl reload nginx

sudo certbot delete --cert-name test.javine.ai

sudo rm -rf /var/test/javine.ai
# DB 谨慎处理：rm -f /home/zhenjie/art-school-management/backend/art_school.db*
```
