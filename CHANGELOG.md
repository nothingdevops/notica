# Changelog

All notable changes to Notica are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.2.0] — 2026-06-29

### Fixed

- **Overdue detection sai timezone** — `_is_overdue()` dùng `croniter` với UTC thay vì timezone của instance. Fix: dùng `ZoneInfo(tz_str)` từ `display_timezone` setting.
- **APScheduler CronTrigger sai timezone** — `CronTrigger` cứng `UTC` → digest fire sai giờ. Fix: load `display_timezone` từ settings lúc app start, truyền vào `CronTrigger(timezone=tz)`.
- **Idempotency block scheduled fire sau Run Now** — Run Now ghi `status="success"` → scheduled fire bị skip. Fix: Run Now ghi `status="forced"`, `get_last_success` chỉ xét `"success"` → scheduled cursor không bị ảnh hưởng.
- **Digest window overlap** — Run Now tính `window_start` từ `get_last_execution` → alerts đã gửi bị gom lại. Fix: cả hai trigger đều dùng `get_last_success` cho window cursor; Run Now là "preview" không advance cursor.

### Added

- **`schedule_executions.status` mở rộng** — `success` (scheduled fire), `forced` (Run Now), `failure`.
- **`ScheduleRepository.get_last_execution()`** — execution gần nhất bất kỳ status, dùng cho display.
- **`ScheduleRepository.get_last_success()`** — chỉ `status="success"`, dùng cho idempotency + window cursor.
- **Setting `organization_name`** — tên tổ chức, mặc định `"Notica"`, lưu DB. Hiển thị trong Sidebar và Teams cards.
- **Settings response** — thêm `has_logo: bool`, `has_favicon: bool`.
- **Assets API** — logo/favicon lưu base64 trong settings table:
  - `POST /api/v1/assets/logo` — PNG/JPG/SVG, max 500 KB (auth required)
  - `GET /api/v1/assets/logo` — public, `Cache-Control: public, max-age=3600`
  - `DELETE /api/v1/assets/logo` — auth required
  - Tương tự `/assets/favicon` — PNG/ICO/SVG, max 50 KB
- **Adaptive Card** — title `📊 {org_name} · {schedule_name}`, subtitle `· Scheduled Run` / `· Manual Run`, footer `{org_name} · {tz}`.
- **Schedule card** — timezone label (e.g. `09:00 AM (UTC+7)`), `forced` → "Manual" badge.
- **Sidebar động** — org name và logo từ settings API; logo thay ⚡ khi có upload.
- **Dynamic favicon** — `AppLayout` cập nhật `<link rel="icon">` DOM khi `has_favicon` thay đổi.
- **`api.upload()` method** — multipart POST với Keycloak auth + `response.ok` check, tránh silent fail.
- **Cache-busting assets** — `?t={timestamp}` sau mỗi upload/delete.
- **Settings UI — Branding section** — org name, logo upload/preview/remove, favicon upload/preview/remove.

### Changed

- `DigestService.send_digest()` nhận thêm `force: bool` param.
- `SettingsUpdate` / `SettingsResponse` thêm `organization_name`, `has_logo`, `has_favicon`.

---

## [0.1.1] — 2026-06-xx

### Added (Observability & Production hardening)

- Structured JSON logging trên backend — stdout dạng JSON với `timestamp`, `level`, `logger`, `request_id`
- `X-Request-ID` middleware — trace từ nginx → backend log
- Nginx access log dạng JSON với `upstream_response_time`, `request_id`, `status`
- Gzip compression và long-cache headers cho JS/CSS/assets (`Cache-Control: public, immutable`, 1 năm)
- Docker log rotation — `json-file` driver, 50MB per file, giữ 5 files
- React `ErrorBoundary`, production build drop console logs qua esbuild

### Changed

- `entrypoint.sh` — startup logs có timestamp ISO-8601
- `vite.config.ts` — mode-aware config để áp dụng esbuild drop chỉ cho production

---

## [0.1.0] — 2026-06-01

Initial release.

### Phase 1 — Job Registry + Alert Ingestion
- Job registration với cron schedule, grace period, và per-job token (`X-Job-Token`)
- Alert ingestion API `POST /api/v1/alerts` — nhận `status`, `completion_time`, `duration_sec`, `description`, `log_content`
- Token lưu plaintext để hiển thị lại trên UI và regeneratable

### Phase 2 — React Dashboard
- Job Board: tổng quan trạng thái, 7 lần chạy gần nhất, overdue detection
- Alert History: tìm kiếm theo job/status/tag/date range, URL state qua nuqs
- Log Viewer: shadcn Sheet drawer, Shiki syntax highlight, react-virtual cho file lớn
- Job tags: `env` (prod/dev/dr/other) và `service` (db/app/service/other), lưu JSONB

### Phase 3 — Immediate Notifications
- Teams Adaptive Cards v1.2 qua Workflows webhook
- Per-job config: status nào fire ngay, contact nào nhận
- Rate limiting: 250ms delay giữa các contact calls

### Phase 4 — Digest Mode
- APScheduler embedded trong FastAPI — không cần container riêng
- Schedule Manager UI với cron expression và cronstrue preview
- Idempotency table `schedule_executions` — tránh gửi digest 2 lần khi restart
- Split payload > 28KB thành nhiều messages

### Phase 5 — Settings + Retention
- Settings API + UI: `retention_days`, `app_url`
- Retention purge job: batch DELETE 500 rows + 100ms pause
- Docker Compose production packaging

### Phase 6 — SSO Keycloak
- PKCE S256 flow qua Keycloak external (public client, không cần client_secret)
- Runtime config `GET /api/v1/sso-config` — frontend fetch khi startup
- `SSO_ENABLED=false` mặc định — backward compatible
- `POST /api/v1/alerts` giữ X-Job-Token — scripts không làm OAuth flow
- Hybrid auth: management API bảo vệ bằng JWT, ingestion API dùng token

---

[Unreleased]: https://github.com/yourname/notica/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourname/notica/releases/tag/v0.1.0
