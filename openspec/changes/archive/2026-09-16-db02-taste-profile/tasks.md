## 1. Schema và migration

- [x] 1.1 Thêm các enum, catalog model, taste profile và user relation vào Prisma schema
- [x] 1.2 Tạo migration DB02 riêng với foreign key, composite key và check constraint
- [x] 1.3 Apply migration và generate Prisma Client thành công

## 2. Seed

- [x] 2.1 Thêm dữ liệu tối thiểu cho allergen, dietary restriction và cuisine bằng upsert
- [x] 2.2 Chạy seed hai lần và xác nhận catalog không bị nhân đôi

## 3. Verification

- [x] 3.1 Thêm integration tests cho taste profile, miền giá trị và quan hệ không trùng
- [x] 3.2 Thêm integration test xác nhận dữ liệu DB02 cascade khi xóa user
- [x] 3.3 Chạy format, typecheck, lint, test database, test thường và build
- [x] 3.4 Cập nhật database plan và architecture theo trạng thái DB02
