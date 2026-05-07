# art-school-management

画画补习班管理系统 — FastAPI + SQLite 后端 / React + Ant Design 前端。

详细业务规格见 [`绘画学校管理系统spec.md`](./绘画学校管理系统spec.md)。
线上环境：<https://test.javine.ai>

---

## 目录结构

```
backend/    FastAPI + SQLAlchemy + Alembic + APScheduler
frontend/   React 18 + TypeScript + Vite + AntD 5
deploy/     nginx 站点 / systemd unit / 发布脚本 / RUNBOOK
```

## 技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 后端 | Python 3.11+ / FastAPI 0.115 | uvicorn 单进程，systemd 托管 |
| 数据库 | SQLite (WAL) | 单文件，无独立服务器；通过 alembic 迁移 |
| ORM | SQLAlchemy 2.x | |
| 认证 | JWT (python-jose) + bcrypt | 12h 过期；前端存 localStorage |
| 排程 | APScheduler | 月度课表自动生成（每月 1 日 00:05 SGT）|
| 前端 | React 18 + TS + Vite + AntD 5 + Zustand + Axios + dayjs | |
| 部署 | nginx 静态托管 dist/ + 反代 /api/ | certbot Let's Encrypt |

---

## 本地开发

### 后端

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # 修改 JWT_SECRET，设置 SEED_EXCEL_PATH（指向 ../Book1.xlsx）
python -m app.seed                   # 建表 + 写 schedules / users / 学生 / 配套
uvicorn app.main:app --reload --port 8000
```

健康检查：`GET http://localhost:8000/api/health`
交互式 API 文档：`http://localhost:8000/docs`

### 前端

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173 → 代理 /api 到 :8000
```

类型检查：`npm run lint`（运行 `tsc --noEmit`）。
生产打包：`npm run build` → `frontend/dist/`。

---

## 初始账号（spec §2，硬编码）

| 角色 | 用户名 | 密码 | 权限 |
|---|---|---|---|
| 老师 | `Lucassss` | `and2026_` | 学生管理、课时管理 |
| 管理员 | `XY_` | `and2026!` | 全部 + 营收 + 导出 |

---

## 项目状态

| 里程碑 | 内容 | 状态 |
|---|---|---|
| **M1** | 骨架 + 认证 + Excel seed (schedules / users / 100 学生 / 100 配套) | ✅ |
| **M2** | 学生 CRUD + 配套合并 + 欠费抵扣 + audit log（前后端）| ✅ |
| **M3** | 课时自动生成 + 批量确认 + 出勤统计 + APScheduler | ✅ |
| **M4** | 营收聚合 + Excel 三导出（admin only）| ✅ |
| **M5** | 边界测试与收尾 / 文档 | ✅ |

---

## API 一览

完整列表见 spec §六。运行后端后访问 `/docs` 看可交互版本。

```
认证       POST  /api/auth/login | /logout            GET /api/auth/me
学生       GET/POST     /api/students                GET/PUT/DELETE /api/students/{id}
配套       GET/POST     /api/students/{id}/packages  PUT /api/students/{id}/packages/{pkg_id}
审计       GET          /api/students/{id}/audit-logs
课时       GET          /api/sessions                POST /api/sessions/generate
           PUT          /api/sessions/{id}           POST /api/sessions/confirm
出勤       GET          /api/attendance/{student_id}
班级       GET          /api/schedules
营收(admin) GET         /api/revenue/summary | /details
导出(admin) GET         /api/export/students | /monthly-sessions | /revenue
```

---

## 部署 / 运维

- 首次部署到生产：[`deploy/README.md`](./deploy/README.md)
- 运维操作（重启 / 备份 / 恢复 / 日志 / 排错）：[`deploy/RUNBOOK.md`](./deploy/RUNBOOK.md)
- 前端重发布：`./deploy/publish-frontend.sh` （build + rsync 到 `/var/test/javine.ai/html/`，无需 sudo）
- 后端重启：`sudo systemctl restart art-school-api`
