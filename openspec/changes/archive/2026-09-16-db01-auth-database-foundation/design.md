## Context

Backend Fastify trước DB01 chưa có persistence layer. Thay đổi này cần một database local có thể tái lập, ORM hỗ trợ TypeScript và cơ chế version schema rõ ràng; xem `proposal.md` và đặc tả `authentication-database`.

## Goals / Non-Goals

**Goals:**

- Quản lý mọi thay đổi schema bằng migration bất biến.
- Tích hợp database connection vào lifecycle của Fastify.
- Tạo nền tảng dữ liệu đủ cho module authentication tiếp theo.
- Có seed và integration test có thể chạy lại.

**Non-Goals:**

- Chưa triển khai API đăng ký, đăng nhập hay phát JWT.
- Chưa triển khai hồ sơ khẩu vị hoặc dữ liệu món ăn.
- Chưa thiết lập database production hay high availability.

## Decisions

- Dùng PostgreSQL 17 vì dữ liệu có quan hệ và cần constraint mạnh; SQLite không phản ánh đủ kiểu dữ liệu và hành vi production dự kiến.
- Dùng Prisma ORM 7 với PostgreSQL driver adapter để có generated type, migration history và connection pool tương thích runtime hiện tại.
- Dùng UUID cho primary key để ID không phụ thuộc sequence database.
- Map Prisma camelCase sang database snake_case để giữ quy ước riêng cho code và SQL.
- Hash mật khẩu bằng Argon2id; refresh token cũng chỉ được lưu dưới dạng hash.
- Database plugin sở hữu Prisma client và connection pool, đồng thời đóng cả hai trong Fastify `onClose`.

## Risks / Trade-offs

- [Prisma CLI có dependency audit advisory] → Không áp dụng bản sửa `--force` gây downgrade lớn; theo dõi và nâng phiên bản an toàn sau.
- [Integration test phụ thuộc Docker database local] → Tách thành lệnh `test:db`, không làm test thường thất bại khi database chưa chạy.
- [Seed admin dùng biến môi trường] → Bỏ qua admin seed khi thiếu thông tin và không commit secret thật.

## Migration Plan

1. Khởi động PostgreSQL local bằng Docker Compose.
2. Áp dụng migration `20260916134059_init_auth`.
3. Generate Prisma Client và chạy seed development nếu đã cấu hình credentials.
4. Xác nhận migration status, integration tests và application health.

Rollback development có thể xóa database volume và chạy lại migration. Ở môi trường dùng chung, không sửa migration đã áp dụng; tạo migration bù nếu cần rollback schema.
