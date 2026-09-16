## Context

DB01 đã cung cấp `users`, PostgreSQL và Prisma migration workflow. DB02 mở rộng schema để lưu dữ liệu cá nhân hóa trước khi DB03 thêm món ăn; xem proposal và hai capability specs của change này.

## Goals / Non-Goals

**Goals:**

- Duy trì tính toàn vẹn của dữ liệu khẩu vị ngay tại database.
- Tách danh mục chuẩn hóa khỏi lựa chọn theo user.
- Biểu diễn rõ hard constraint và soft preference.
- Cho phép seed danh mục chạy lặp lại an toàn.

**Non-Goals:**

- Chưa tạo API CRUD hoặc luồng onboarding.
- Chưa áp dụng hard filter lên món ăn vì DB03 chưa có dish knowledge base.
- Chưa hỗ trợ catalog do người dùng tự tạo hoặc bản địa hóa nhiều ngôn ngữ.

## Decisions

- `TasteProfile.userId` là unique foreign key và cascade theo user; cách này thể hiện quan hệ một-một mà không dùng user ID làm primary key, giúp các model thống nhất UUID riêng.
- Điểm vị giác dùng `SMALLINT`; budget và distance dùng `INTEGER`. Check constraints được tạo trong migration SQL vì Prisma schema chưa biểu diễn đầy đủ loại constraint này.
- Catalog dùng UUID nội bộ và `code` dạng uppercase, unique, ổn định để seed/upsert không phụ thuộc display name.
- Các bảng nối dùng composite primary key thay vì ID riêng để database tự ngăn quan hệ trùng.
- `AllergySeverity` gồm `UNKNOWN`, `MILD`, `MODERATE`, `SEVERE`; severity cung cấp ngữ cảnh nhưng không làm giảm tính bắt buộc của allergy.
- `UserDietaryRestriction.isMandatory` phân biệt hard constraint với preference mềm và mặc định là true nhằm ưu tiên an toàn.
- Xóa user sẽ cascade profile và lựa chọn cá nhân. Xóa catalog đang được tham chiếu sẽ bị restrict để tránh mất ngữ nghĩa dữ liệu.

## Risks / Trade-offs

- [Prisma schema không khai báo check constraint] → Giữ constraint trong migration SQL và kiểm thử trực tiếp hành vi database.
- [Catalog code ban đầu có thể chưa đầy đủ] → Seed một bộ tối thiểu và bổ sung bằng migration/data script versioned khi yêu cầu thay đổi.
- [Severity dễ bị hiểu nhầm là cho phép vi phạm allergy nhẹ] → Spec quy định mọi user allergy luôn là hard constraint.
- [Cascade xóa user làm mất preference] → Đây là dữ liệu sở hữu riêng của user; cascade phù hợp với lifecycle và quyền xóa dữ liệu.

## Migration Plan

1. Mở rộng Prisma schema bằng các model và enum DB02.
2. Tạo migration mới `add_taste_profile` sau DB01, bao gồm check constraints.
3. Generate Prisma Client và mở rộng seed catalog bằng upsert.
4. Áp dụng migration lên database hiện tại và chạy seed hai lần để xác nhận idempotency.
5. Chạy integration tests cho constraint, uniqueness và cascade.

Nếu cần rollback ở môi trường dùng chung, tạo migration bù để xóa các bảng DB02 theo thứ tự bảng nối trước, catalog/profile sau; không chỉnh sửa migration đã áp dụng.
