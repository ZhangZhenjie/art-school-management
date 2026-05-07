# 画画补习班管理系统 — 开发规格文档

> 本文档供 Claude Code 进行全栈开发使用。请严格按照以下规格实现，不得自行简化业务逻辑。

---

## 一、技术栈

| 层 | 选型 |
|---|---|
| 后端 | Python 3.11 + FastAPI |
| 数据库 | SQLite（单文件，无需独立服务器）|
| ORM | SQLAlchemy 2.x + Alembic 迁移 |
| 前端 | React 18 + TypeScript + Vite |
| UI 组件库 | Ant Design 5.x |
| 状态管理 | Zustand |
| HTTP 客户端 | Axios |
| 认证 | JWT（python-jose），前端存 localStorage |
| 打包/运行 | 单仓库，`/backend` 和 `/frontend` 两个目录 |

后端启动：`uvicorn app.main:app --reload --port 8000`  
前端启动：`npm run dev`（代理 API 到 `http://localhost:8000`）

---

## 二、账号系统

系统只有两个硬编码用户，无需注册功能。在数据库 `users` 表初始化时写入：

| 字段 | Lucas | Y |
|---|---|---|
| username | `Lucassss` | `XY_` |
| password（bcrypt hash）| `and2026_` | `and2026!` |
| role | `teacher` | `admin` |

**权限说明：**
- `teacher`（Lucas）：可访问任务1（学生管理）和任务2（课时管理），**不可**访问任务3（营收统计）和任务4（导出）。
- `admin`（Y）：所有权限。

所有 API 路由需通过 JWT 中间件校验，并根据 role 做权限判断。前端导航菜单按权限动态渲染。

---

## 三、数据库 Schema

### 3.1 `schedules`（固定班级）

```sql
id          TEXT PRIMARY KEY,   -- 如 "2C", "3F1", "7B"
name        TEXT NOT NULL,       -- 如 "兴趣班", "专业班"
weekday     INTEGER NOT NULL,    -- 2=周二, 3=周三, 4=周四, 5=周五, 6=周六, 7=周日
start_time  TEXT NOT NULL,       -- "HH:MM" 格式
end_time    TEXT NOT NULL        -- "HH:MM" 格式
```

**初始数据**（从 Excel 导入，时间列是当天的小数比例，需转换为 HH:MM）：

| id | name | weekday | start_time | end_time |
|---|---|---|---|---|
| 2C | 兴趣班 | 2 | 16:30 | 18:30 |
| 2F | 专业班 | 2 | 16:30 | 18:30 |
| 3C1 | 兴趣班 | 3 | 15:00 | 17:00 |
| 3F1 | 专业班 | 3 | 15:00 | 17:00 |
| 3K | 小小艺术家 | 3 | 15:30 | 17:30 |
| 3C2 | 兴趣班 | 3 | 16:30 | 18:30 |
| 3F2 | 专业班 | 3 | 16:30 | 18:30 |
| 4K | 小小艺术家 | 4 | 15:30 | 17:00 |
| 4C1 | 兴趣班 | 4 | 15:30 | 17:30 |
| 4C2 | 兴趣班 | 4 | 16:00 | 18:00 |
| 4F1 | 专业班 | 4 | 16:00 | 18:00 |
| 4F2 | 专业班 | 4 | 19:00 | 21:00 |
| 5A | 升学班 | 5 | 15:00 | 17:00 |
| 5H | 手工班 | 5 | 15:00 | 17:00 |
| 6C1 | 兴趣班 | 6 | 09:00 | 11:00 |
| 6F1 | 专业班 | 6 | 10:00 | 12:00 |
| 6K1 | 小小艺术家 | 6 | 11:00 | 12:30 |
| 6C2 | 兴趣班 | 6 | 11:00 | 13:00 |
| 6F2 | 专业班 | 6 | 13:30 | 16:00 |
| 6C3 | 兴趣班 | 6 | 14:00 | 16:00 |
| 6K2 | 小小艺术家 | 6 | 16:00 | 17:30 |
| 6F3 | 专业班 | 6 | 16:00 | 18:00 |
| 6C4 | 兴趣班 | 6 | 16:00 | 18:00 |
| 7K1 | 小小艺术家 | 7 | 10:30 | 12:00 |
| 7C1 | 兴趣班 | 7 | 10:00 | 12:00 |
| 7F1 | 专业班 | 7 | 10:00 | 12:30 |
| 7C2 | 兴趣班 | 7 | 13:30 | 15:30 |
| 7F2 | 专业班 | 7 | 13:30 | 15:30 |
| 7F3 | 专业班 | 7 | 15:30 | 18:00 |
| 7K2 | 小小艺术家 | 7 | 16:00 | 17:30 |
| 7C3 | 兴趣班 | 7 | 16:00 | 18:00 |
| 7B | 成人班 | 7 | 16:00 | 18:00 |

> **注意**：部分学生的 `current_schedule_id` 为 `1O`，这是一个线下私课标识，不在 schedules 表中。系统需容许 schedule_id 为 `1O` 或 NULL（即无固定班级），这类学生不会自动生成课表。

---

### 3.2 `students`（学生）

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
name            TEXT NOT NULL,
birthday        DATE,               -- 可为 NULL
email           TEXT,               -- 可为 NULL 或 "NA"
parent_name     TEXT,               -- 可为 NULL
phone           TEXT,               -- 可为 NULL
schedule_id     TEXT,               -- FK -> schedules.id，可为 NULL（1O 或无班级）
is_active       BOOLEAN DEFAULT 1   -- 软删除标志
```

**初始数据**：从 Excel `student` sheet 导入。  
- birthday 列是 Excel 序列号（基准 1899-12-30），需转换为 ISO 日期。  
- `NA` 字符串的字段存为 NULL。  
- `1O` schedule_id 保留原值（不做 FK 约束，或用可为空的软引用）。

---

### 3.3 `packages`（配套）

一个学生可同时拥有多个配套，每个配套独立计价。

```sql
id                  INTEGER PRIMARY KEY AUTOINCREMENT,
student_id          INTEGER NOT NULL,   -- FK -> students.id
purchased_classes   REAL NOT NULL,      -- 购买课时数
gifted_classes      REAL NOT NULL DEFAULT 0, -- 赠课数
total_classes       REAL NOT NULL,      -- = purchased_classes + gifted_classes
unit_price          REAL NOT NULL,      -- 课单价（购买总价 / total_classes）
purchase_price      REAL NOT NULL,      -- 购买总价
remaining_classes   REAL NOT NULL,      -- 剩余课时（可为负）
start_date          DATE NOT NULL,      -- 购买/添加日期
end_date            DATE NOT NULL,      -- 有效期截止日
is_negative         BOOLEAN DEFAULT 0,  -- 标记为"欠费"状态的配套
created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
```

**有效期计算规则**（新建配套时由后端自动计算）：
- 购买 1–47 节课（含）：end_date = start_date + 4 个月
- 购买 48 节课及以上：end_date = start_date + 16 个月

**初始数据**：从 Excel `student_package` sheet 导入，`remaining_classes` 来自 Sheet3 第二列，`unit_price` 来自第三列，`start_date`=2025-07-01，`end_date`=2026-12-01（Excel 序列号转换值）。`purchased_classes` 和 `gifted_classes` 初始导入时暂设为 `total_classes=remaining_classes`，`gifted_classes=0`（因原始数据未区分）。

---

### 3.4 `class_sessions`（课时记录）

系统每月自动生成、老师手工确认。

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
student_id      INTEGER NOT NULL,   -- FK -> students.id
schedule_id     TEXT NOT NULL,      -- 上课的班级 ID
session_date    DATE NOT NULL,      -- 具体上课日期
attended        BOOLEAN DEFAULT 1,  -- 是否出席（默认来）
confirmed       BOOLEAN DEFAULT 0,  -- 老师是否已确认
confirmed_by    TEXT,               -- 确认人 username
confirmed_at    DATETIME,
package_id      INTEGER,            -- 对应消耗的配套 FK -> packages.id
classes_deducted REAL DEFAULT 1,    -- 扣除课时数（一般为1）
revenue_amount  REAL,               -- = classes_deducted * unit_price（确认时计算）
revenue_month   TEXT,               -- 营收归属月份 "YYYY-MM"（确认时自动填当月）
UNIQUE(student_id, schedule_id, session_date)
```

---

### 3.5 `audit_logs`（操作审计日志）

所有手动修改课时、课单价、有效期、营收月份的操作都需记录。

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
operator        TEXT NOT NULL,      -- 操作人 username
operated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
entity_type     TEXT NOT NULL,      -- "package" | "student" | "session"
entity_id       INTEGER NOT NULL,
field_name      TEXT NOT NULL,      -- 被修改的字段名
old_value       TEXT,
new_value       TEXT,
note            TEXT                -- 备注原因（手动修改必填）
```

---

### 3.6 `revenue_adjustments`（营收调整记录）

用于记录删除学生、新配套抵扣欠费等产生的特殊营收。

```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT,
student_id      INTEGER,
student_name    TEXT NOT NULL,      -- 冗余字段，以防学生被删
reason          TEXT NOT NULL,      -- "student_deleted" | "deduct_arrears"
amount          REAL NOT NULL,
classes_count   REAL NOT NULL,
unit_price      REAL NOT NULL,
revenue_month   TEXT NOT NULL,      -- "YYYY-MM"
operated_by     TEXT NOT NULL,
operated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
note            TEXT
```

---

## 四、业务逻辑详解

### 4.1 学生状态（前端实时计算，无需存储）

从学生所有配套派生以下状态标签（可多个并存）：

| 状态 | 判断条件 |
|---|---|
| 🔴 欠费 | 任意配套 `remaining_classes < 0` |
| 🟡 余额低 | 所有配套合计 `remaining_classes <= 4` 且 `>= 0` |
| ⏰ 快过期 | 最近一个有效配套距 `end_date` ≤ 30 天 |

---

### 4.2 流程1.1 — 添加新学生及配套

1. 填写学生基本信息（姓名必填，其余可选）
2. 同时填写第一个配套：购买课时数、赠课数、购买总价
3. 后端计算：
   - `total_classes = purchased_classes + gifted_classes`
   - `unit_price = purchase_price / total_classes`
   - `end_date` 按购买课时数规则自动计算（见 3.3）
   - `remaining_classes = total_classes`
4. 写入 `students` + `packages`

---

### 4.3 流程1.2 — 现有学生新增配套

**核心合并逻辑（后端执行）：**

```
新配套信息 = {purchased, gifted, purchase_price, start_date=today}

计算新配套:
  new_total = purchased + gifted
  new_unit_price = purchase_price / new_total
  new_end_date = start_date + (4个月 if purchased < 48 else 16个月)

查找学生现有配套中是否存在:
  unit_price == new_unit_price 且 schedule_type 相同（同课程类型）？

若"可合并"（价格和课程类型均相同）:
  merged_remaining = old_remaining + new_total
  merged_end_date = max(old_end_date, new_end_date)
  更新原配套，记录 audit_log

若"不可合并":
  按 start_date 排序，新建一条配套记录（先使用旧配套）

欠费抵扣（若学生 remaining < 0）:
  arrears = abs(旧配套 remaining_classes)  -- 欠费课时数（正数）
  在新配套 remaining_classes 中扣除 arrears
  新配套 remaining_classes -= arrears
  将 arrears 对应的营收（arrears × new_unit_price）写入 revenue_adjustments
  营收归属月份：默认当前月，管理员可手动指定
```

---

### 4.4 流程1.3 — 删除学生

- 软删除：`students.is_active = 0`
- 剩余课时（所有配套合计 remaining > 0 的部分）作废，金额写入 `revenue_adjustments`，reason = `student_deleted`
- 营收归属月份：默认当前月，管理员可手动指定
- 所有操作记录 `audit_logs`

---

### 4.5 流程1.4 — 修改学生信息

- 修改任意以下字段时，**必须**填写备注，并自动写入 `audit_logs`：
  - `remaining_classes`（任意配套）
  - `unit_price`（任意配套）
  - `end_date`（任意配套）
  - `revenue_month`（任意营收调整）
- 其他基本信息（姓名、电话等）修改无需备注

---

### 4.6 任务2 — 课时管理

#### 每月自动生成课表

- 触发时机：每月1日自动生成当月所有有效学生的课时记录（也支持管理员手动触发）
- 规则：
  - 找到学生的 `schedule_id` → 查 `schedules` 表得到 weekday
  - 枚举当月所有符合 weekday 的日期
  - 每条记录：`attended=1`，`confirmed=0`
  - **已存在的记录（confirmed=1 或已手工创建）不覆盖**
  - `schedule_id=1O` 或 NULL 的学生不生成

#### 课时消耗确认规则

当老师点击"确认本周/本月课时"时：

```
对所有 confirmed=0 的本期记录：
  attended=1：
    找学生当前最旧的、remaining_classes>0 的配套
    若无正余额配套，则用最旧配套（产生欠费）
    classes_deducted = 1
    revenue_amount = 1 × package.unit_price
    revenue_month = 当前月份（默认）
    package.remaining_classes -= 1
    session.confirmed = 1

  attended=0：
    classes_deducted = 0，revenue_amount = 0
    confirmed = 1，不扣课时
```

确认后触发学生状态重新计算（余额低、欠费检查）。

#### 两个课表视图

**视图A — 按班级/日期**

- 选择日期（默认今天）→ 显示当天所有有课的班级
- 每个班级展开显示该班当天的学生列表
- 每个学生一行：姓名 + 出席/缺席切换按钮
- 支持批量确认当天/当周

**视图B — 按学生**

- 选择学生 → 显示该学生的月历或周视图
- 仅显示其固定班级对应的日期
- 标注出席 ✓ / 缺席 ✗ / 未确认 ？

#### 出勤统计

- 按学生查询指定月份/年度的出勤率
- 出勤率 = 实际出席次数 / 应出席次数（固定班级应出席次数）

---

### 4.7 任务3 — 营收统计（仅 admin）

所有营收来源：
1. `class_sessions`：`revenue_amount`（已确认的正常课时）
2. `revenue_adjustments`：欠费抵扣、删除学生

营收统计 API：
- 月度营收：指定 `YYYY-MM` → 汇总上述两个来源
- 自定义期间：指定起止日期
- 细项：班级维度、课程类型维度

前端展示：
- 月度总营收数值
- 月度总课时消耗数
- 表格：按学生列出当月消耗课时数、营收金额
- Optional：按星期几分组的月/半年营收

---

### 4.8 任务4 — 数据导出（仅 admin）

所有导出返回 Excel (.xlsx) 文件：

**导出1 — 学生及配套**

列：学生姓名 | 班级 | 课程类型 | 配套剩余课时 | 课单价 | 有效期至 | 学生状态

**导出2 — 当月课时消耗**

列：学生名 | 课程类型 | 上课次数（出席） | 消耗课时数

**导出3 — 月度营收记录**

列：月份 | 学生名 | 消耗课时 | 课单价 | 营收金额 | 备注（是否含调整项）

---

## 五、初始数据导入

系统首次启动时自动执行 `seed.py`，导入 Excel 数据：

1. 写入 `schedules`（见 3.1 完整列表）
2. 写入 `students`（98 名学生，见 Excel `student` sheet）
   - birthday Excel 序列号转换：`datetime(1899,12,30) + timedelta(days=serial)`
3. 写入 `packages`（对应 Excel `student_package` sheet）
   - `remaining_classes` = Sheet3 第2列值（可为负）
   - `unit_price` = Sheet3 第3列值
   - `purchased_classes` = `remaining_classes`（初始简化处理）
   - `gifted_classes` = 0
   - `start_date` = 2025-07-01，`end_date` = 2026-12-01
4. 写入两个初始用户（bcrypt hash 密码）

---

## 六、API 路由一览

### 认证
```
POST /api/auth/login        → { access_token, role }
POST /api/auth/logout
GET  /api/auth/me
```

### 学生管理
```
GET    /api/students                    → 学生列表（含状态标签、配套摘要）
POST   /api/students                    → 新增学生（含首个配套）
GET    /api/students/{id}               → 学生详情
PUT    /api/students/{id}               → 修改基本信息
DELETE /api/students/{id}               → 软删除（需指定营收月份）

GET    /api/students/{id}/packages      → 该学生所有配套
POST   /api/students/{id}/packages      → 新增配套（含合并逻辑）
PUT    /api/students/{id}/packages/{pkg_id} → 手动修改配套（需备注）

GET    /api/students/{id}/audit-logs    → 该学生操作日志
```

### 课时管理
```
GET    /api/sessions                    → 查询（by date/student/schedule/month）
POST   /api/sessions/generate           → 手动触发当月生成
PUT    /api/sessions/{id}               → 修改出席状态
POST   /api/sessions/confirm            → 批量确认（by week/month/schedule）

GET    /api/attendance/{student_id}     → 出勤统计（?year=&month=）
```

### 营收（admin only）
```
GET    /api/revenue/summary             → 营收汇总（?from=&to= 或 ?month=）
GET    /api/revenue/details             → 明细列表
```

### 导出（admin only）
```
GET    /api/export/students             → 学生配套 Excel
GET    /api/export/monthly-sessions     → 当月课时 Excel（?month=）
GET    /api/export/revenue              → 营收记录 Excel（?month=）
```

### 班级
```
GET    /api/schedules                   → 所有班级列表
```

---

## 七、前端页面结构

```
/ (登录页)
/dashboard
  /students              学生列表（含状态badge、搜索、筛选）
    /students/new        新增学生
    /students/:id        学生详情（含配套列表、操作日志）
  /sessions
    /sessions/by-class   按班级视图（日期选择 + 班级列表）
    /sessions/by-student 按学生视图（月历）
  /revenue               营收统计（admin only）
  /export                数据导出（admin only）
```

---

## 八、重要实现细节

1. **课时扣除顺序**：一个学生有多个配套时，按 `created_at`（或 `start_date`）**从旧到新**依次消耗，先把旧配套用完再用新的。

2. **负数课时**：`remaining_classes` 可为负，不阻止业务操作，只触发"欠费"状态标签和提醒。

3. **已确认记录保护**：`confirmed=1` 的课时记录只有管理员可手动修改，且修改需记录 `audit_logs`。

4. **时区**：所有日期按新加坡时间（Asia/Singapore，UTC+8），后端使用 `pytz` 处理。

5. **学生状态计算**：在 `GET /api/students` 和 `GET /api/students/:id` 时实时聚合计算，不存储到数据库。

6. **并发**：仅两个用户，无需复杂并发控制。SQLite WAL 模式即可。

7. **删除学生后**：其 `class_sessions` 历史记录保留（用于历史营收查询），student 仅做软删除。

8. **导出格式**：使用 `openpyxl` 生成，中文列头，数字列右对齐，日期列格式化为 `YYYY-MM-DD`。

---

## 九、开发优先级（建议顺序）

1. 数据库 schema + seed 脚本（含初始数据导入）
2. 认证 API + JWT 中间件
3. 学生管理 API（增删改查 + 配套逻辑）
4. 前端登录 + 学生列表页 + 学生详情页
5. 课时生成 + 确认 API
6. 课时管理前端（两个视图）
7. 营收统计 API + 前端
8. 数据导出 API + 前端按钮
9. Audit log 前端展示
10. 整体测试 + 边界情况处理（负课时、配套合并）

---

*文档版本：v1.0 | 生成时间：2026-05-07*
