# Notica — Architecture

Notica là hệ thống centralized alert & notification cho các backup jobs trong homelab infrastructure. Backup scripts từ bất kỳ stack nào chỉ cần gọi một HTTP POST duy nhất; mọi logic routing, scheduling, và formatting tập trung tại Notica.

---

## System Overview

```
Backup Scripts (bash / python / ansible / cron)
        │
        │  POST /api/v1/alerts
        ▼
┌────────────────────────────────────────────────────────────┐
│                        NOTICA                              │
│                                                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────┐ │
│  │  Ingestion API  │  │    Web API      │  │ Scheduler │ │
│  │  POST /alerts   │  │  Jobs CRUD      │  │ APSched   │ │
│  │  Validate       │  │  Alerts query   │  │ Digest    │ │
│  │  Store + Notify │  │  Schedules CRUD │  │ Retention │ │
│  └────────┬────────┘  │  Contacts CRUD  │  └─────┬─────┘ │
│           │           └────────┬────────┘        │       │
│           └──────────┬─────────┘                 │       │
│                      ▼                           │       │
│           ┌──────────────────────────────────────┘       │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │               PostgreSQL 16                     │    │
│  │  jobs · alerts · schedules · contacts           │    │
│  │  schedule_executions · settings                 │    │
│  └──────────────────────────────────────────────── ┘    │
│                      │                                   │
│                      ▼                                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │           Notification Engine                   │    │
│  │  ┌──────────────────┐  ┌──────────────────────┐ │    │
│  │  │  Immediate Mode  │  │    Digest Mode       │ │    │
│  │  │  on_failure /    │  │  cron schedule       │ │    │
│  │  │  on_warning      │  │  time window aggreg. │ │    │
│  │  └──────────────────┘  └──────────────────────┘ │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
        │
        ▼
Teams Workflows Webhook     [Email — future]     [Slack — future]
(Adaptive Cards v1.2)
```

---

## Tech Stack

| Layer | Technology | Lý do |
|---|---|---|
| Backend | Python 3.12 + FastAPI (async) | Async, ecosystem tốt, dễ maintain |
| ORM | SQLAlchemy 2.0 async + asyncpg | Async native, TOAST cho large blob |
| Migrations | Alembic | Standard, autogenerate |
| Scheduler | APScheduler 3.x (AsyncIOScheduler) | Embedded, không cần Redis/Celery |
| Database | PostgreSQL 16 | TOAST tự động cho log_content lớn |
| Frontend | React 18 + TypeScript + Vite | |
| UI Library | shadcn/ui + Tailwind CSS | |
| Data fetching | TanStack Query v5 | |
| Table | TanStack Table v8 | Server-side pagination + sort |
| URL state | nuqs | Filter state survive refresh |
| Log viewer | Shiki + @tanstack/react-virtual | Syntax highlight + virtual scroll |
| Cron UX | cronstrue + cron-parser | Human-readable cron preview |
| Serve | Nginx (SPA + reverse proxy) | /api/* → FastAPI, /* → React |
| Deploy | Docker Compose | 3 services: frontend, backend, db |
| Notification | Teams Workflows Webhook | Adaptive Cards v1.2 |

---

## Database Schema

### `jobs`
```sql
id                  UUID PRIMARY KEY
name                VARCHAR(255) UNIQUE NOT NULL   -- key dùng khi script gọi API
description         TEXT
token               VARCHAR(64) NOT NULL UNIQUE    -- per-job auth token, plaintext, viewable on UI
expected_cron       VARCHAR(100)                   -- cron expression để detect overdue
grace_period        INTEGER DEFAULT 30             -- phút, sau cron fire mới tính overdue
tags                JSONB DEFAULT '{}'             -- predefined: {"env":"prod|dev|dr|other","service":"db|app|service|other"}; set/edit via UI
immediate_on        VARCHAR[] DEFAULT '{}'         -- statuses trigger immediate: ['failure','warning']
immediate_contacts  UUID[] DEFAULT '{}'            -- contact IDs nhận immediate alert
active              BOOLEAN DEFAULT true
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

### `alerts`
```sql
id              UUID PRIMARY KEY
job_id          UUID REFERENCES jobs(id) ON DELETE CASCADE
job_name        VARCHAR(255) NOT NULL       -- denormalized để query nhanh
status          VARCHAR(20) NOT NULL        -- success | failure | warning | skipped
completion_time TIMESTAMPTZ NOT NULL        -- thời điểm backup xong (từ script)
duration_sec    INTEGER                     -- tính từ script, optional
description     TEXT                        -- mô tả ngắn của run này
log_content     TEXT                        -- backup log, defer() khi query list
tags            JSONB DEFAULT '{}'
received_at     TIMESTAMPTZ DEFAULT now()   -- server-side timestamp
```

### `contacts`
```sql
id          UUID PRIMARY KEY
name        VARCHAR(255) NOT NULL
type        VARCHAR(50) NOT NULL            -- teams_webhook | email | slack
config      JSONB NOT NULL                  -- {"webhook_url": "..."}
active      BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ DEFAULT now()
```

### `schedules`
```sql
id          UUID PRIMARY KEY
name        VARCHAR(255) NOT NULL
cron_expr   VARCHAR(100) NOT NULL
contacts    UUID[] NOT NULL             -- contacts nhận digest
active      BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ DEFAULT now()
-- Schedules chỉ dùng cho Digest mode. Immediate mode config nằm trên jobs table.
```

### `schedule_executions`
```sql
id           UUID PRIMARY KEY
schedule_id  UUID REFERENCES schedules(id) ON DELETE CASCADE
fired_at     TIMESTAMPTZ NOT NULL        -- thời điểm digest được fire
status       VARCHAR(20) NOT NULL        -- success | forced | failure
created_at   TIMESTAMPTZ DEFAULT now()
```

**Status values:**
- `success` — scheduled digest chạy thành công; dùng làm cursor cho `window_start` của lần kế tiếp
- `forced` — kết quả từ "Run Now" button; không advance cursor, scheduled fire vẫn chạy đúng hạn
- `failure` — digest gặp lỗi khi gửi

**Cursor model (digest window):** cả scheduled lẫn Run Now đều dùng `last_success.fired_at` làm `window_start`. Run Now là "preview" — alerts trong window cũ vẫn hiển thị nhưng cursor không bị advance.

### `settings`
```sql
key   VARCHAR(100) PRIMARY KEY
value JSONB NOT NULL
```

| Key | Mô tả | Default |
|---|---|---|
| `retention_days` | Số ngày giữ alerts trước khi purge | `90` |
| `app_url` | Base URL cho deep links trong digest cards | env `APP_URL` |
| `display_timezone` | Timezone hiển thị UI và APScheduler cron | `Asia/Ho_Chi_Minh` |
| `organization_name` | Tên tổ chức, hiển thị trong Sidebar và Teams cards | `Notica` |
| `logo_data` | Logo image encode base64 | — |
| `logo_mime` | MIME type của logo (`image/png`, `image/jpeg`, `image/svg+xml`) | — |
| `favicon_data` | Favicon image encode base64 | — |
| `favicon_mime` | MIME type của favicon | — |

---

## API Design

### Ingestion (backup scripts gọi)
```
POST /api/v1/alerts
Header:
  X-Job-Token*    string    -- token của job, lấy từ UI sau khi đăng ký
Body:
  status*         enum      -- success | failure | warning | skipped
  completion_time* datetime -- ISO 8601
  description     string
  log_content     string    -- backup log, có thể lớn (newlines preserved)
  duration_sec    integer
  tags            object    -- deprecated for alert ingestion; job-level tags are set via UI (env/service)
```
Token verify flow: lookup job theo `X-Job-Token` → 401 nếu không tìm thấy hoặc job inactive.

### Jobs (admin quản lý qua UI)
```
GET    /api/v1/jobs                       -- list với latest alert status
POST   /api/v1/jobs                       -- tạo job, auto-generate token
GET    /api/v1/jobs/{id}                  -- bao gồm token (viewable anytime)
PUT    /api/v1/jobs/{id}
DELETE /api/v1/jobs/{id}
POST   /api/v1/jobs/{id}/regenerate-token -- tạo token mới, invalidate token cũ
GET    /api/v1/jobs/{id}/alerts           -- history của job cụ thể
```

### Alerts
```
GET /api/v1/alerts                   -- list, có filter: job_id, status, tags,
                                     --   date_from, date_to, page, size
GET /api/v1/alerts/{id}              -- bao gồm log_content
```

### Schedules
```
GET    /api/v1/schedules
POST   /api/v1/schedules
PUT    /api/v1/schedules/{id}
DELETE /api/v1/schedules/{id}
POST   /api/v1/schedules/{id}/trigger  -- manual trigger digest ngay
```

### Contacts
```
GET    /api/v1/contacts
POST   /api/v1/contacts
PUT    /api/v1/contacts/{id}
DELETE /api/v1/contacts/{id}
POST   /api/v1/contacts/{id}/test    -- gửi test message
```

### Settings
```
GET /api/v1/settings     -- trả về: retention_days, app_url, display_timezone,
                         --         organization_name, has_logo, has_favicon
PUT /api/v1/settings     -- update bất kỳ field nào (patch semantics)
```

### Assets (logo & favicon)
```
POST   /api/v1/assets/logo      -- upload logo, PNG/JPG/SVG, max 500 KB (auth)
GET    /api/v1/assets/logo      -- serve logo từ DB, Cache-Control 1h (public)
DELETE /api/v1/assets/logo      -- xóa logo (auth)
POST   /api/v1/assets/favicon   -- upload favicon, PNG/ICO/SVG, max 50 KB (auth)
GET    /api/v1/assets/favicon   -- serve favicon (public)
DELETE /api/v1/assets/favicon   -- xóa favicon (auth)
```

Assets lưu trong `settings` table dưới dạng base64 (`logo_data`, `logo_mime`, `favicon_data`, `favicon_mime`). Không cần filesystem hay object storage.

---

## Notification Engine

### Immediate Mode
Config nằm trên từng **job** (không phải schedule). Mỗi job có:
- `immediate_on`: danh sách status trigger immediate (vd: `['failure', 'warning']`)
- `immediate_contacts`: danh sách contact IDs nhận immediate alert

Flow khi alert đến:
1. Ingestion API verify `X-Job-Token` → lấy job record
2. Lưu alert vào DB
3. Nếu `alert.status` nằm trong `job.immediate_on` → fire notify đến `job.immediate_contacts`
4. Fire & forget async, không block response cho caller
5. Alert vẫn được đưa vào digest (hai luồng song song, không loại trừ nhau)

Ví dụ: job "mysql-prod" có `immediate_on: [failure, warning]` → failure xảy ra → Teams ping ngay + sáng hôm sau vẫn xuất hiện trong digest báo cáo.

### Digest Mode
Chạy theo cron qua APScheduler:
1. `CronTrigger` fires theo `cron_expr`, timezone lấy từ `display_timezone` setting
2. `get_last_success(schedule_id)` → `window_start` (cursor-based, chỉ `status="success"`)
3. Query alerts trong `[window_start, now]`
4. Nếu không có alerts → skip (không gửi empty digest)
5. Format Adaptive Card (summary bar + table rows) với `org_name` từ settings
6. Gửi đến từng contact
7. Insert vào `schedule_executions` với `status="success"` (advance cursor)

**Run Now (manual trigger):**
- Dùng cùng `window_start` logic (last `"success"` cursor)
- Gửi card với subtitle `· Manual Run`
- Ghi `status="forced"` → cursor không bị advance
- Scheduled fire kế tiếp vẫn dùng đúng window cũ (không bị "consumed")

### Teams Notification Format
- **Immediate**: Adaptive Card FactSet (job name, status, time, duration, error snippet)
- **Digest**: title `📊 {org_name} · {schedule_name}`, subtitle với `· Scheduled Run` hoặc `· Manual Run`, ColumnSet table, footer `{org_name} · {tz}`
- **Payload limit**: 28 KB — nếu digest lớn hơn, split thành multiple messages
- **Rate limit**: 4 req/s → gửi với delay 250ms giữa các contacts

---

## Frontend Structure

```
frontend/src/
  features/
    jobs/           # Job Registry CRUD + Job Board
    alerts/         # Alert History table + Log Viewer drawer
    schedules/      # Schedule Manager CRUD
    contacts/       # Contact Manager CRUD + Test button
    settings/       # Retention, timezone, branding (org name, logo, favicon)
  components/
    layout/
      Sidebar.tsx   # org name + logo động từ settings API; failure badge
      AppLayout.tsx # timezone + favicon effect
    ui/             # shadcn primitives
  lib/
    api.ts          # fetch wrapper: get/post/put/delete/upload(multipart)
    queryClient.ts
  hooks/
    useDebounce.ts
    usePagination.ts
```

### Dashboard Pages

| Page | Route | Mô tả |
|---|---|---|
| Job Board | `/` | Summary bar (pass/fail/overdue) + mini job cards với 7-run history strip |
| Alert History | `/alerts` | Table với date range + status + tag filter, sort, pagination. Row expand → log drawer |
| Job Detail | `/jobs/{id}` | Config job, xem token, nút Regenerate Token, immediate_on config |
| Schedules | `/schedules` | CRUD digest schedule, cron input với cronstrue preview, timezone label, Run Now button |
| Contacts | `/contacts` | CRUD contacts, "Test" button per contact |
| Settings | `/settings` | Branding (org name, logo, favicon), timezone, retention, app URL |

**Log Viewer (drawer):** render `log_content` với `white-space: pre-wrap` + `word-break: break-all` + font monospace. Virtual scroll cho log lớn. Không để log hiển thị luông tuồng 1 hàng — newlines và indentation được preserve đầy đủ.

---

## Docker Compose

```
services:
  db        postgres:16-alpine    -- persistent volume, healthcheck
  backend   python:3.12-slim      -- alembic migrate → uvicorn, port 8000 (internal)
  frontend  nginx:1.27-alpine     -- React SPA + proxy /api/ → backend, port 80
```

Nginx config: `location /api/ { proxy_pass http://backend:8000/api/; }` + SPA fallback.

---

## Observability

### Logging

Tất cả log từ backend ra **stdout dạng JSON một dòng** — compatible với Loki, ELK, CloudWatch, Docker log driver.

```json
{"timestamp": "2026-06-28T10:00:01.234567Z", "level": "INFO", "logger": "app.scheduler.jobs", "message": "digest_job fired", "request_id": "a1b2c3d4-..."}
```

| Field | Mô tả |
|---|---|
| `timestamp` | ISO 8601 UTC |
| `level` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `logger` | Python module path (e.g. `app.scheduler.jobs`) |
| `message` | Log message |
| `request_id` | UUID của HTTP request — trace từ nginx → backend |

### Request Tracing

Mỗi HTTP request có `X-Request-ID` header:
- Nginx tự generate nếu client không gửi, forward đến backend
- Backend echo lại trong response header
- Tất cả log trong scope của request có cùng `request_id`

### Nginx Access Log

Access log của nginx cũng dạng JSON, bao gồm `upstream_response_time` và `request_id` — phân tích latency và trace full request path từ client → nginx → backend.

---

## Future Extensions

- **Teams Bot** — thay thế Incoming Webhook, cho phép interactive cards (acknowledge alert, silence job)
- **Email adapter** — SMTP-based notification channel
- **Slack adapter** — Slack Incoming Webhook
- **Alert rules engine** — escalation nếu job fail N lần liên tiếp
- **Silence windows** — không alert trong giờ maintenance
- **Overdue Detection** — auto tạo alert `missed` khi job im lặng quá grace period
- **Multi-tenant** — nhiều team dùng chung, isolated data per team

---

## Implementation Phases

| Phase | Nội dung | Deliverable |
|---|---|---|
| 1 | Job Registry + Alert Ingestion API + Storage | API nhận alerts, lưu DB, CRUD jobs |
| 2 | Dashboard UI (Job Board + Alert History + Log Viewer) | Giao diện quan sát được |
| 3 | Notification — Immediate mode (Teams webhook) | Cảnh báo realtime khi failure |
| 4 | Notification — Digest mode (Schedule Manager + APScheduler) | Báo cáo định kỳ |
| 5 | Settings + Retention + Docker Compose packaging | Production-ready deploy |
| 6 | SSO Keycloak (hybrid auth), structured logging, ErrorBoundary | Open-source ready |
| 0.2.0 | Timezone fix (overdue + APScheduler), digest cursor model, org name, assets API, branding UI | Production bugs fixed + branding |
