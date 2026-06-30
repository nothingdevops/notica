# Notica — Upgrade Guide

Hướng dẫn nâng cấp giữa các version. Mỗi entry liệt kê rõ: có cần chạy migration không, env var mới, breaking changes, và hành động cần làm.

**Quy tắc chung:**
- Luôn chạy `alembic upgrade head` sau khi pull code mới (lệnh này idempotent — an toàn kể cả khi không có migration mới)
- Backup DB trước khi upgrade production
- Restart tất cả services sau khi upgrade

---

## v2.0.13 — Backfill missed vào existing jobs

**Từ v2.0.12 → v2.0.13**

### Migration DB
**Cần chạy Alembic.** Migration `20260630000000` backfill `missed` vào `immediate_on` cho tất cả jobs đã opt-in immediate alerts.

```bash
# Docker Compose — entrypoint tự chạy khi restart:
docker compose up -d

# Thủ công:
cd backend && alembic upgrade head
```

### Hành động khi upgrade
```bash
git pull
docker compose up -d
```

### Thay đổi hành vi
- **Jobs có `immediate_on` non-empty** (vd: `{failure}`) sẽ được tự động add `missed` → `{failure, missed}` sau migration. Những jobs này sẽ bắt đầu nhận Teams notification khi bị overdue.
- **Jobs có `immediate_on = {}`** (không chọn gì) giữ nguyên — không bị ảnh hưởng.
- Nếu không muốn nhận overdue alert cho job nào cụ thể, vào Job Detail → bỏ toggle `missed`.

### Tại sao cần migration này
Jobs tạo trước A1 (overdue detection) chỉ có `failure` trong `immediate_on` vì `missed` chưa tồn tại. Sau khi upgrade lên A1, nếu backend restart và overdue scan phát hiện job im lặng, notification sẽ bị skip vì `"missed" not in immediate_on`. Migration này fix upgrade path đó.

---

## v2.0.12 — Logo clickable → trang chủ

**Từ v2.0.11 → v2.0.12**

### Migration DB
**Không cần.** Thay đổi frontend only.

### Hành động khi upgrade
```bash
git pull
docker compose up -d
```

### Thay đổi
- Logo và tên org trên Sidebar giờ là link clickable về trang chủ (`/`)
- Version string trong Sidebar cập nhật lên `v2.0.12`

---

## v2.0.11 — A1 Overdue Detection

**Từ v2.0.10 → v2.0.11**

### Migration DB
**Không cần.** Không có Alembic migration mới.
- `alerts.status` là `VARCHAR(20)` — giá trị `"missed"` (6 ký tự) fit sẵn
- `settings` là key-value table — key `overdue_scan_interval` được tạo tự động lần đầu save hoặc dùng default trong code

### Hành động khi upgrade
```bash
git pull
docker compose pull   # hoặc docker compose build
docker compose up -d
```

### Thay đổi hành vi
- **Job mới** sẽ có `immediate_on = ["failure", "missed"]` mặc định (trước là `["failure"]`). Job cũ **không bị ảnh hưởng** — giữ nguyên config.
- APScheduler tự đăng ký `overdue_scan_job` với interval 1 phút khi khởi động. Điều chỉnh trong **Settings → Operations → Overdue scan interval**.
- Alert `missed` xuất hiện trong Alert History và Digest như alert bình thường — không cần config thêm.

### Setting mới (tự động, không cần thêm tay)
| Key | Default | Mô tả |
|-----|---------|--------|
| `overdue_scan_interval` | `1` | Tần suất scan overdue (phút, 1–60). Thay đổi trong Settings UI, hiệu lực ngay |

---

## v2.0.10 — Analytics Dashboard + Delete Job + Dark Mode

**Từ v0.2.0 → v2.0.10**

### Migration DB
**Không cần.** Không có Alembic migration mới.

### Hành động khi upgrade
```bash
git pull
docker compose pull
docker compose up -d
```

### Breaking changes
- **Dark mode palette** đổi sang Deep Zinc C (`--bg-base #111111`). Nếu bạn có CSS custom override theme cũ, cần cập nhật lại theo biến mới.

### Tính năng mới (không cần config)
- `/analytics` — trang Analytics Dashboard (KPI, Health by Env, Problem Jobs, charts)
- Nút **Delete Job** trong Job Detail (Danger Zone, yêu cầu nhập tên job để xác nhận)

---

## v0.2.0 — Schedules, SSO, Branding, Timezone

**Từ v0.1.0 → v0.2.0**

### Migration DB
**Cần chạy Alembic.** Migration `20260626120000_phase4_schedules` thêm 2 bảng mới:
- `schedules` — lưu digest schedules
- `schedule_executions` — lưu lịch sử fire của từng schedule (dùng làm digest cursor)

```bash
# Nếu chạy Docker Compose (entrypoint tự chạy):
docker compose up -d
# Container sẽ tự chạy `alembic upgrade head` trước khi start server

# Nếu chạy thủ công:
cd backend
alembic upgrade head
```

### Env vars mới (thêm vào `.env`)
```bash
# SSO — bỏ qua nếu không dùng Keycloak
SSO_ENABLED=false
KEYCLOAK_URL=https://auth.example.com
KEYCLOAK_REALM=notica
KEYCLOAK_CLIENT_ID=notica-frontend
# KEYCLOAK_ISSUER=  # optional, tự derive nếu để trống

# APP_URL — base URL cho deep links trong digest cards
APP_URL=http://your-server-ip
```

Nếu không thêm `SSO_ENABLED`, mặc định là `false` — không bị break.

### Settings mới (tự động seed, không cần thêm tay)
Các key sau được tạo tự động qua `DEFAULTS` trong code khi Settings API được gọi lần đầu:

| Key | Default | Mô tả |
|-----|---------|--------|
| `display_timezone` | `Asia/Ho_Chi_Minh` | Timezone dùng cho CronTrigger, overdue check, Teams card, UI display |
| `app_url` | (từ env `APP_URL`) | Base URL cho deep links trong digest |
| `organization_name` | `Notica` | Tên tổ chức trong Teams digest card title |
| `logo_data` / `logo_mime` | (trống) | Logo upload qua Settings UI |
| `favicon_data` / `favicon_mime` | (trống) | Favicon upload qua Settings UI |

### Thay đổi hành vi
- **Digest cursor model**: `schedule_executions.status` phân biệt `success` (advance cursor) vs `forced` (Run Now, không advance). Nếu có schedule_executions cũ từ trước v0.2.0, các record đó không có ảnh hưởng — cursor chỉ đọc execution gần nhất.
- **Overdue detection** (flag `is_overdue` trên job) giờ dùng `display_timezone` thay vì UTC cố định.

---

## v0.1.0 — Initial Release (Phase 1–3)

Version đầu tiên. Cài fresh từ đầu.

### Setup
```bash
cp .env.example .env
# Chỉnh DATABASE_URL, POSTGRES_*, APP_ENV

docker compose up -d
# Container tự chạy alembic upgrade head → tạo toàn bộ schema ban đầu:
# jobs, contacts, alerts, settings (seed retention_days=90)
```

### Schema ban đầu (migration `20260626095350_initial_schema`)
- `jobs` — job registry với token, expected_cron, grace_period, tags, immediate_on, immediate_contacts
- `contacts` — Teams webhook contacts
- `alerts` — alert history với log_content (PostgreSQL TOAST)
- `settings` — key-value store, seed `retention_days = 90`

---

## Checklist upgrade tổng quát

```
[ ] Backup DB: docker exec notica-db pg_dump -U notica notica > backup-YYYYMMDD.sql
[ ] git pull (hoặc docker compose pull nếu dùng image)
[ ] Kiểm tra .env.example xem có env var mới không
[ ] docker compose up -d  (entrypoint tự chạy alembic upgrade head)
[ ] Kiểm tra logs: docker compose logs backend | head -30
[ ] Verify /health endpoint trả 200
[ ] Spot-check UI: job list, alert history, settings
```
