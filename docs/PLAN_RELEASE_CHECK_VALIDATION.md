# Kiểm tra cấu hình và smoke AI trước release

07/10/2026 — tiến độ giữ 78/86. Đợt này bổ sung tooling cho các live gates; không đóng tám tasks còn thiếu credentials/contract/staging.

`npm run release:check` đọc `.env` backend, environment process có ưu tiên, kiểm tra validators runtime cho app/proxy/namespace/scoring, nguồn quán/công thức, AI price contract, email sender/origin/encryption và worker/menu adapter flags. Không có API hay database writes. Thiếu đầu vào trả `NEEDS_INPUT`; kể cả mọi key/flag đủ vẫn là `CONFIGURED_NOT_LIVE_VERIFIED`. Không đoán supplier hoặc email delivery từ cấu hình.

`npm run release:check:db` kiểm tra bằng SELECT đủ migration metadata, không apply schema hay seed. Lượt chạy thực trên dev database: expected 31, missing 0, unknown 0, unresolved 0; database PASS, overall NEEDS_INPUT vì keys/adapter/worker chưa có. Không tạo/xóa user, history, jobs hoặc reset quota. Env đã kiểm tra chỉ qua booleans, không in secrets.

`npm run release:smoke:ai` hiện trả NEEDS_VALID_CONFIG trước truy cập DB/provider vì AI key trống. Bài smoke chạy tối đa năm case bằng production prompts/validators: explicit allergy/budget, grounded ranking IDs/reasons, thiếu location, Coming soon transaction và recipe multi-turn. Outputs tổng hợp, không lấy khẩu vị người dùng thật. Không chạy tool/create account/gửi email, không đánh dấu tasks; provider pass chưa chứng minh async/SSE/UX live.

Budget guard giữ daily request/USD namespace của app, cap tổng 5 USD mặc định (CLI giới hạn 0,01–10), không refund và không implicit retries. Không overbook khi có concurrent reserve. Report chỉ latency/status/error codes và conservative reserved USD, không provider body/output; token usage/invoice thật phải đo riêng trước đóng 7.5.

80 unit tests toàn bộ pass, gồm chín ca mới: không gộp config với live, redact invalid inputs, config đủ nhưng unverified, đủ năm contracts, invented IDs fail và dừng, quota/private failure redacted, run cap trước counter, shared quota/USD và concurrent reservations. Backend lint/typecheck/build đạt. CLI mặc định và database mode đã chạy; thiếu key ở live mode đã chạy và chặn đúng. Chưa gọi Gemini/email/menu supplier thật. Kết quả 132 DB/112 browser là lịch sử checkpoint trước.

Docker runtime bổ sung script và migration metadata, không thêm env/key vào image. Image `rec-food-backend:plan-release` build đạt; chạy CLI trong container non-root với `--network none` và cấu hình tổng hợp trả NEEDS_INPUT, exit 2, liveVerified false đúng như dự kiến. Không thay container phục vụ hiện có. Hướng dẫn và exit semantics trong [release runbook](RELEASE_RUNBOOK.md).
