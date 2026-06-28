# Notica

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](docker-compose.yml)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)](backend/requirements.txt)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](frontend/package.json)

Hệ thống tập trung theo dõi và thông báo cho các backup jobs. Backup scripts từ bất kỳ máy chủ nào chỉ cần gửi một HTTP request — Notica lo phần còn lại: lưu lịch sử, hiển thị dashboard, gửi cảnh báo ngay lập tức khi có lỗi, và gửi báo cáo tổng hợp định kỳ qua Microsoft Teams.

---

## Tính năng

### Job Registry
Mỗi backup job được đăng ký trước trong Notica với tên, mô tả, và lịch chạy dự kiến (cron expression). Notica biết job nào đang trễ (overdue) ngay cả khi script chưa gửi kết quả — không chỉ reactive mà còn proactive.

### Alert Ingestion
Backup scripts gửi kết quả qua HTTP POST với một token định danh job. Notica nhận, lưu trữ, và xử lý ngay lập tức. Payload hỗ trợ status (success/failure/warning/skipped), thời gian chạy, duration, và log đầy đủ.

### Cảnh báo tức thì (Immediate Mode)
Khi job thất bại hoặc có cảnh báo, Notica gửi Adaptive Card lên Teams ngay trong vòng vài giây. Cấu hình trên từng job — mỗi job tự quyết định status nào trigger thông báo và gửi đến contact nào.

### Báo cáo tổng hợp (Digest Mode)
Notica gửi báo cáo tổng hợp theo lịch cron (hàng ngày/tuần) liệt kê toàn bộ kết quả backup trong khoảng thời gian đó: tổng số lần chạy, phân loại theo status, chi tiết từng job với link xem log đầy đủ.

### Dashboard
- **Job Board**: tổng quan trạng thái tất cả jobs, 7 lần chạy gần nhất, highlight jobs đang overdue
- **Alert History**: tìm kiếm theo job, status, thẻ tag, khoảng thời gian; xem log đầy đủ trong drawer
- **Schedule Manager**: quản lý lịch gửi digest với cron expression và xem trước human-readable
- **Contact Manager**: quản lý danh sách Teams webhook, test kết nối
- **Settings**: cấu hình thời gian lưu trữ alert và URL ứng dụng

### SSO (tùy chọn)
Kết nối vào Keycloak OIDC external — management UI yêu cầu đăng nhập, ingestion API (`POST /api/v1/alerts`) vẫn dùng X-Job-Token như cũ. Mặc định tắt (`SSO_ENABLED=false`) — không cần Keycloak để chạy Notica.

---

## Yêu cầu

- Docker và Docker Compose v2
- Microsoft Teams với quyền tạo Workflows webhook (để nhận thông báo)
- Máy chủ có thể truy cập từ các backup scripts qua HTTP

---

## Cài đặt

Notica phân phối qua Docker Hub — server không cần source code, không cần build. Docker tự pull image về khi khởi động.

### Yêu cầu

- Docker Engine 24+
- Docker Compose v2

---

### Bước 1 — Tải 2 files về server

```bash
mkdir -p ~/notica && cd ~/notica

curl -O https://raw.githubusercontent.com/yourname/notica/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/yourname/notica/main/.env.example
```

### Bước 2 — Tạo file .env

```bash
cp .env.example .env
nano .env
```

Điền các giá trị bắt buộc:

```bash
# Đổi thành chuỗi ngẫu nhiên (bắt buộc)
POSTGRES_PASSWORD=your-secure-password-here

# IP hoặc domain truy cập Notica từ trình duyệt
# Dùng cho link "View log →" trong báo cáo Teams
APP_URL=http://192.168.1.10
```

### Tất cả biến môi trường

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `POSTGRES_PASSWORD` | Có | — | Mật khẩu PostgreSQL |
| `POSTGRES_DB` | Không | `notica` | Tên database |
| `POSTGRES_USER` | Không | `notica` | User database |
| `APP_URL` | Không | `http://localhost` | URL truy cập Notica — dùng trong link "View log →" của báo cáo Teams |
| `DISPLAY_TIMEZONE` | Không | `Asia/Ho_Chi_Minh` | Timezone hiển thị thời gian trên dashboard |
| `LOG_LEVEL` | Không | `info` | Log level backend (`debug`/`info`/`warning`/`error`) |
| `FRONTEND_PORT` | Không | `80` | Port expose frontend ra ngoài |
| `SSO_ENABLED` | Không | `false` | Bật SSO qua Keycloak (`true`/`false`) |
| `KEYCLOAK_URL` | Khi SSO bật | — | Base URL Keycloak, ví dụ `https://auth.example.com` (không có `/realms/...`) |
| `KEYCLOAK_REALM` | Khi SSO bật | `notica` | Tên realm trên Keycloak |
| `KEYCLOAK_CLIENT_ID` | Khi SSO bật | `notica-frontend` | Client ID đã tạo trên Keycloak |
| `KEYCLOAK_ISSUER` | Không | — | Override issuer URL nếu khác `KEYCLOAK_URL/realms/KEYCLOAK_REALM` |

### Bước 3 — Điền image name vào docker-compose.yml

Mở `docker-compose.yml`, sửa 2 dòng `image:` thành image thực tế đã push lên registry:

```yaml
backend:
  image: yourregistry/notica/notica-backend:latest   # ← sửa dòng này

frontend:
  image: yourregistry/notica/notica-frontend:latest  # ← và dòng này
```

### Bước 4 — Khởi động

```bash
docker compose pull   # pull images từ registry
docker compose up -d
```

Docker pull images về, tạo database, chạy migrations tự động. Sau 20-30 giây:

```bash
docker compose ps
# NAME                STATUS
# notica-db-1         Up (healthy)
# notica-backend-1    Up (healthy)
# notica-frontend-1   Up
```

### Bước 5 — Truy cập

Mở trình duyệt tại `http://<server-ip>` (hoặc port đã cấu hình trong `FRONTEND_PORT`).

---

### Cập nhật lên phiên bản mới

Sửa image tag trong `docker-compose.yml` thành version mới, rồi:

```bash
cd ~/notica
docker compose pull
docker compose up -d
```

Database giữ nguyên. Migrations chạy tự động khi backend khởi động.

---

## Thiết lập từ A đến Z

Phần này hướng dẫn toàn bộ quy trình từ khi mới cài Notica đến khi backup script đầu tiên gửi kết quả và bạn nhận được thông báo trên Teams.

### Bước 1 — Thêm contact Teams

Trước tiên cần có địa chỉ webhook để Notica có thể gửi thông báo.

**Tạo webhook trong Power Automate:**
1. Vào [powerautomate.microsoft.com](https://powerautomate.microsoft.com) → **Create** → **Automated cloud flow**
2. Đặt tên flow, chọn trigger **"When an HTTP request is received"** (connector: Request)
3. Thêm action **"Post card in a chat or channel"** (Teams):
   - Post as: `Flow bot` · Post in: `Channel`
   - Team + Channel: chọn channel muốn nhận thông báo
   - Card: click **Expression** → nhập `triggerBody()`
4. **Save** → bước trigger sẽ hiện **HTTP POST URL** — copy URL đó dán vào Notica

> ⚠️ Không dùng trigger "When a Teams webhook request is received" — trigger đó chỉ nhận message từ Teams, không dùng được cho hệ thống ngoài gọi vào.

**Thêm vào Notica:**
1. Vào trang **Contacts** trên Notica
2. Nhấn **Add contact**
3. Điền tên (ví dụ: `Teams #backup-alerts`) và dán URL webhook vào
4. Nhấn **Test** để kiểm tra — Notica sẽ gửi một Adaptive Card test, kiểm tra channel Teams của bạn
5. Nhấn **Save**

### Bước 2 — Đăng ký backup job

1. Vào trang **Job Board** → nhấn **Add job**
2. Điền thông tin:
   - **Name**: tên định danh duy nhất, dùng làm ID trong API (ví dụ: `mysql-prod-daily`)
   - **Description**: mô tả ngắn để dễ nhận ra trên dashboard
   - **Expected cron**: lịch chạy dự kiến của backup (ví dụ: `0 3 * * *` cho 3am hàng ngày). Notica dùng thông tin này để phát hiện job đang trễ.
   - **Grace period**: số phút cho phép trễ trước khi tính là overdue (mặc định 30 phút)
3. **Cấu hình thông báo tức thì** (tùy chọn):
   - Chọn status nào trigger thông báo: `failure`, `warning`, hoặc cả hai
   - Chọn contact nhận thông báo (contact vừa tạo ở Bước 1)
4. Nhấn **Save**

Sau khi lưu, job xuất hiện trên Job Board với trạng thái **No data yet**.

### Bước 3 — Lấy token

1. Nhấn vào tên job trên Job Board để vào Job Detail
2. Copy **Job Token** hiển thị trên trang này

Token này được dùng để authenticate khi backup script gửi kết quả. Giữ bí mật — nếu lộ có thể tạo lại bằng nút **Regenerate Token**.

### Bước 4 — Tích hợp backup script

Gửi kết quả backup qua HTTP POST đến `/api/v1/alerts` với token trong header.

**Ví dụ với curl (Bash):**

```bash
#!/bin/bash

NOTICA_URL="http://192.168.1.10"
JOB_TOKEN="nct_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Chạy backup và capture output
START=$(date +%s)
LOG=$(mysqldump --single-transaction -u root mydb 2>&1 | gzip > /backup/mydb-$(date +%Y%m%d).sql.gz && echo "OK" || echo "FAILED")
END=$(date +%s)
DURATION=$((END - START))

# Xác định status
if echo "$LOG" | grep -q "FAILED"; then
    STATUS="failure"
else
    STATUS="success"
fi

# Gửi kết quả cho Notica
curl -s -X POST "$NOTICA_URL/api/v1/alerts" \
  -H "X-Job-Token: $JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"$STATUS\",
    \"completion_time\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"duration_sec\": $DURATION,
    \"description\": \"MySQL production backup\",
    \"log_content\": $(echo "$LOG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
  }"
```

**Ví dụ với Python:**

```python
import httpx
import subprocess
from datetime import datetime, timezone

NOTICA_URL = "http://192.168.1.10"
JOB_TOKEN  = "nct_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

start = datetime.now(timezone.utc)
result = subprocess.run(
    ["restic", "-r", "/backup/repo", "backup", "/data"],
    capture_output=True, text=True
)
duration = int((datetime.now(timezone.utc) - start).total_seconds())

httpx.post(
    f"{NOTICA_URL}/api/v1/alerts",
    headers={"X-Job-Token": JOB_TOKEN},
    json={
        "status":          "success" if result.returncode == 0 else "failure",
        "completion_time": datetime.now(timezone.utc).isoformat(),
        "duration_sec":    duration,
        "description":     "Restic backup /data → /backup/repo",
        "log_content":     result.stdout + result.stderr,
    },
    timeout=10,
)
```

**Ví dụ với Ansible:**

```yaml
- name: Send backup result to Notica
  uri:
    url: "http://192.168.1.10/api/v1/alerts"
    method: POST
    headers:
      X-Job-Token: "nct_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    body_format: json
    body:
      status: "{{ 'success' if backup_result.rc == 0 else 'failure' }}"
      completion_time: "{{ ansible_date_time.iso8601 }}"
      duration_sec: "{{ backup_duration }}"
      description: "Ansible backup {{ inventory_hostname }}"
      log_content: "{{ backup_result.stdout }}"
```

### Bước 5 — Kiểm tra

Chạy backup script một lần, sau đó:
- Vào **Job Board** — job phải hiện kết quả ngay với màu sắc theo status
- Vào **Alert History** — xem chi tiết, click vào dòng để mở log drawer
- Nếu status là `failure` và bạn đã cấu hình immediate notification, kiểm tra channel Teams

### Bước 6 — Thiết lập báo cáo định kỳ (tùy chọn)

1. Vào trang **Schedules** → nhấn **Add schedule**
2. Điền:
   - **Name**: tên báo cáo (ví dụ: `Daily Backup Summary`)
   - **Cron expression**: lịch gửi (ví dụ: `0 8 * * *` cho 8am hàng ngày). Xem preview human-readable ngay bên dưới ô nhập.
   - **Send to contacts**: chọn contact Teams nhận báo cáo
3. Nhấn **Add schedule**
4. Để test ngay: nhấn nút **▶** (Run now) trên schedule card

Báo cáo sẽ liệt kê toàn bộ kết quả backup từ lần gửi trước đến hiện tại, sắp xếp theo mức độ nghiêm trọng (failure → warning → success).

---

## Cấu trúc payload

### POST /api/v1/alerts

| Field | Bắt buộc | Kiểu | Mô tả |
|---|---|---|---|
| `status` | Có | string | `success` \| `failure` \| `warning` \| `skipped` |
| `completion_time` | Có | ISO 8601 | Thời điểm backup kết thúc |
| `duration_sec` | Không | integer | Thời gian chạy tính bằng giây |
| `description` | Không | string | Mô tả ngắn về lần chạy này |
| `log_content` | Không | string | Nội dung log đầy đủ, giữ nguyên newlines |

Header bắt buộc: `X-Job-Token: <token>` — lấy từ trang Job Detail trên Notica.

> Tags (`env`, `service`) được cấu hình trên mỗi Job qua UI — không cần truyền qua API.

---

## Vận hành

### Xem logs

```bash
make logs              # tất cả services
make logs-backend      # chỉ backend
docker compose logs -f frontend
```

### Cập nhật lên phiên bản mới

Sửa image tag trong `docker-compose.yml` thành version mới, rồi:

```bash
docker compose pull
docker compose up -d --no-deps backend frontend
```

### Backup database

```bash
docker exec notica-db-1 pg_dump -U notica notica > notica-backup-$(date +%Y%m%d).sql
```

### Dừng và khởi động lại

```bash
make down
make up
```

Data trong PostgreSQL được lưu trên Docker named volume `pgdata` — an toàn qua các lần restart.

### Settings

Vào trang **Settings** trên dashboard để điều chỉnh:
- **Retention days**: Notica tự xóa alerts cũ hơn số ngày này lúc 2:00 AM UTC mỗi đêm (mặc định 90 ngày)
- **App URL**: URL dùng trong link "View log →" bên trong báo cáo Teams

### SSO (tùy chọn)

Notica hỗ trợ đăng nhập qua **Keycloak OIDC** — tùy chọn, mặc định tắt. Khi bật, management UI yêu cầu đăng nhập. Ingestion API (`POST /api/v1/alerts`) **luôn dùng X-Job-Token** — script backup không bị ảnh hưởng.

**Yêu cầu:** Keycloak đang chạy ở đâu đó và bạn có quyền tạo client.

**Bước 1 — Tạo client trên Keycloak của bạn**

Xem `docs/keycloak/notica-realm-sample.json` để biết settings cần thiết. Tóm tắt:

| Setting | Giá trị |
|---|---|
| Client authentication | **Off** (Public client — không cần client secret) |
| Authentication flow | Standard flow |
| Valid redirect URIs | `https://<notica-url>/*` |
| Web Origins | `https://<notica-url>` hoặc `+` (inherit từ redirect URIs) |

> **Lưu ý quan trọng:** **Web Origins** phải được cấu hình — thiếu mục này sẽ khiến CORS bị block khi browser gọi token endpoint của Keycloak (`ERR_FAILED`). Dùng `+` để tự động inherit từ redirect URIs.

**Bước 2 — Cấu hình `.env`**

```bash
SSO_ENABLED=true
KEYCLOAK_URL=https://auth.example.com   # base URL Keycloak (không có /realms/...)
KEYCLOAK_REALM=your-realm
KEYCLOAK_CLIENT_ID=notica-frontend      # client ID vừa tạo
# KEYCLOAK_ISSUER=                      # để trống = tự derive từ URL + realm
```

**Bước 3 — Khởi động**

```bash
docker compose up -d
```

Mở Notica → tự redirect đến Keycloak login → sau khi đăng nhập hiển thị username + nút **Sign out** ở cuối sidebar.

---

## Dev Setup

Dành cho người muốn phát triển hoặc chỉnh sửa Notica.

### Bước 1 — Tạo `backend/.env.local`

File này chứa config cá nhân, không commit. Copy từ template rồi điền:

```bash
cp backend/.env.example backend/.env.local
```

Nội dung tối thiểu:

```bash
DATABASE_URL=postgresql+asyncpg://notica:changeme@localhost:5432/notica
```

Muốn dev với SSO bật, bỏ comment và điền thêm:

```bash
SSO_ENABLED=true
KEYCLOAK_URL=https://your-keycloak   # Keycloak của bạn
KEYCLOAK_REALM=your-realm
KEYCLOAK_CLIENT_ID=notica-frontend
```

> Nhớ thêm vào client Keycloak trước khi test:
> - **Valid redirect URIs**: `http://localhost:5173/*`
> - **Web Origins**: `http://localhost:5173` (hoặc `+`)

### Bước 2 — Chạy

```bash
make install      # cài dependencies lần đầu

make db-up        # khởi động PostgreSQL
make migrate      # chạy migrations
```

```bash
# Terminal 1
make dev-backend  # đọc config từ backend/.env.local tự động

# Terminal 2
make dev-frontend # Vite proxy /api/* → backend:8000, không cần config thêm
```

Frontend: `http://localhost:5173`
Backend API: `http://localhost:8000`
Swagger docs: `http://localhost:8000/docs`

### Tất cả Makefile commands

```
make help              xem tất cả lệnh
make install           cài đặt toàn bộ dependencies
make db-up             khởi động PostgreSQL container
make db-down           dừng PostgreSQL container
make db-shell          mở psql vào database
make db-reset          xóa và tạo lại database (DESTRUCTIVE)
make migrate           chạy migrations
make migrate-down      rollback migration cuối
make migrate-status    xem trạng thái migration
make dev-backend       FastAPI hot reload
make dev-frontend      Vite dev server
make build             build Docker images
make up                khởi động production
make down              dừng production
make restart           restart tất cả services
make logs              xem logs tất cả services
make logs-backend      xem logs backend
make status            xem health status services
```

---

## Tài liệu

| Tài liệu | Mô tả |
|---|---|
| [docs/integration.md](docs/integration.md) | Tích hợp Notica vào backup scripts (Bash, Python, Ansible) |
| [docs/architecture.md](docs/architecture.md) | Thiết kế hệ thống, data flow, database schema |
| [docs/keycloak/](docs/keycloak/) | Keycloak sample config cho SSO |
| [CHANGELOG.md](CHANGELOG.md) | Lịch sử thay đổi theo phiên bản |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Hướng dẫn đóng góp |

---

## Contributing

Mọi đóng góp đều được chào đón — từ báo lỗi đến pull request. Xem [CONTRIBUTING.md](CONTRIBUTING.md) để bắt đầu.

## License

[MIT](LICENSE) © Notica Contributors
