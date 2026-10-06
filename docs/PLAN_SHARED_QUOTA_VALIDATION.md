# Giới hạn dùng chung và giám sát vận hành

07/10/2026 — hoàn tất 12.5, tiến độ 64/86. Các phần provider/admin/metrics của 10.6 và 12.4 tiếp tục bổ sung; chưa đóng khi scheduler và chi phí AI chưa hoàn tất.

Migration 26 thêm shared quota và observation. Route rate limit dùng tài khoản sau xác thực, IP trước xác thực; đổi IP không vượt được giới hạn tài khoản. Key SHA-256, không lưu IP/user ID trong bucket. PostgreSQL UPSERT quyết định nhận/chặn nguyên tử, đồng hồ database, Retry-After; database lỗi trả 503, không chuyển sang bộ đếm memory trong production. Memory chỉ dành app test không đăng ký database. Các replica phải dùng cùng SECURITY_NAMESPACE; mặc định rec-food. Tests có namespace riêng và chỉ xóa quota/observation của fixture, không reset quota đang sử dụng.

Mọi HTTP request tìm quán, chi tiết, ảnh Google và công thức được bọc quota dùng chung theo provider, mặc định 120/phút (`PROVIDER_REQUESTS_PER_MINUTE`). Fan-out Goong nhiều detail cũng tính từng request. Host allowlist cố định, HTTPS, không nhận URL từ người dùng. Observation chỉ giữ tên nguồn, thời điểm và số đếm HTTP thành công/lỗi/quota; không lưu URL, khóa hay truy vấn khẩu vị. Thành công HTTP không khẳng định menu/giá chính xác. Không có key hiển thị NOT_CONFIGURED; chưa gọi gần đây hiển thị NOT_CHECKED. Trang ADMIN không tự probe API trả phí.

`/admin/operations` hiển thị provider quota, cấu hình AI/email/worker, hàng đợi analysis/chat/email/delete và retention. Danh sách yêu cầu xóa có cursor, không trả định danh chủ tài khoản hay lease token. Retry chỉ cho FAILED + tài khoản DISABLED + worker bật; yêu cầu xác nhận, CAS updatedAt và audit cùng transaction. Hai thao tác đồng thời chỉ một lần được nhận; 409 tải lại và cảnh báo, không hiển thị đã xử lý thành công. USER không xem hoặc ghi được các endpoint này.

Prometheus `/admin/metrics` bổ sung counters provider, quota used/limit, backlog email/delete và thời điểm/lỗi cleanup; labels chỉ danh sách cố định, không PII. LLM request quota trước đó đã nguyên tử PostgreSQL, giới hạn chi phí tiếp tục trong đợt AI tiếp theo.

Build/lint/unit 65/65 đạt; PostgreSQL toàn bộ 119/119, migration-from-empty 26 đạt. Browser production toàn bộ 100/100, sau đó chạy lại các ca vận hành để nghiệm thu cảnh báo stale bổ sung. Docker backend/frontend plan-quota đạt. Hai lỗi ở lần DB đầu đã xử lý: fixture spam trước đây đổi IP trên cùng user; giờ dùng user fixture riêng theo giới hạn tài khoản. Default transport ảnh hiện resolve global fetch tại thời điểm gọi để test không gọi nhầm provider thật.

Benchmark chạy `node --import tsx scripts/benchmark-quota.ts` từ backend: 100 request đồng thời, hai Fastify instance/pool riêng, limit 20; nhận 20, chặn 80, không lỗi khác, tổng 688 ms, p50 420 ms, p95 650 ms trên máy local Windows/Docker. Benchmark chỉ tạo/xóa namespace riêng. Đây là kiểm tra tính nguyên tử và contention local, chưa thay thế load test discovery/analysis/chat hoặc staging benchmark.

Vận hành: khi quota tăng cao, xem giới hạn provider thực tế và cấu hình đồng bộ mọi replica; không tăng quota chỉ để bỏ cảnh báo. Lỗi cleanup/deletion: xem log worker theo mã công việc, sửa database/quyền truy cập trước khi xác nhận chạy lại trong ADMIN. Email FAILED không khẳng định đã gửi; người dùng yêu cầu link mới sau khi cấu hình được sửa. Chưa tự chạy scheduler merchant chưa có hợp đồng nguồn.
