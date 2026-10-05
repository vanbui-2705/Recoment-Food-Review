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
docker compose up --build
```

Compose sẽ chạy theo thứ tự:

```text
PostgreSQL -> Prisma migrations -> development seed -> backend
```

Backend chạy tại `http://localhost:3001`; kiểm tra bằng:

```bash
curl http://localhost:3001/health
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
