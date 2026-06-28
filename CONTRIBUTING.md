# Contributing to Notica

Cảm ơn bạn đã quan tâm đến Notica! Mọi đóng góp đều được chào đón — từ báo lỗi, đề xuất tính năng, đến pull request.

---

## Mục lục

- [Báo lỗi](#báo-lỗi)
- [Đề xuất tính năng](#đề-xuất-tính-năng)
- [Thiết lập môi trường dev](#thiết-lập-môi-trường-dev)
- [Quy trình pull request](#quy-trình-pull-request)
- [Coding conventions](#coding-conventions)
- [Cấu trúc project](#cấu-trúc-project)

---

## Báo lỗi

Trước khi tạo issue, kiểm tra xem đã có issue tương tự chưa. Khi tạo issue mới, bao gồm:

- **Mô tả ngắn**: vấn đề là gì
- **Steps to reproduce**: các bước tái hiện lỗi
- **Expected behavior**: kết quả mong đợi
- **Actual behavior**: kết quả thực tế
- **Environment**: phiên bản Docker, OS, browser (nếu là UI bug)
- **Logs**: output từ `docker compose logs backend` nếu liên quan backend

---

## Đề xuất tính năng

Mở issue với label `enhancement`, mô tả:

- Tính năng cần thêm là gì
- Use case cụ thể (tình huống nào cần dùng)
- Giải pháp đề xuất (nếu có)

---

## Thiết lập môi trường dev

### Yêu cầu

- Python 3.12
- Node.js 20+
- Docker Engine 24+
- Make

### Cài đặt

```bash
git clone https://github.com/yourname/notica.git
cd notica
make install          # tạo venv backend + npm install frontend
make db-up            # khởi động PostgreSQL
make migrate          # chạy Alembic migrations
```

### Cấu hình

```bash
cp backend/.env.example backend/.env.local
# Chỉnh sửa backend/.env.local nếu cần thay đổi DATABASE_URL hoặc bật SSO
```

### Chạy dev servers

```bash
make dev-backend      # FastAPI với hot reload tại http://localhost:8000
make dev-frontend     # Vite dev server tại http://localhost:5173
```

### Các lệnh hữu ích

```bash
make migrate-status   # xem trạng thái migration hiện tại
make db-shell         # mở psql vào dev database
make typecheck        # TypeScript type check
make logs-backend     # xem logs backend (production)
```

---

## Quy trình pull request

1. **Fork** repository và tạo branch từ `main`
2. **Implement** thay đổi theo [coding conventions](#coding-conventions)
3. **Test** thủ công: chạy dev servers và verify tính năng hoạt động
4. **Commit** với message rõ ràng (xem định dạng bên dưới)
5. **Push** và mở Pull Request vào `main`

### Commit message format

```
<type>: <short description>

[optional body]
```

Types: `feat`, `fix`, `docs`, `refactor`, `chore`

Ví dụ:
```
feat: add email notification adapter
fix: prevent digest from sending duplicate alerts on restart
docs: update integration guide with Python example
```

### PR checklist

- [ ] Code chạy được (`make dev-backend` + `make dev-frontend` không lỗi)
- [ ] TypeScript type check sạch (`make typecheck`)
- [ ] Không có `console.log` debug thừa
- [ ] `docs/integration.md` cập nhật nếu thay đổi API
- [ ] `CHANGELOG.md` cập nhật phần `[Unreleased]`

---

## Coding conventions

### Backend (Python / FastAPI)

- **Async everywhere**: route handlers và service functions đều dùng `async def`
- **Session management**: dùng `get_db()` dependency injection
- **Logging**: dùng `logging.getLogger(__name__)` — không dùng `print()`
- **Migrations**: chỉ dùng Alembic, không dùng `Base.metadata.create_all()`
- **API prefix**: tất cả routes có prefix `/api/v1/`
- **Error responses**: FastAPI `HTTPException` với HTTP status code phù hợp

```python
import logging
logger = logging.getLogger(__name__)

async def my_service():
    logger.info("Processing job=%s", job_id)
```

### Frontend (React / TypeScript)

- **Feature-sliced**: mỗi domain trong `src/features/`, co-locate hooks + components + queries
- **URL state**: filter state lưu trên URL params qua `nuqs`
- **No console.log**: dùng `console.error` chỉ cho critical errors
- **TypeScript strict**: không dùng `any` nếu có thể tránh được
- **Polling**: dùng `refetchInterval` của TanStack Query, không dùng `setInterval`

### Notifications (Teams)

- Dùng **Adaptive Cards v1.2** — không dùng MessageCard (deprecated)
- **Webhook URL**: Teams Workflows webhook (không phải Office 365 Connector)
- Payload > 28KB: split thành nhiều messages
- Rate limit: delay 250ms giữa các contact calls

---

## Cấu trúc project

```
notica/
  backend/              # FastAPI application
    app/
      api/v1/routes/    # thin route handlers
      core/             # config, logging, middleware, dependencies
      db/               # SQLAlchemy models + Alembic migrations
      schemas/          # Pydantic v2 schemas
      services/         # business logic
      repositories/     # database queries
      notifications/    # Teams adapter
      scheduler/        # APScheduler setup + job functions
  frontend/             # React + Vite SPA
    src/
      features/         # jobs | alerts | schedules | contacts | settings
      components/       # shared UI components (shadcn + custom)
      lib/              # api client, query client, keycloak init
      hooks/            # shared hooks
  docs/                 # integration guides, architecture docs
  docker-compose.yml    # production deployment
  .env.example          # environment variable template
```
