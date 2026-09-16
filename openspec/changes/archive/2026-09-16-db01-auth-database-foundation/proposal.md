## Why

Rec-Food cần một nền tảng lưu trữ xác thực có version để các module đăng ký, đăng nhập, refresh token và phân quyền có thể được triển khai an toàn. DB01 thiết lập PostgreSQL, Prisma và schema authentication đầu tiên theo migration-first workflow.

## What Changes

- Thiết lập PostgreSQL 17 chạy local bằng Docker Compose.
- Tích hợp Prisma ORM 7 và PostgreSQL driver adapter vào lifecycle của Fastify.
- Thêm bảng `users` và `refresh_tokens`, cùng enum role/status và các ràng buộc quan hệ.
- Thêm migration khởi tạo, development seed idempotent và database integration tests.
- Chuẩn hóa quy trình generate, migrate, deploy, seed và kiểm tra trạng thái migration.

## Capabilities

### New Capabilities

- `authentication-database`: Lưu tài khoản người dùng và refresh token an toàn trên PostgreSQL với schema được quản lý bằng migration.

### Modified Capabilities

Không có.

## Impact

- Thêm PostgreSQL vào môi trường phát triển local.
- Thêm Prisma schema, generated client, migration và seed dưới `backend/prisma`.
- Thêm database plugin cho Fastify và biến môi trường `DATABASE_URL`.
- Thêm kiểm thử tích hợp cần database đang chạy.
