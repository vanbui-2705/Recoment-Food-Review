# Rec-Food

Ứng dụng gợi ý món ăn cá nhân hóa bằng AI.

## Cấu trúc

- `backend`: Fastify API viết bằng TypeScript.
- `frontend`: React/Vite client với onboarding, gợi ý hôm nay, lịch sử và tìm quán.
- `docs`: Kiến trúc, roadmap và system prompt.

## Chạy backend

```bash
docker compose up -d postgres
cd backend
npm install
copy .env.example .env
npm run db:migrate:deploy
npm run db:generate
npm run db:seed
npm run dev
```

Backend mặc định chạy tại `http://localhost:3001`. Kiểm tra bằng `GET /health`.

## Chạy toàn bộ bằng Docker

Từ thư mục root của dự án:

```bash
docker compose --env-file backend/.env up --build -d
```

Compose sẽ chạy theo thứ tự:

```text
PostgreSQL -> Prisma migrations -> backend readiness -> frontend
```

Seed bootstrap chạy riêng: `docker compose --env-file backend/.env --profile bootstrap run --rm seed`. Cần SEED_ADMIN_EMAIL/PASSWORD trong private env để tạo ADMIN. Không seed lại mỗi lần rollout. Backend chạy tại `http://127.0.0.1:3001`; kiểm tra dependency bằng:

```bash
curl http://127.0.0.1:3001/ready
```

Chạy nền:

```bash
docker compose --env-file backend/.env up --build -d
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

Frontend Nginx chạy tại `http://localhost:8080`, proxy `/api` sang backend. Production seed chỉ tạo catalog chuẩn và ADMIN nếu được cấu hình; nhập ngân hàng món có nguồn qua ADMIN API. Local development chạy `cd frontend`, `npm ci`, `npm run dev` sau khi backend hoạt động.

Đặt `GOOGLE_PLACES_API_KEY` ở backend để bật tìm quán thật. Chi tiết rule 4 ngày, API kiến thức, giới hạn Google Places và cách kiểm tra: [Food Discovery implementation](docs/FOOD_DISCOVERY_IMPLEMENTATION.md).

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

Để chạy background, đặt WORKER_ENABLED=true trong cùng private env của web và worker; Compose dùng `--profile background up -d` hoặc từ backend chạy riêng `npm run worker`. Thiếu key AI vẫn chạy email/retention/deletion nếu cấu hình tương ứng. MENU_SYNC_WORKER_ENABLED mặc định false và registry merchant rỗng cho tới khi có tài liệu/quyền supplier; bật flag hoặc Maps key không tự tạo giá món thật. API keys chỉ đặt trong [backend env example](backend/.env.example) tương ứng với private env; Vite không có key provider.

[Runbook phát hành](docs/RELEASE_RUNBOOK.md) có cấu hình, status code-ready/live-ready, validation, backup/rollback, TLS và các gate chưa thể nghiệm thu. [Checklist 86 mục](openspec/changes/complete-food-discovery-platform/tasks.md) là nguồn tiến độ chính thức. Live AI/menu/email và release staging chưa hoàn tất chỉ vì tests dùng fixture đạt.
