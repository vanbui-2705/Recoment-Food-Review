# P0/P1 — Phân tích khẩu vị từ mô tả

Triển khai ngày 06/10/2026. Giữ nguyên ô nhập mô tả tự do; không yêu cầu người dùng nhập món hoặc chọn catalog để bắt đầu.

## Luồng thực tế

PUT `/users/me/food-knowledge` lưu mô tả và enqueue job trong cùng transaction. Một revision chỉ có một job schema version 1. Worker riêng claim job qua PostgreSQL `FOR UPDATE SKIP LOCKED`, tăng attempt, đặt lease token/thời hạn; AI call chạy ngoài transaction. Job hết lease có thể được worker khác lấy lại; kết quả từ lease cũ không được áp dụng. Retry có backoff và tối đa `JOB_MAX_ATTEMPTS`.

Job có trạng thái QUEUED/RUNNING/NEEDS_REVIEW/APPLIED/FAILED/SUPERSEDED. Mô tả sửa trong lúc phân tích khiến kết quả cũ SUPERSEDED. Khi apply, khóa bản mô tả rồi job; kiểm tra revision, lease và tài khoản ACTIVE; cập nhật profile + analyzedRevision + job atomically.

Các sở thích có schema và trích đoạn nguồn hợp lệ có thể tự áp dụng. Dị ứng/diet mới hoặc câu chữ về an toàn cần review; AI không tự xóa ràng buộc cũ. Câu hỏi chưa rõ buộc sửa mô tả, không thể xác nhận để bỏ qua. Các tên món không map chắc chắn vẫn nằm trong kết quả trích xuất cá nhân, không bị tạo thành món/quán/giá giả. Alias rõ ràng mới được liên kết preference catalog. Các trường không được nói rõ giữ giá trị cũ; profile mới dùng giá trị mặc định của app, không gọi những mặc định đó là thông tin AI đã nhận diện.

Gợi ý cá nhân hóa và ý tưởng nấu vẫn pending khi chưa xử lý revision hiện tại. Tìm kiếm chủ động, tìm quanh đây và vòng quay hoạt động như trước. Phân tích allergy không xác minh món/quán an toàn; evidence theo từng quán thuộc P2.

## API

Tất cả endpoint dưới đây authenticated, owner-only, no-store:

| Method | Path | Hành vi |
|---|---|---|
| GET | `/users/me/food-knowledge/analyses` | Job revision hiện tại và configured flag |
| POST | `/users/me/food-knowledge/analyses` | Enqueue/retry current revision, 202; thiếu key trả 503 AI_NOT_CONFIGURED |
| GET | `/users/me/food-knowledge/analyses/:id` | Trạng thái, kết quả, mã lỗi chuẩn hóa; khác owner trả 404 |
| POST | `/users/me/food-knowledge/analyses/:id/confirm` | `{ "sourceRevision": 2 }`; xác nhận đúng revision và không còn questions |

Start/confirm rate-limit 10/IP/phút. Confirm lại APPLIED cùng revision là idempotent; confirm revision cũ trả 409. GET result không trả private reasoning, API key hoặc lease token. Giao diện profile/trang chủ pending có polling giới hạn hai phút và nút cập nhật; sau khi job đang theo dõi chuyển APPLIED, trang chủ tải lại recommendation/cooking state.

## Cấu hình và chạy

Provider đầu tiên là Gemini REST GenerateContent structured JSON. Adapter dùng endpoint cố định, key trong header, redirect bị chặn, response <=100 KB, deadline và output token limit. Output backend kiểm tra thêm schema, catalog, nguồn trích nguyên văn, mã trường, budget và duplicate facts. JSON sai/blocked output không được áp dụng. Provider quota/mạng lỗi có retry giới hạn.

Hợp đồng đối chiếu tại lúc triển khai: [Google structured output REST](https://ai.google.dev/gemini-api/docs/generate-content/structured-output) và [GenerateContent reference](https://ai.google.dev/api/generate-content). Model mặc định theo tài liệu đã kiểm tra là `gemini-3.8-flash`; có thể đặt model hợp lệ của project trong `LLM_MODEL`. Tính năng chat/rerank chưa được triển khai chỉ vì adapter structured JSON đã có.

`backend/.env.example` và `.env` local đã có các tên:

```dotenv
LLM_PROVIDER=gemini
LLM_API_KEY=
LLM_MODEL=gemini-3.8-flash
LLM_TIMEOUT_MS=20000
LLM_MAX_TOKENS=4096
LLM_DAILY_REQUEST_LIMIT=200
WORKER_ENABLED=false
JOB_MAX_ATTEMPTS=3
JOB_LEASE_SECONDS=90
```

Điền key, đặt `WORKER_ENABLED=true`, restart backend để web nhận configured flag, rồi chạy process riêng:

```powershell
cd backend
npm run db:migrate:deploy
npm run db:generate
npm run worker
```

Production image: `npm run worker:start`; Compose: `docker compose --profile ai up --build -d` sau khi cấu hình secrets root environment. Web và worker có cùng model/key; worker có thể bật bằng environment riêng. Không chạy AI worker bên trong request web. Khi worker không bật hoặc key trống, job vẫn lưu QUEUED và không có phân tích giả. Tài khoản có mô tả từ trước có thể bấm phân tích lại sau khi cấu hình để tạo job.

LLM_DAILY_REQUEST_LIMIT là cap số lần gọi toàn database theo ngày UTC, được reserve atomically trước request; failed requests vẫn tính, vì upstream có thể đã xử lý. Đây là giới hạn số request, không phải ngân sách tiền tệ. Token/deadline bị chặn theo config; theo dõi chi phí model đầy đủ thuộc P3/P6. Usage chỉ lưu ngày + số lần gọi, không lưu mô tả/token. Safety confirmation giữ allergy/diet cũ, việc xóa/thay thế ràng buộc sẽ cần workflow người dùng rõ ràng ở phần tiếp theo.

## Nghiệm thu và giới hạn

Các ca đã bổ sung: schema/catalog/evidence, invalid model/config/deadline, quota/key privacy/output size; save/enqueue idempotency, owner isolation, concurrent worker claims, stale revision, safety review, omission preservation, unclear safety, stale confirmation, lease recovery và bounded retries. Browser tests kiểm tra review không thay ô nhập tự do, confirm đúng revision, yêu cầu clarification, missing AI và Coming soon.

Node CI/backend/frontend Docker thống nhất 24; Playwright giới hạn hai workers. CI có frontend build/browser và Docker image builds. Dependency source-map-js backend được cập nhật bản vá trong lockfile. Cart/order/payment/delivery chỉ có thông báo Coming soon ở footer, không có route/tool giao dịch.

Tiến độ/test thực hiện cập nhật ở [P0/P1 validation](PLAN_P0_P1_VALIDATION.md). Key hiện chưa được cấu hình nên chưa nghiệm thu AI live. P2–P6 và checklist live-provider vẫn là công việc tiếp theo; không coi toàn bộ completion plan đã hoàn thành.
