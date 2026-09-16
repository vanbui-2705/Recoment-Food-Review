## Why

Recommendation cần dữ liệu có cấu trúc về khẩu vị và các giới hạn an toàn của từng người dùng trước khi xây dựng kho món ăn. DB02 bổ sung nền tảng dữ liệu này, trong đó dị ứng và chế độ ăn bắt buộc có thể được dùng làm hard constraint ở các module sau.

## What Changes

- Thêm hồ sơ khẩu vị một-một với user, gồm bốn điểm vị giác, ngân sách, khoảng cách tối đa và trạng thái onboarding.
- Thêm danh mục allergen, dietary restriction và cuisine có mã ổn định.
- Thêm các bảng nối lưu dị ứng, chế độ ăn và mức độ yêu thích cuisine của từng user.
- Thêm database constraints cho miền giá trị và khóa ghép chống dữ liệu trùng.
- Mở rộng seed bằng các danh mục tối thiểu theo cách idempotent.
- Thêm database integration tests cho quan hệ, unique constraint, check constraint và cascade.

## Capabilities

### New Capabilities

- `taste-profile-database`: Lưu khẩu vị, ngân sách, khoảng cách và trạng thái onboarding của từng user.
- `food-constraint-catalogs`: Quản lý danh mục dị ứng, chế độ ăn, cuisine và lựa chọn tương ứng của user.

### Modified Capabilities

Không có.

## Impact

- Mở rộng Prisma schema và generated client.
- Thêm một migration DB02 sau migration authentication hiện có.
- Mở rộng development seed và database integration test.
- Chưa thêm HTTP endpoint hoặc business service cho taste profile.
