# Notica — Feature Roadmap

Danh sách tính năng tiềm năng để phát triển thêm, hướng tới open-source cho cộng đồng.
Đây là tài liệu thảo luận — chưa phải kế hoạch triển khai.

**Trạng thái hiện tại (Phase 1–6 ✅, v0.2.0 ✅, C1 ✅):**
Job Registry · Alert Ingestion API · Dashboard (Job Board + Alert History + Log Viewer) · Immediate Notification (Teams) · Digest Mode · Settings (retention/timezone/app_url/org_name/logo/favicon) · SSO Keycloak · Branding (logo/favicon) · Digest cursor model · Timezone-aware overdue detection · Analytics Dashboard · Delete Job · Dark mode redesign (Deep Zinc palette)

---

## Nhóm A — Core Gaps (Lỗ hổng cốt lõi)

> Những thứ một backup monitoring system đúng nghĩa bắt buộc phải có.

### A1 · Overdue Detection ⭐

Job có `expected_cron` + `grace_period` nhưng nếu script **im lặng hoàn toàn** (server reboot, script crash trước khi gửi report, network đứt) → Notica không biết và không báo gì. Cần APScheduler check định kỳ, tự tạo alert `missed` nếu job không report đúng hạn.

**Use-case:**
> Server backup lúc 02:00 bị reboot đột ngột do kernel panic. Script backup chưa kịp chạy, không có gì gửi về Notica. Sáng ra team không biết đêm qua backup chưa chạy — cho đến khi cần restore thì mới phát hiện không có backup. Với Overdue Detection, Notica tự phát hiện lúc 02:30 (02:00 + 30 phút grace) và ping Teams ngay.

**Cần thêm:**
- Scheduler chạy mỗi phút, scan toàn bộ active jobs có `expected_cron`
- Tính `next_expected = last_alert_time + cron_interval + grace_period`
- Nếu `now > next_expected` → tạo alert `missed` + fire notification
- UI: Job Board hiển thị badge "OVERDUE" trên job card

---

### A2 · Alert Acknowledgment

Alert fire → ai đó xử lý → nhưng hệ thống không có closure. Không biết ai đã xem, ai đang xử lý, kết quả ra sao.

**Use-case:**
> 03:00 sáng backup fail, Teams ping cả team. Bạn An lúc đó đang trực, vào fix xong. Nhưng bạn Bình sáng dậy thấy alert vẫn đỏ, không biết đã có người xử lý chưa → lại vào check lại → mất thêm 20 phút. Với Acknowledgment, An ấn "Acknowledge" → Bình thấy "Acknowledged by An at 03:15" → không cần check lại.

**Cần thêm:**
- Field `acknowledged_at`, `acknowledged_by` trên bảng `alerts`
- Nút "Acknowledge" trên Alert History UI + trong Teams card
- Filter "unacknowledged" để tìm alert chưa ai nhận
- Alert đã ack sẽ không trigger escalation (xem B5)

---

### A3 · Maintenance Windows

Cho phép tạo khung giờ im lặng. Trong window → alert vẫn ghi nhận vào DB nhưng không gửi notification.

**Use-case:**
> Mỗi tháng có maintenance window từ 23:00–02:00 để upgrade database. Trong thời gian này, toàn bộ backup jobs sẽ báo failure hoặc skipped (vì DB đang offline). Nếu không có maintenance window, Teams bị spam hàng chục alert vô nghĩa và team bị "trained" để ignore alert giờ đó → miss alert thật.

**Cần thêm:**
- Model `MaintenanceWindow`: `start_at`, `end_at`, `reason`, scope (global / per-job / per-tag)
- Khi fire notification: check active window → skip nếu có
- UI: trang Maintenance quản lý windows, hiển thị banner khi đang active
- Alert vẫn được lưu DB với flag `suppressed=true` để audit sau

---

### A4 · Duplicate Suppression

Job fail liên tục → spam notification, gây alert fatigue, team bắt đầu ignore Teams channel.

**Use-case:**
> Một cron job backup chạy mỗi 5 phút (retry logic), fail liên tục 2 tiếng do disk đầy. Teams nhận 24 notification. Ai cũng mute channel. Khi có alert thật khác cùng lúc → bị bỏ sót. Với suppression: "Job X fail lần đầu lúc 03:00, đã fail 24 lần liên tiếp, lần gần nhất 05:00" — 1 notification duy nhất, cập nhật count theo thời gian.

**Cần thêm:**
- Config per-job: `suppress_threshold` (số lần fail liên tiếp trước khi gom)
- Notification update count thay vì tạo mới
- Reset khi job success

---

## Nhóm B — Notification Power-up

> Mở rộng kênh thông báo — không phải ai cũng dùng Teams, quan trọng cho open-source adoption.

### B1 · Email (SMTP)

**Use-case:**
> Team sysadmin ở một công ty nhỏ không dùng Teams, chỉ dùng email. Hiện tại họ không thể dùng Notica vì chỉ có Teams webhook. Với SMTP support, họ nhận digest backup hàng ngày vào 07:00 sáng qua email, immediate alert khi failure qua email riêng với subject `[CRITICAL] Job backup-mysql-prod FAILED`.

**Config cần thêm vào Settings:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`

---

### B2 · Slack

**Use-case:**
> Startup dùng Slack làm primary communication. Muốn nhận alert backup vào channel `#infrastructure-alerts` với Slack Block Kit card đẹp, có nút "View Logs" và "Acknowledge" ngay trong Slack mà không cần mở browser.

---

### B3 · Generic Webhook

Contact type với custom payload template. Cho phép tích hợp với bất kỳ hệ thống nào.

**Use-case 1 — PagerDuty:**
> Team lớn đã có PagerDuty làm on-call management. Notica detect backup failure → trigger PagerDuty incident tự động → PagerDuty lo việc route đến đúng người trực theo schedule.

**Use-case 2 — Zalo OA:**
> Công ty Việt Nam muốn nhận alert qua Zalo Official Account. Cấu hình generic webhook trỏ đến Zalo OA API, define template payload phù hợp với Zalo API format.

**Template variables:** `{{ job_name }}`, `{{ status }}`, `{{ completion_time }}`, `{{ description }}`, `{{ alert_url }}`

---

### B4 · Telegram

**Use-case:**
> DevOps solo engineer tự host mọi thứ trên VPS, không dùng Teams hay Slack. Cài Notica, tạo Telegram bot, nhận alert backup thẳng vào điện thoại qua Telegram — zero corporate dependency, hoạt động tốt dù không có VPN.

---

### B5 · Escalation Policy

Nếu alert không được acknowledge sau X phút → tự động leo thang lên contact level cao hơn.

**Use-case:**
> 02:00 sáng backup prod DB fail. Notica ping channel #backup-alerts (level 1). 30 phút không ai ack (người trực đang ngủ, chưa thấy). Notica tự động escalate: ping trực tiếp @oncall-engineer qua DM (level 2). Thêm 30 phút nữa → ping @team-lead (level 3). Đảm bảo alert production không bao giờ bị miss.

---

### B6 · Alert Routing Rules

Route alert đến contact khác nhau dựa trên job tags, thay vì config cứng per-job.

**Use-case:**
> Công ty có 50 backup jobs với tags khác nhau. Thay vì vào từng job config contact, define rules một lần:
> - `env=prod AND service=db` → Teams #db-critical (24/7 monitoring)
> - `env=prod AND service=app` → Teams #app-alerts
> - `env=dev` → Teams #dev-noise (chỉ check giờ hành chính)
> - `service=dr` → email to DR team
>
> Thêm job mới chỉ cần đúng tags, tự động được route đúng channel.

---

## Nhóm C — Analytics & Visibility

> Biến Notica từ alert tool thành monitoring platform có chiều sâu.

### C1 · Job Health Dashboard ✅ *Implemented*

Charts và statistics — system-wide overview và per-job analytics.

**Đã implement:**
- `/analytics` trang với Progressive Disclosure design: KPI strip → Env Health cards → Problem Jobs table → Healthy Jobs collapse → Alert Volume + Duration charts
- Period selector 7d / 30d / 90d thay đổi toàn bộ data
- Per-job `JobStatsPanel` nhúng vào Job Detail page
- Backend: `GET /analytics/overview?period=N` + `GET /analytics/jobs/{id}?period=N`

---

### C2 · SLA Tracking

Định nghĩa deadline: job phải complete trước X giờ. Alert riêng nếu SLA breach dù job success.

**Use-case:**
> Backup DB phải xong trước 06:00 để DBA có thể check kết quả trước khi office giờ hành chính. Một ngày job chạy 2 tiếng (vì data tăng nhiều), xong lúc 06:45 — dù status=success nhưng SLA breach. Notica cảnh báo: "Job backup-mysql-prod hoàn thành lúc 06:45, trễ SLA 45 phút". Team biết cần optimize backup hoặc điều chỉnh schedule.

---

### C3 · Backup Metrics Tracking

Job report thêm metrics tùy ý. Notica track trend và phát hiện anomaly.

**Use-case 1 — Phát hiện backup rỗng:**
> Script backup PostgreSQL chạy thành công (exit 0) nhưng file dump bị corrupt, size = 0 bytes. Script không detect được lỗi này. Với metrics tracking, job report `size_mb=0` → Notica so sánh với trung bình 7 ngày (thường ~1200MB) → alert "Backup size bất thường: 0MB (trung bình 1,200MB)".

**Use-case 2 — Capacity planning:**
> Track `size_mb` theo thời gian, phát hiện database đang grow 50MB/ngày → dự báo "disk sẽ đầy trong 20 ngày" → alert proactive trước khi xảy ra sự cố.

---

### C4 · Alert Correlation

Phát hiện khi nhiều job fail đồng loạt trong cùng thời điểm → gom thành 1 incident.

**Use-case:**
> 03:00 sáng network switch bị down 5 phút. Tất cả 15 backup jobs chạy lúc đó đều fail do không kết nối được storage server. Không có correlation: Teams nhận 15 alert riêng lẻ, team điều tra từng cái. Với correlation: "Phát hiện 15 jobs fail trong vòng 3 phút (03:00–03:03) — có thể do sự cố hạ tầng dùng chung. Root cause: network?" → 1 notification, rõ ràng, tiết kiệm thời gian.

---

### C5 · Flexible Digest & Export

Digest schedule thêm weekly/monthly, export CSV/PDF.

**Use-case:**
> Manager yêu cầu báo cáo backup hàng tuần vào sáng thứ Hai để review trước họp. Export PDF gửi qua email với đầy đủ: tổng số job, success rate, job nào fail, thời gian. Hiện tại phải chụp màn hình dashboard thủ công.

---

## Nhóm E — Smart Monitoring

> Nâng Notica từ "nhận alert" lên "chủ động hiểu hệ thống".

### E1 · Heartbeat Monitoring

Monitor bất kỳ process nào cần ping định kỳ — không chỉ backup scripts. Gửi HTTP GET đơn giản; nếu Notica không nhận ping trong cửa sổ thời gian → alert.

**Use-case 1 — Website uptime:**
> Monitor trang nội bộ `http://erp.internal` bằng cách cấu hình heartbeat job expect ping mỗi 5 phút từ một script curl đơn giản. Nếu website down → ping stops → Notica alert.

**Use-case 2 — Service health:**
> Daemon Python chạy background cứ mỗi phút ping Notica để báo "tôi vẫn alive". Nếu process crash mà không có recovery → Notica phát hiện sau 2 phút.

Biến Notica thành đối thủ của **healthchecks.io** nhưng self-hosted, không phụ thuộc dịch vụ bên ngoài.

---

### E2 · Job Dependency Chain

Job B phụ thuộc Job A. Nếu A fail → B skip/fail theo — không alert riêng cho B vì đó là cascading failure từ A.

**Use-case:**
> Pipeline backup: `db-dump` → `compress-dump` → `upload-to-s3` → `verify-checksum`. Nếu `db-dump` fail, 3 job kế tiếp đều fail theo (vì không có input). Không có dependency: 4 alert riêng lẻ. Với dependency: 1 alert "db-dump failed, 3 downstream jobs skipped (compress, upload, verify)". Team focus vào root cause ngay.

---

### E3 · Anomaly Detection (Statistical)

Học pattern bình thường của từng job, alert khi deviation bất thường.

**Use-case 1 — Backup chậm dần:**
> Job backup-mysql-prod trung bình chạy 20 phút trong 3 tháng qua. Tuần này đột ngột 45 phút (vì data growth hoặc disk chậm). Status=success nhưng Notica alert: "Duration tăng 125% so với trung bình — cần kiểm tra".

**Use-case 2 — Backup chạy quá nhanh:**
> Job thường mất 30 phút nhưng hôm nay xong trong 2 phút, status=success. Thực ra script exit sớm vì lỗi connection không được catch đúng cách. Anomaly detection phát hiện "duration bất thường ngắn" → alert để review.

---

### E4 · Backup Verification (Restore Test)

Backup chạy xong ≠ backup dùng được. Hỗ trợ workflow 2 bước: backup → verify.

**Use-case:**
> Mỗi đêm backup PostgreSQL xong (status=success). Hệ thống tự động restore vào môi trường test, chạy `pg_restore --schema-only` để verify. Nếu restore fail → alert "Backup completed nhưng KHÔNG verify được — file có thể corrupt". Phát hiện trước khi cần restore thật.

---

### E5 · Multi-Instance Job (Cluster Awareness)

Cùng 1 job chạy trên nhiều server (HA setup). Chỉ alert khi tất cả instance fail, hoặc theo threshold.

**Use-case:**
> 3 replica MySQL server, mỗi cái chạy backup riêng lúc 02:00. Nếu 1 trong 3 fail → không cần alert (vẫn có 2 backup tốt). Nếu 2/3 fail → alert warning. Nếu 3/3 fail → alert critical. Hiện tại phải tạo 3 job riêng và tự track — với cluster awareness chỉ cần 1 "virtual job" với 3 instances.

---

## Nhóm F — Team Collaboration

> Tính năng làm việc nhóm — cần thiết khi nhiều người cùng quản lý hệ thống.

### F1 · On-Call Schedule

Định nghĩa lịch trực theo tuần/ngày. Alert tự route đến người đang trực.

**Use-case:**
> Team 4 người, mỗi người trực 1 tuần theo rotation. Thay vì ping cả team mọi lúc (gây fatigue) hoặc config tay từng tuần — define schedule một lần, Notica tự biết tuần này ai trực và ping đúng người. Người không trực không bị làm phiền ngoài giờ.

---

### F2 · Alert Comments & Notes

Team member thêm note vào alert sau khi xử lý.

**Use-case:**
> Alert backup-mysql fail lúc 03:00. Bạn An điều tra và phát hiện do disk đầy, đã dọn log cũ, job retry thành công lúc 03:30. An để note: "Disk /var/log đầy do access log không rotate. Đã dọn 20GB, thêm cron logrotate. Ticket #1234 để prevent tái diễn." Tuần sau có alert tương tự, team ngay lập tức biết đây là recurring issue và có context để xử lý nhanh hơn.

---

### F3 · Runbook Links per Job

Mỗi job có field `runbook_url`. Teams card có nút "Open Runbook".

**Use-case:**
> 03:00 sáng, người trực mới (junior) nhận alert "backup-oracle-prod failed". Không biết phải làm gì. Nếu có runbook link → click "Open Runbook" → đến trang Confluence/Notion với hướng dẫn từng bước: check disk, check Oracle listener, restart backup service. Xử lý được mà không cần wake up senior.

---

### F4 · Incident Management

Nhiều alert liên quan → gom thành 1 Incident với owner và timeline.

**Use-case:**
> 03:00 sáng: storage server unreachable → 12 backup jobs fail đồng loạt. Không có incident management: 12 alert riêng lẻ, 3 người cùng điều tra chồng chéo nhau. Với incident: Notica tạo 1 Incident "Storage Unreachable", assign cho người trực, track timeline (03:00 detected → 03:15 root cause found → 03:45 resolved), auto-close khi tất cả alert liên quan resolve. Post-mortem dễ hơn nhiều.

---

## Nhóm G — Automation & Integration

> Làm Notica trở thành mắt xích trong automation pipeline.

### G1 · Action Webhooks (Trigger on Alert)

Khi alert nhận được → trigger external webhook để chạy automation (khác với notification contact — đây là automation, không phải human ping).

**Use-case 1 — Auto retry:**
> Backup fail do transient error (network blip). Thay vì đợi người trực xử lý, Notica trigger Jenkins job "retry-backup-mysql-prod" ngay lập tức. 80% case tự recover mà không cần human intervention.

**Use-case 2 — Auto cleanup:**
> Backup fail do disk đầy → trigger Ansible playbook dọn log cũ → disk free → backup tự retry. Fully automated recovery cho common failure pattern.

---

### G2 · Custom Alert Rules

Định nghĩa rule để override hoặc augment status từ script.

**Use-case 1 — Backup rỗng mà script báo success:**
> Oracle export tool đôi khi exit 0 dù export file rỗng (known bug). Rule: `IF size_mb < 10 THEN override_status = failure, reason = "Backup file suspiciously small"`. Catch lỗi mà script không catch được.

**Use-case 2 — Alert giờ bất thường:**
> Job chỉ nên chạy lúc 02:00–03:00. Nếu nhận alert lúc 14:00 (ai đó chạy manual) → flag là "unexpected_time" để team biết đây là manual run, không phải scheduled.

---

### G3 · GitOps / Config as Code

Quản lý config Notica bằng YAML file trong Git repo.

**Use-case:**
> Team có 50 backup jobs, muốn quản lý config trong Git cùng với Terraform và Ansible. Khi thêm server mới, thêm job vào `notica-config.yaml`, commit, CI/CD pipeline chạy `notica apply` → job tự động được tạo trên Notica. Không cần vào UI click thủ công. Audit trail qua Git history.

---

### G4 · Terraform Provider

Resource `notica_job`, `notica_contact`, `notica_schedule` cho Terraform.

**Use-case:**
> IaC team provision server mới bằng Terraform. Trong cùng Terraform code, tạo luôn Notica job để monitor backup server đó. Destroy server → Terraform destroy Notica job theo. Infrastructure và monitoring luôn sync.

---

### G5 · Per-Job Retention Policy

Override global retention policy per-job.

**Use-case:**
> Quy định compliance yêu cầu giữ log backup production DB tối thiểu 1 năm. Dev environment không cần quá 7 ngày. Với per-job retention: `backup-mysql-prod` → 365 ngày, `backup-dev-*` → 7 ngày, `backup-staging-*` → 30 ngày. Tiết kiệm storage, đáp ứng compliance cùng lúc.

---

## Nhóm H — Operations Quality of Life

> Những tính năng nhỏ nhưng tiết kiệm rất nhiều thời gian vận hành thực tế.

### H1 · Job Templates

Tạo job từ template, clone N lần chỉ khác tên.

**Use-case:**
> Công ty có 30 MySQL databases trên 10 server, mỗi DB một backup job với config gần giống nhau (cùng cron, grace period, contacts). Không có template: tạo thủ công 30 job. Với template: tạo template "MySQL Backup Standard", clone 30 lần, chỉ điền tên và token. 5 phút thay vì 1 tiếng.

---

### H2 · Bulk Operations

Select nhiều jobs → bulk edit.

**Use-case:**
> Cần migrate tất cả `env=dev` jobs từ contact "Teams Dev Channel" sang contact "Teams Dev Channel v2" (đổi webhook URL). Không có bulk: vào từng job edit thủ công. Với bulk: filter by tag `env=dev`, select all, bulk update contact → xong trong 30 giây.

---

### H3 · Job Health Score

Mỗi job có score 0–100 dựa trên: success rate, on-time rate, SLA compliance.

**Use-case:**
> Manager mở Notica, nhìn Job Board thấy ngay: backup-mysql-prod = 98/100 (healthy), backup-oracle-staging = 45/100 (needs attention), backup-mssql-dr = 12/100 (critical). Không cần đọc từng alert để biết job nào đang có vấn đề. Dùng như "health check" nhanh mỗi sáng.

---

### H4 · Capacity Planning View

Trend backup size → dự báo disk đầy.

**Use-case:**
> Server backup có 2TB disk. Backup hiện chiếm 1.2TB, grow 50GB/week. Không có capacity planning: team phát hiện disk đầy khi backup fail lúc 03:00. Với capacity view: "Disk sẽ đầy trong ~16 ngày" → alert proactive → team có 2 tuần để mua thêm disk hoặc cleanup.

---

### H5 · Smart Digest Grouping

Digest gom alert theo tag, sort theo severity, highlight cần attention.

**Use-case:**
> Hiện tại digest list 40 alerts theo thứ tự thời gian — phải đọc từng dòng để tìm failure. Với smart grouping: đầu digest là "⚠️ 3 jobs cần attention" (failure/missed), tiếp theo group theo service (DB backups, App backups, DR backups). Manager đọc 30 giây thay vì 5 phút.

---

## Nhóm I — Developer Experience & Community

> Giảm friction để người dùng mới adopt nhanh, community contribute dễ hơn.

### I1 · SDK Libraries

**Use-case — Python:**
> Developer tích hợp Notica vào backup script Python, thay vì tự viết `requests.post(...)` với đầy đủ headers và error handling:
> ```python
> from notica import Client
> notica = Client(url="http://notica.internal", token="xxx")
> notica.report(status="success", duration_sec=342, size_mb=1240)
> ```
> SDK tự handle retry, timeout, error suppression — đúng best practice không cần copy-paste từ docs.

---

### I2 · One-Click Deploy Buttons

**Use-case:**
> Open-source user đọc README trên GitHub, muốn thử Notica ngay. Click "Deploy to Railway" → điền 3 env vars (DB password, APP_URL, FRONTEND_PORT) → Notica live trong 3 phút. Không cần Docker knowledge, không cần đọc docs setup. Adoption barrier gần như bằng 0.

---

### I3 · Demo Mode

Khởi động với sample data để evaluate mà không cần setup thực tế.

**Use-case:**
> Sysadmin muốn demo Notica cho manager để xin budget. `DEMO_MODE=true` → Notica khởi động với 10 fake jobs, 100 fake alerts (có success/failure/missed), 2 fake contacts, digest schedule đã config sẵn. Manager thấy full UI với data thực tế, ra quyết định trong 10 phút.

---

### I4 · Webhook Tester Built-in

UI cho phép gửi test payload tùy chỉnh đến job mà không cần curl.

**Use-case:**
> Developer mới tích hợp script backup với Notica, muốn test xem Teams card có hiển thị đúng không. Thay vì viết curl command và tìm token: vào Job Detail → "Send Test Alert" → chọn status failure, điền log mẫu, click Send → xem Teams card ngay lập tức. Debug nhanh hơn 10 lần.

---

### I5 · Alert Simulation

Simulate failure, missed, escalation để test toàn bộ notification pipeline.

**Use-case:**
> Team vừa thêm contact mới và escalation policy. Muốn test xem pipeline hoạt động đúng không mà không cần đợi backup fail thật. "Simulate failure for job backup-mysql-prod" → toàn bộ pipeline chạy: Teams nhận card, nếu 5 phút không ai ack → escalation ping đúng người. Test môi trường production safely.

---

## Nhóm J — Compliance & Governance

> Cho môi trường doanh nghiệp cần audit trail và báo cáo tuân thủ.

### J1 · Compliance Reports

Sinh báo cáo backup coverage định kỳ cho auditor.

**Use-case:**
> ISO 27001 audit yêu cầu bằng chứng rằng "100% production databases được backup hàng ngày trong 3 tháng qua". Hiện tại: export CSV thủ công, tự tính trong Excel. Với compliance report: generate PDF "Backup Coverage Report — Q2 2026", có breakdown per-system, success rate, SLA compliance, incidents. Auditor satisfied, team tiết kiệm 1 ngày làm việc.

---

### J2 · Backup Coverage Map

Visual map: danh sách tất cả systems cần backup vs. đã có job monitoring.

**Use-case:**
> IT Manager lo ngại có server nào đó chưa được monitor backup. Với coverage map: danh sách tất cả hosts (tự nhập hoặc import từ CMDB) so sánh với jobs đã đăng ký trên Notica. Highlight gap: "Server db-04.internal chưa có Notica job nào". Phát hiện blind spot trước khi audit.

---

### J3 · Alert Data Export (GDPR / Audit)

Export alert data theo date range ra CSV/JSON.

**Use-case:**
> Công ty bị audit bảo mật, auditor yêu cầu toàn bộ backup history của `customer-db` trong 6 tháng qua. Export CSV ngay trong UI, có đầy đủ: timestamp, status, duration, description, ai acknowledge. Submit cho auditor trong 2 phút.

---

### J4 · Immutable Alert Log

Option để alert records không thể bị xóa hoặc modify (chỉ archive).

**Use-case:**
> Regulatory yêu cầu giữ backup evidence tối thiểu 2 năm và không ai được modify. Với immutable log: alert records được write-once, archive tự động sau retention period sang cold storage (S3 Glacier). Retention policy chỉ xóa `working copy`, không xóa archive. Đáp ứng PCI-DSS, HIPAA, SOC2.

---

## Nhóm K — AI-Powered Features

> Tích hợp AI/LLM để tự động hóa phân tích, giảm thời gian điều tra, và chủ động phòng ngừa sự cố.
>
> **Thiết kế nguyên tắc:** Hỗ trợ cả Cloud LLM (OpenAI, Anthropic, Gemini) lẫn Local LLM (Ollama) để self-hosted users không bị buộc gửi log data ra ngoài. Config qua Settings: `AI_PROVIDER=ollama|openai|anthropic`, `AI_MODEL=llama3|gpt-4o|claude-3-haiku`.

---

### K1 · AI Log Analyzer ⭐

Khi backup fail, LLM tự phân tích log content, tóm tắt lỗi bằng ngôn ngữ tự nhiên, chỉ ra root cause và suggest bước fix tiếp theo. Thay vì người trực phải đọc hàng trăm dòng log lúc 03:00 sáng.

**Use-case:**
> Backup Oracle fail với 500 dòng log. Log analyzer gửi log lên LLM, trả về:
> ```
> Root cause: ORA-27102 (out of memory) — Oracle không đủ RAM để allocate SGA.
> Likely reason: Một process khác đang chiếm memory bất thường trên server.
>
> Suggested fix:
> 1. Kiểm tra `top` xem process nào đang dùng nhiều RAM
> 2. Hoặc giảm tạm thời SGA_TARGET trong Oracle parameter
> 3. Nếu tái diễn: xem xét tăng RAM server hoặc reschedule backup
> ```
> Junior engineer xử lý được ngay mà không cần escalate senior lúc 03:00.

**Hiển thị:** Panel "AI Analysis" trong Log Drawer, chỉ load khi user click "Analyze with AI" (không tự động để tiết kiệm chi phí API).

---

### K2 · Smart Digest Summary

LLM tóm tắt digest hàng ngày thành 3–5 dòng executive summary thay vì list dài alert. Phù hợp để gửi cho manager hoặc đầu Teams card digest.

**Use-case:**
> Digest 40 alerts hàng ngày. LLM summary:
> ```
> 📊 Tóm tắt 28/06/2026:
> • 37/40 jobs thành công (92.5%)
> • 2 jobs fail liên quan disk space trên db-server-03 (recurring issue, đã xảy ra 3 lần tuần này)
> • 1 job missed do server reboot lúc 02:15
> • ⚠️ Cần chú ý: backup-oracle-prod có duration tăng 40% so với tuần trước
> ```
> Manager đọc 10 giây biết ngay tình hình, không cần scroll qua 40 dòng.

---

### K3 · Incident Similarity Search

Khi alert mới xảy ra, AI tìm trong lịch sử các incident tương tự (dựa trên log pattern, job name, error type) và hiển thị: "Incident này tương tự 3 lần trước — xem cách đã xử lý."

**Use-case:**
> Alert "backup-mysql-prod failed" lúc 03:00. AI tìm thấy:
> ```
> Incident tương tự (2 tuần trước, similarity 87%):
> → Root cause: /var/log full
> → Resolution: xóa access log cũ, thêm logrotate
> → Resolved by: An Nguyen trong 25 phút
> → Note: "Nên đặt alert khi disk > 80%"
> ```
> Người trực không cần điều tra lại từ đầu, follow resolution cũ trước.

**Technical:** Vector embedding của log content + alert metadata, lưu trong pgvector (PostgreSQL extension). Không cần external vector DB.

---

### K4 · Predictive Failure

Dựa trên historical data (duration trend, success rate, disk usage metrics), AI dự báo job nào có khả năng fail trong 24–48 giờ tới.

**Use-case:**
> Dashboard hiển thị:
> ```
> ⚠️ Dự báo rủi ro cao (24h tới):
> • backup-mysql-prod: 73% khả năng fail
>   Reason: Duration tăng 15% mỗi ngày trong 1 tuần, nếu trend này tiếp tục
>   sẽ exceed timeout (2h) vào ngày mai
>
> • backup-oracle-staging: 45% khả năng fail
>   Reason: Disk /backup đang fill rate cao, ước tính đầy trong ~20 giờ
> ```
> Team hành động proactive thay vì reactive lúc 03:00 sáng.

**Technical:** Time series forecasting (Prophet hoặc simple linear regression) — không cần LLM, chỉ cần ML nhẹ trên data có sẵn trong DB.

---

### K5 · Natural Language Query

Hỏi dashboard bằng tiếng Anh hoặc tiếng Việt thay vì phải click filter thủ công.

**Use-case:**
> User gõ vào search bar:
> - *"Show me all failed jobs on production servers last week"*
> - *"Job nào chưa chạy trong 3 ngày qua?"*
> - *"Backup nào có duration tăng nhiều nhất tháng này?"*
>
> LLM dịch câu query thành API filter parameters → trả về kết quả đúng. Không cần nhớ filter UI, không cần biết tên chính xác của job.

---

### K6 · Auto Root Cause Analysis (RCA) cho Incident

Khi nhiều job fail đồng loạt (E5/C4 phát hiện), AI tự phân tích pattern để suggest root cause chung.

**Use-case:**
> 15 jobs fail trong 5 phút. AI phân tích:
> ```
> Probable root cause: Network storage issue
>
> Evidence:
> • Tất cả 15 jobs fail với lỗi "Connection refused to 10.220.40.50"
> • 10.220.40.50 là NFS storage server
> • Thời gian: 03:00:12 – 03:05:34 (5 phút)
> • Không có job nào trên local disk bị ảnh hưởng
>
> Suggested action:
> 1. Check NFS server 10.220.40.50 status
> 2. Check network switch port connecting storage VLAN
> ```
> RCA tự động giúp team đi thẳng vào nguyên nhân thay vì điều tra từng job.

---

### K7 · Log Diff Analysis

So sánh log của lần success gần nhất với lần failure hiện tại của cùng một job, highlight những gì khác biệt.

**Use-case:**
> `backup-postgres-prod` chạy thành công 29 ngày qua, hôm nay fail. Log Diff tự động highlight:
> ```diff
> - [INFO] Connected to PostgreSQL 15.2
> + [ERROR] Connection refused: FATAL password authentication failed
>
> - [INFO] Dumping schema public... (1,240 tables)
> + [không có dòng này]
>
> + [ERROR] pg_dump: error: query failed: ERROR: permission denied
> ```
> Ngay lập tức thấy issue: authentication failed, có thể password DB bị đổi hoặc user bị revoke quyền.

---

### K8 · AI-Generated Runbook

Từ lịch sử alert + resolution notes (F2), LLM tự generate draft runbook cho từng job.

**Use-case:**
> Job `backup-oracle-prod` đã có 8 lần fail trong 6 tháng, mỗi lần team để note resolution. AI tổng hợp:
> ```markdown
> # Runbook: backup-oracle-prod
>
> ## Các lỗi thường gặp
>
> ### ORA-27102: out of memory (3/8 lần)
> 1. Check `top` → kill process chiếm RAM bất thường
> 2. `alter system set sga_target=4G scope=memory;`
> 3. Retry backup
>
> ### Disk full (3/8 lần)
> 1. `du -sh /var/log/* | sort -rh | head`
> 2. Xóa log cũ hơn 30 ngày
> 3. Verify: `df -h /backup`
>
> ### Network timeout (2/8 lần)
> 1. Check VPN tunnel đến backup server
> 2. Ping 10.220.40.50
> ```
> Draft runbook tự động, chỉ cần review và publish — tiết kiệm 2 tiếng viết docs.

---

### K9 · Smart Alert Fatigue Detection

AI theo dõi pattern: alert nào bị ignore liên tục (không ack, không comment, không action) → cảnh báo admin "Alert này đang bị team bỏ qua, có thể đang gây fatigue."

**Use-case:**
> Job `backup-dev-database` fail hàng ngày và không ai ack trong 2 tuần. AI cảnh báo:
> ```
> ⚠️ Alert Fatigue Detected:
> Job "backup-dev-database" đã fail 14 lần liên tiếp, không có acknowledge nào.
>
> Gợi ý:
> • Nếu job này không quan trọng → deactivate để giảm noise
> • Nếu quan trọng → fix root cause (disk full trên dev server?)
> • Hoặc route sang channel riêng để không làm noise prod alerts
> ```
> Giúp admin clean up alert noise proactively thay vì để mọi người mute channel.

---

### K10 · AI Scheduling Optimizer

Phân tích duration và resource contention của các jobs, suggest schedule tối ưu để tránh jobs nặng chạy cùng lúc.

**Use-case:**
> Hiện tại 5 backup jobs lớn đều schedule lúc 02:00, gây resource contention trên storage server → tất cả đều chậm hơn bình thường. AI phân tích và suggest:
> ```
> Phát hiện resource contention lúc 02:00–04:00 (5 jobs chạy đồng thời).
>
> Đề xuất schedule tối ưu:
> • backup-mysql-prod:     02:00 (giữ nguyên, lớn nhất, cần chạy trước)
> • backup-postgres-prod:  02:45 (sau mysql xong ~70%)
> • backup-oracle-staging: 03:30 (không overlap với prod)
> • backup-mssql-dev:      04:00 (non-critical, chạy sau cùng)
>
> Ước tính: giảm tổng thời gian backup từ 4h xuống 2.5h
> ```

---

## Ma trận Effort / Impact

| | Low Effort | Medium Effort | High Effort |
|---|---|---|---|
| **High Impact** | A1, A4, F3, H4, I4, K1, K2 | A2, A3, B1, B2, B3, C1, E1, K7 | B5, B6, C2, D4, E2, F1, K4 |
| **Medium Impact** | B4, D1, D2, H1, H2, I5, K9 | C3, C4, D3, E3, F2, G2, H3, K3, K5, K6 | D6, E4, E5, F4, G1, G3, K8, K10 |
| **Lower Impact** | H5, I3 | C5, D5, D8, G5, J1, J3 | D7, G4, J2, J4 |

---

## Đề xuất thứ tự phát triển

```
Phase 7  ── A1 Overdue Detection + A4 Duplicate Suppression
             (hoàn thiện core monitoring — đây là USP của tool)

Phase 8  ── A2 Alert Acknowledgment + A3 Maintenance Windows + F3 Runbook Links
             (operational maturity)

Phase 9  ── B1 Email + B2 Slack + B3 Generic Webhook + B4 Telegram
             (mở kênh thông báo → tăng adoption)

Phase 10 ── C1 ✅ (done) + D1 Prometheus Metrics + H3 Health Score
             (visibility + Grafana integration)

Phase 11 ── E1 Heartbeat + E3 Anomaly Detection + G2 Custom Rules
             (smart monitoring)

Phase 12 ── D2 CLI + D3 Import/Export + D5 Audit Log + I1 SDK + I3 Demo Mode
             (open-source readiness)

Phase 13 ── B5 Escalation + B6 Routing + F1 On-Call + F2 Comments + F4 Incident
             (team collaboration & advanced ops)

Phase 14 ── E2 Dependencies + E4 Verify + E5 Cluster + G1 Action Webhooks + G3 GitOps
             (advanced automation)

Phase 15 ── D4 Multi-tenant + D6 Plugin + D7 K8s + D8 Status Page + G4 Terraform
             (platform scale)

Phase 16 ── J1 Compliance Reports + J2 Coverage Map + J4 Immutable Log
             (enterprise governance)

Phase AI-1 ── K1 Log Analyzer + K2 Smart Digest + K7 Log Diff
              (AI quick wins — giá trị cao, tích hợp gọn)

Phase AI-2 ── K3 Similarity Search + K4 Predictive Failure + K9 Fatigue Detection
              (AI proactive monitoring)

Phase AI-3 ── K5 NL Query + K6 Auto RCA + K8 Runbook Generator + K10 Scheduler
              (AI advanced — full intelligence layer)
```

---

*Tài liệu này là draft để thảo luận. Mỗi phase sẽ có spec riêng trước khi implement.*
