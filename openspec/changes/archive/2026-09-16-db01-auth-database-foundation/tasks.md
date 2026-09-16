## 1. Database foundation

- [x] 1.1 Thêm PostgreSQL 17 local bằng Docker Compose và cấu hình `DATABASE_URL`
- [x] 1.2 Cài đặt Prisma ORM, PostgreSQL adapter và cấu hình migration/seed
- [x] 1.3 Tạo schema `User`, `RefreshToken`, enum role/status và các relation/index
- [x] 1.4 Tạo và áp dụng migration `20260916134059_init_auth`

## 2. Runtime và dữ liệu phát triển

- [x] 2.1 Tạo Fastify database plugin quản lý Prisma client và connection pool
- [x] 2.2 Tạo development admin seed idempotent với Argon2id password hash

## 3. Verification

- [x] 3.1 Kiểm tra kết nối PostgreSQL và unique email bằng database integration tests
- [x] 3.2 Chạy migration status, generate, typecheck, lint, tests và build thành công
- [x] 3.3 Cập nhật tài liệu database và architecture
