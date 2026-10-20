# Rec-Food

Ứng dụng gợi ý món ăn cá nhân hóa bằng AI.

## Cấu trúc

- `backend`: Fastify API viết bằng TypeScript.
- `frontend`: React/Vite client với onboarding, gợi ý hôm nay, lịch sử và tìm quán.
- `docs`: Kiến trúc, roadmap và system prompt.

## Chạy backend

```powershell
# Chỉ chạy một lần khi chưa có file .env ở root:
Copy-Item backend/.env.example .env

# Chạy PostgreSQL, migration và backend; chưa chạy frontend:
docker compose up --build -d postgres migrate backend
```

Backend mặc định chạy tại `http://localhost:3001`. Kiểm tra bằng `GET /health`.

## Chạy toàn bộ bằng Docker

Từ thư mục root của dự án:

```bash
docker compose up --build -d
```

Compose sẽ chạy theo thứ tự:

```text
PostgreSQL -> Prisma migrations -> backend readiness -> frontend
```

Seed bootstrap chạy riêng: `docker compose --profile bootstrap run --rm seed`. Cần SEED_ADMIN_EMAIL/PASSWORD trong private env để tạo ADMIN. Không seed lại mỗi lần rollout. Backend chạy tại `http://127.0.0.1:3001`; kiểm tra dependency bằng:

```bash
curl http://127.0.0.1:3001/ready
```

Chạy nền:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

Dừng container nhưng giữ dữ liệu PostgreSQL:

```bash
docker compose down
```

Xóa cả container và database volume local:

```bash
docker compose down -v
```

`docker compose down -v` xóa dữ liệu local và không thể khôi phục nếu chưa backup.

Có thể đặt `POSTGRES_PASSWORD`, `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD` trong
file `.env` ở root. Các giá trị mặc định trong `compose.yaml` chỉ dành cho local development.

Frontend Nginx hiện chạy tại `http://localhost:8081`, proxy `/api` sang backend. Có thể đổi cổng bằng `FRONTEND_PORT` trong file `.env` ở root. Production seed chỉ tạo catalog chuẩn và ADMIN nếu được cấu hình; nhập ngân hàng món có nguồn qua ADMIN API. Local development chạy `cd frontend`, `npm ci`, `npm run dev` sau khi backend hoạt động.

Đặt `GEOAPIFY_API_KEY` trong file `.env` private ở root để bật tìm quán thật miễn phí qua Geoapify. `backend/.env` chỉ dùng khi chạy backend trực tiếp; Docker Compose đọc `.env` ở root. Không đưa provider key vào biến `VITE_*` hoặc frontend.

Chat dùng Gemini thật khi có `LLM_API_KEY`. Cấu hình local hiện tại dùng `gemini-3.5-flash-lite` vì model này có Free Tier và phù hợp tác vụ chat độ trễ thấp; ứng dụng không thể kiểm tra một API key có thuộc project đã bật billing hay không. Để bảo đảm không phát sinh phí, chỉ dùng key của project Google AI Studio Free Tier chưa liên kết Cloud Billing. Backend vẫn giữ giới hạn request và ngân sách nội bộ; khi hết giới hạn, Chat trả lỗi có kiểm soát thay vì tự tăng quota hoặc chuyển sang dịch vụ tính phí.

Docker local mặc định dùng developer key `1` của TheMealDB để hiển thị công thức miễn phí. Key này chỉ dành cho development/educational use; nếu phát hành ứng dụng công khai cần tuân theo chính sách production của TheMealDB.

### Luồng gợi ý món và cooldown 96 giờ

1. Người dùng cho phép GPS hoặc dùng tọa độ đã lưu trong hồ sơ.
2. Giao diện hiển thị món gợi ý và công thức có ảnh từ TheMealDB.
3. Bấm `Xem quán & chọn` chỉ mở danh sách địa điểm liên quan trong bán kính đã cấu hình; thao tác này **chưa** ghi món vào cooldown.
4. Đóng hộp thoại hoặc quay lại trước khi xác nhận sẽ không tạo interaction `CHOSEN`.
5. Chỉ sau khi chọn một quán và bấm `Chốt món này`, backend mới ghi `CHOSEN`; món đó mới bị loại khỏi danh sách gợi ý trong 96 giờ.

Geoapify free Places cung cấp địa điểm nhà hàng thật theo GPS nhưng không xác nhận thực đơn của từng quán. Vì vậy giao diện ghi rõ đây là “quán liên quan”, không khẳng định quán chắc chắn bán món đã chọn và không tự tạo giá/đánh giá giả.

Chi tiết rule 4 ngày, API kiến thức và cách kiểm tra: [Food Discovery implementation](docs/FOOD_DISCOVERY_IMPLEMENTATION.md).

## Tài khoản test theo role

Chỉ sử dụng các tài khoản này trong môi trường local/development. Hệ thống hiện có hai role:

| Role | Tài khoản | Mật khẩu | Phạm vi kiểm thử |
|---|---|---|---|
| `ADMIN` | `admin@rec-food.local` | `rec-food-local-admin-only` | API quản trị nội dung, tài khoản và vận hành |
| `USER` | `user.test@rec-food.local` | `UserTest@2026!` | Hồ sơ khẩu vị, gợi ý, bản đồ, chat, lịch sử và dữ liệu cá nhân |

Đăng ký công khai luôn tạo role `USER`. Client không được gửi `role` hoặc tự cấp quyền `ADMIN`.

### Tạo hoặc đặt lại ADMIN local

Khai báo trong file `.env` private ở root:

```dotenv
SEED_ADMIN_EMAIL=admin@rec-food.local
SEED_ADMIN_PASSWORD=rec-food-local-admin-only
```

Sau đó chạy:

```powershell
docker compose --profile bootstrap run --rm seed
```

Seed dùng `upsert`, vì vậy chạy lại sẽ đặt role thành `ADMIN` và cập nhật mật khẩu theo private env. Dashboard redesign hiện chưa hiển thị module quản trị; các endpoint `/admin/*` được kiểm thử qua API cho tới khi admin UI được nối lại.

### Tạo lại USER test

```powershell
$env:TEST_USER_EMAIL = "user.test@rec-food.local"
$env:TEST_USER_PASSWORD = "UserTest@2026!"

$body = @{
  email = $env:TEST_USER_EMAIL
  password = $env:TEST_USER_PASSWORD
  displayName = "Test User"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8081/api/auth/register" `
  -ContentType "application/json" `
  -Body $body
```

Sau khi đăng ký, đăng nhập tại `http://localhost:8081`. Nếu `FRONTEND_PORT` trong private env khác `8081`, sử dụng port đã cấu hình.

### Kiểm tra role thực tế

```powershell
$loginBody = @{
  email = $env:TEST_USER_EMAIL
  password = $env:TEST_USER_PASSWORD
} | ConvertTo-Json

$session = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8081/api/auth/login" `
  -ContentType "application/json" `
  -Body $loginBody

$headers = @{ Authorization = "Bearer $($session.data.accessToken)" }
Invoke-RestMethod -Uri "http://localhost:8081/api/users/me" -Headers $headers
```

Response `/users/me` phải trả đúng `data.user.email` và `data.user.role`.

Các email trong `frontend/tests/*.spec.js` phần lớn chỉ là fixture Playwright. Email có tiền tố `api-smoke-`, `codex-smoke-` hoặc hậu tố ngẫu nhiên không phải tài khoản dùng chung. Hai mật khẩu ở trên chỉ dành cho local development, không được dùng ở production và cần đổi nếu môi trường được chia sẻ công khai. Không commit `.env`, access token, refresh token hoặc mật khẩu production vào repository.

## Kiểm tra chất lượng

```bash
cd backend
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
```

Kiểm tra release sau build: `npm run release:check` chỉ kiểm tra cấu hình; `npm run release:check:db` đọc migration status. Sau khi cấu hình AI, `npm run release:smoke:ai` chạy năm model contracts có cap reservation và quota chung. Xem [runbook](docs/RELEASE_RUNBOOK.md) để phân biệt kết nối đã cấu hình với nghiệm thu live; lệnh không tự đánh dấu tasks hoàn tất.

## Database commands

```bash
# Tạo và apply migration mới trong development
npm run db:migrate -- --name ten_migration

# Apply migration đã commit
npm run db:migrate:deploy

# Kiểm tra trạng thái migration
npm run db:migrate:status

# Seed development data
npm run db:seed
```

Không dùng `prisma db push` làm quy trình thay đổi schema chính thức.

## Chức năng và vận hành hiện tại

Checkpoint 07/10/2026: **78/86 mục đã nghiệm thu**. Frontend gọi backend qua `/api`: nhập khẩu vị tự do, phân tích/xác nhận theo revision, gợi ý hôm nay/budget/vị trí 3–4 km, cooldown 96 giờ, wheel, tìm quán, hướng dẫn nấu, lịch sử/rating/báo cáo, quản trị nội dung/evidence/tài khoản/sync, email và export/delete. Đặt món/thanh toán/giao hàng giữ Coming soon. Provider chưa có credentials báo chưa cấu hình; không dùng dữ liệu giả để lấp kết quả.

Để chạy background, đặt WORKER_ENABLED=true trong cùng private env của web và worker; Compose dùng `--profile background up -d` hoặc từ backend chạy riêng `npm run worker`. Thiếu key AI vẫn chạy email/retention/deletion nếu cấu hình tương ứng. MENU_SYNC_WORKER_ENABLED mặc định false và registry merchant rỗng cho tới khi có tài liệu/quyền supplier; bật flag hoặc Maps key không tự tạo giá món thật. API keys được khai báo theo [backend env example](backend/.env.example) nhưng giá trị thật đặt trong `.env` ở root; Vite không có key provider.

[Runbook phát hành](docs/RELEASE_RUNBOOK.md) có cấu hình, status code-ready/live-ready, validation, backup/rollback, TLS và các gate chưa thể nghiệm thu. [Checklist 86 mục](openspec/changes/complete-food-discovery-platform/tasks.md) là nguồn tiến độ chính thức. Live AI/menu/email và release staging chưa hoàn tất chỉ vì tests dùng fixture đạt.
