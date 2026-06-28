# Changelog

All notable changes to Notica are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Structured JSON logging trên backend — mọi log ra stdout dạng JSON với `timestamp`, `level`, `logger`, `request_id`
- `X-Request-ID` middleware — mỗi HTTP request có ID để trace từ nginx → backend log
- Nginx access log dạng JSON — bao gồm `upstream_response_time`, `request_id`, `status`
- Gzip compression cho static assets trên nginx
- Long-cache headers cho JS/CSS/assets (`Cache-Control: public, immutable`, 1 năm)
- Docker log rotation — `json-file` driver, 50MB per file, giữ 5 files
- `PYTHONDONTWRITEBYTECODE` + `PYTHONUNBUFFERED` trong Docker image
- React `ErrorBoundary` — fallback UI khi app crash thay vì blank screen
- Production build tự động xóa `console.log/debug/info/warn` qua esbuild

### Changed
- `entrypoint.sh` — startup logs có timestamp ISO-8601 và log level
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
