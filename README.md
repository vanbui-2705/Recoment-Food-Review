# Rec-Food

Ứng dụng gợi ý món ăn cá nhân hóa bằng AI.

## Cấu trúc

- `backend`: Fastify API viết bằng TypeScript.
- `frontend`: Web client, chưa triển khai.
- `docs`: Kiến trúc, roadmap và system prompt.

## Chạy backend

```bash
cd backend
npm install
copy .env.example .env
docker compose up -d
npm run db:migrate:deploy
npm run db:generate
npm run db:seed
npm run dev
```

Backend mặc định chạy tại `http://localhost:3001`. Kiểm tra bằng `GET /health`.

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
