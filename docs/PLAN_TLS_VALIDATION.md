# HTTPS, reverse proxy và secrets

07/10/2026 — hoàn tất phần chuẩn bị 12.6 cho Docker host hiện có; tiến độ 75/86. Chưa triển khai domain công khai, chưa chạy release/live-provider gates 12.10.

`compose.staging.yaml` dùng image đã review do operator cung cấp, edge Caddy trên 80/443, API/DB/frontend không publish trực tiếp. Giữ certificate storage qua volume. `deploy/staging.env.example` liệt kê domain, certificate contact, public app origin, image refs, namespace, worker flag và secrets bắt buộc; thêm các provider/email/budget biến từ backend env example vào file riêng. Domain/DNS, cloud secret store và registry thật vẫn cần lựa chọn của chủ ứng dụng. Mẫu không chứa credentials.

`deploy/deploy-staging.ps1 -EnvironmentFile <private-env>` mặc định chỉ validate quiet, không đổi deployment. Khi operator đã nghiệm thu backup/rollback/live checks, `-Apply` pull reviewed images, pause worker, migrate riêng, đợi web readiness rồi bật worker. Nếu lỗi, dừng rollout, giữ worker paused và dùng recovery runbook. Không in Compose config đã interpolate vì chứa secrets; không commit file env thật. Pin image digest trước phát hành. Không đưa key vào frontend.

Ứng dụng dùng cùng origin qua `/api`; không bật wildcard CORS. Nginx staging chỉ tin IP edge 172.30.5.10, backend chỉ tin IP Nginx 172.30.5.20. Nginx ghi đè X-Forwarded-For bằng client IP đã được xác thực qua proxy; peer khác không được backend tin forwarded header. `TRUST_PROXY_IPS` mặc định trống, chỉ nhận tối đa 8 IP cụ thể, không nhận wildcard/CIDR/hostname/hop counts. Network staging dùng 172.30.5.0/24; phải kiểm tra không trùng mạng trên host trước áp dụng, nếu đổi subnet phải đồng bộ các IP và nginx trusted edge. Không expose frontend staging trực tiếp làm bypass edge.

Access logs Nginx chỉ ghi method/status/duration, không ghi query, tọa độ hoặc món tìm kiếm; upstream request error logs giảm xuống critical. Backend logging đã redacted; metrics vẫn require ADMIN. Alert scrape token phải có lifecycle/rotation riêng, không dùng token lưu trong trình duyệt.

`backend/scripts/tls-drill.mjs` tạo project riêng với domain localhost và CA nội bộ Caddy, ports ngẫu nhiên loopback và credentials tổng hợp. HTTPS client kiểm tra certificate bằng CA lấy từ container, không bỏ qua TLS verification. Smoke đạt: HTTPS → Caddy → Nginx → DB readiness 200, frontend 200, ADMIN metrics 401, HSTS, không cho CORS origin lạ và không ghi query giả riêng tư vào Nginx log. Lần đầu fixture thiếu Host localhost dẫn đến request không khớp virtual host; đã sửa và chạy lại đạt, không coi status 200 trống là thành công. Cleanup chỉ project mới. Không gọi ACME/email/API thực.

Validation: 71 unit, backend typecheck/lint, Docker `plan-tls` backend/frontend đạt; Compose TLS thực sự khởi chạy trên môi trường cô lập và PowerShell default validate-only đạt. Domain công khai, automatic certificate issuance với DNS thật, secret manager, remote staging load và provider live chưa được nghiệm thu.
