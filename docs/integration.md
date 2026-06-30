# Notica — Integration Guide

Hướng dẫn tích hợp Notica vào backup scripts. Nguyên tắc xuyên suốt: **Notica là side effect, không phải dependency** — script backup phải chạy đúng dù Notica có down hay không.

---

## Nguyên tắc tích hợp

```
Backup chạy bình thường
        ↓
Lưu exit code + log
        ↓
Gửi kết quả về Notica (fire-and-forget, có timeout)
        ↓
Script thoát với exit code của backup — không phải của Notica
```

**Không bao giờ:**
- Để lỗi Notica làm fail backup script
- Để timeout Notica block script quá lâu
- Đặt Notica call ở giữa backup logic

---

## Bước 1 — Đăng ký Job trên Notica

Vào **Job Board → Add job**, điền:

| Field | Mô tả |
|---|---|
| **Name** | Tên job, hiển thị trên dashboard và Teams card |
| **Expected cron** | Cron schedule của backup (vd: `0 3 * * *`), dùng để detect overdue |
| **Grace period** | Thời gian cho phép trễ (phút) trước khi đánh dấu overdue |
| **Environment** | Tag môi trường: `prod`, `dev`, `dr`, `other` |
| **Service** | Tag loại service: `db`, `app`, `service`, `other` |
| **Immediate alerts** | Status nào fire Teams ngay. Mặc định mới: `failure` + `missed` — xem [Overdue Detection](#overdue-detection) bên dưới |
| **Notify contacts** | Teams webhook contact nhận alert |

Sau khi tạo, copy **Job Token** ở trang Job Detail.

---

## Bước 2 — Tích hợp vào script

### Bash

Dán hàm `notica_report` vào đầu script. Hàm này **không throw, không exit** — mọi lỗi đều bị swallow.

```bash
#!/bin/bash

# ── Notica reporter (copy-paste, không sửa) ───────────────────────────────────
NOTICA_URL="https://notica.internal"
NOTICA_TOKEN="your-job-token-here"

notica_report() {
  local status="$1" desc="$2" duration="$3" log_file="$4"
  local log_json="null"

  if [ -n "$log_file" ] && [ -f "$log_file" ]; then
    log_json=$(python3 -c "import json,sys; print(json.dumps(open('$log_file').read()))" 2>/dev/null || echo "null")
  fi

  curl -sf --max-time 15 -X POST "$NOTICA_URL/api/v1/alerts" \
    -H "Content-Type: application/json" \
    -H "X-Job-Token: $NOTICA_TOKEN" \
    -d "{
      \"status\":          \"$status\",
      \"completion_time\": \"$(date -Iseconds)\",
      \"duration_sec\":    $duration,
      \"description\":     \"$desc\",
      \"log_content\":     $log_json
    }" > /dev/null 2>&1 || true   # lỗi Notica không ảnh hưởng script
}
# ─────────────────────────────────────────────────────────────────────────────

# ── Logic backup của bạn — không thay đổi gì ─────────────────────────────────
LOG_FILE="/tmp/backup_$$.log"
START=$(date +%s)

mysqldump -u root mydb 2>"$LOG_FILE" | gzip > /backup/mydb_$(date +%Y%m%d).sql.gz
BACKUP_EXIT=$?

DURATION=$(( $(date +%s) - START ))
# ─────────────────────────────────────────────────────────────────────────────

# Báo cáo về Notica — sau khi backup xong
if [ $BACKUP_EXIT -eq 0 ]; then
  notica_report "success" "MySQL backup completed" "$DURATION" "$LOG_FILE"
else
  notica_report "failure" "MySQL backup failed (exit $BACKUP_EXIT)" "$DURATION" "$LOG_FILE"
fi

rm -f "$LOG_FILE"
exit $BACKUP_EXIT   # thoát với exit code của backup, không phải Notica
```

---

### Python

Dùng helper function bọc quanh backup logic. Notica call nằm trong `try/except` riêng — exception của Notica không lan ra ngoài.

```python
import subprocess
import time
import requests
from datetime import datetime, timezone

# ── Notica reporter (copy-paste, không sửa) ───────────────────────────────────
NOTICA_URL = "http://notica.internal"
NOTICA_TOKEN = "your-job-token-here"

def notica_report(status, description="", duration_sec=0, log_content=None):
    try:
        requests.post(
            f"{NOTICA_URL}/api/v1/alerts",
            headers={"X-Job-Token": NOTICA_TOKEN},
            json={
                "status":          status,
                "completion_time": datetime.now(timezone.utc).isoformat(),
                "duration_sec":    duration_sec,
                "description":     description,
                "log_content":     log_content,
            },
            timeout=15,
        )
    except Exception:
        pass   # Notica down không làm crash script
# ─────────────────────────────────────────────────────────────────────────────

# ── Logic backup của bạn — không thay đổi gì ─────────────────────────────────
start = time.time()

result = subprocess.run(
    ["pg_dump", "-Fc", "mydb", "-f", "/backup/mydb.dump"],
    capture_output=True, text=True
)

duration = int(time.time() - start)
log = result.stdout + result.stderr
# ─────────────────────────────────────────────────────────────────────────────

# Báo cáo về Notica — sau khi backup xong
if result.returncode == 0:
    notica_report("success", "PostgreSQL full backup", duration, log or None)
else:
    notica_report("failure", f"pg_dump failed (exit {result.returncode})", duration, log or None)

raise SystemExit(result.returncode)
```

---

### Ansible

Đặt task Notica **sau cùng**, dùng `ignore_errors: true` và `failed_when: false` để không làm fail play.

```yaml
- name: Run backup
  command: /opt/scripts/backup.sh
  register: backup_result
  ignore_errors: true   # backup fail không dừng play

- name: Report to Notica
  uri:
    url: "http://notica.internal/api/v1/alerts"
    method: POST
    headers:
      Content-Type: application/json
      X-Job-Token: "{{ notica_job_token }}"
    body_format: json
    body:
      status: "{{ 'success' if backup_result.rc == 0 else 'failure' }}"
      completion_time: "{{ ansible_date_time.iso8601 }}"
      duration_sec: "{{ backup_duration_sec | int }}"
      description: "Backup on {{ inventory_hostname }}"
      log_content: "{{ backup_result.stdout }}\n{{ backup_result.stderr }}"
    timeout: 15
  failed_when: false    # Notica down không làm fail play
  ignore_errors: true

# Fail play theo kết quả backup, không theo Notica
- name: Fail if backup failed
  fail:
    msg: "Backup failed with exit code {{ backup_result.rc }}"
  when: backup_result.rc != 0
```

---

## Bước 3 — API Reference

### Endpoint

```
POST /api/v1/alerts
```

### Headers

| Header | Bắt buộc | Giá trị |
|---|---|---|
| `Content-Type` | ✅ | `application/json` |
| `X-Job-Token` | ✅ | Token lấy từ Job detail page |

### Request body

| Field | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `status` | string | ✅ | `success` / `failure` / `warning` / `skipped` (script tự gửi; `missed` do Notica tự tạo khi job im lặng) |
| `completion_time` | ISO 8601 | ✅ | Thời điểm backup kết thúc — **phải có timezone offset** |
| `duration_sec` | integer | ❌ | Thời gian chạy tính bằng giây |
| `description` | string | ❌ | Tóm tắt ngắn, hiển thị trên Teams card |
| `log_content` | string | ❌ | Full log output, xem được trong Log Drawer |

> Tags (`env`, `service`) được cấu hình trên Job qua UI — không cần truyền qua API.

### `completion_time` — Quy tắc bắt buộc

`completion_time` **phải luôn chứa timezone offset**. Nếu thiếu offset, backend sẽ hiểu là UTC — dẫn đến lệch giờ trên dashboard và Teams card.

| Giá trị | Kết quả |
|---|---|
| `2026-06-28T16:15:53+07:00` | ✅ Đúng — có offset, backend normalize về UTC |
| `2026-06-28T09:15:53Z` | ✅ Đúng — explicit UTC |
| `2026-06-28T16:15:53` | ❌ Sai — không có offset, bị hiểu là UTC, hiển thị lệch 7 giờ |

**Bash — dùng một trong hai:**

```bash
date -Iseconds                   # 2026-06-28T16:15:53+07:00  (local time + offset)
date -u +%Y-%m-%dT%H:%M:%SZ     # 2026-06-28T09:15:53Z        (UTC explicit)
```

**Python:**

```python
from datetime import datetime, timezone
datetime.now(timezone.utc).isoformat()   # 2026-06-28T09:15:53.123456+00:00  ✅
# KHÔNG dùng:
datetime.now().isoformat()               # 2026-06-28T16:15:53.123456  ← không có timezone ❌
```

**Ansible:**

```yaml
completion_time: "{{ ansible_date_time.iso8601 }}"  # 2026-06-28T09:15:53Z  ✅
# ansible_date_time.iso8601 luôn là UTC — đúng định dạng
```

### Response

| HTTP | Ý nghĩa |
|---|---|
| `201` | Alert đã nhận |
| `401` | Token sai hoặc job bị deactivate |
| `422` | `status` không hợp lệ hoặc thiếu `completion_time` |

---

## Overdue Detection

Notica tự động tạo alert `missed` khi job im lặng quá deadline — **script không cần làm gì thêm**.

```
last report (hoặc job creation)
        ↓
next expected run  =  croniter(expected_cron, last_report).get_next()
        ↓
deadline           =  next_expected + grace_period
        ↓  (nếu không có report nào trước deadline)
Notica tự tạo alert "missed" + fire Teams nếu opt-in
```

**Ví dụ:** Job cron `0 3 * * *`, grace 30 phút → nếu không có report nào trước 03:30, Notica tạo alert `missed`.

### Khi nào dùng `skipped`

Gửi `skipped` khi job **chạy nhưng cố ý bỏ qua** (maintenance window, điều kiện không đủ, v.v.). Điều này reset timer overdue — Notica hiểu job vẫn alive.

```bash
# Maintenance window hôm nay — báo Notica biết để không đánh missed
if [ "$MAINTENANCE" = "true" ]; then
  notica_report "skipped" "Maintenance window" "0"
  exit 0
fi
```

**Không gửi gì cả** → Notica sẽ đánh `missed` sau deadline. Dùng khi job thực sự bị crash hoặc không chạy được.

### Jobs cũ khi upgrade lên A1

Jobs tạo trước A1 chỉ có `failure` trong `immediate_on` — migration `20260630000000` tự động backfill `missed` khi upgrade. Nếu không muốn nhận overdue alert cho job nào, vào Job Detail bỏ toggle `missed`.

---

## Tips

**Dùng `skipped` thay vì không gửi** — khi job bị bỏ qua do maintenance window hay điều kiện không đủ, gửi `skipped` để Notica biết job vẫn alive và không đánh dấu overdue.

**Timeout hợp lý** — 10–15 giây là đủ. Đừng dùng timeout quá ngắn (< 5s) trên mạng chậm, cũng đừng để quá dài làm block cron job tiếp theo.

**Token bị lộ** — vào Job detail → **Regenerate Token**. Token cũ bị vô hiệu ngay lập tức — cập nhật vào tất cả scripts đang dùng.
