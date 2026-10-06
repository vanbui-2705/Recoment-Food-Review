# Báo cáo dữ liệu và xử lý trong quản trị

07/10/2026; tiến độ checkpoint 50/86 mục.

Người dùng báo thông tin sai từ offer thực đơn, quán Places hoặc công thức. API giới hạn nguồn/reference, không nhận URL tùy ý hay user ID; offer phải tồn tại. Báo cáo gắn tài khoản, có idempotency/hash, mô tả giới hạn và quota chống spam. Nhật ký hiển thị trạng thái riêng và cập nhật/phân trang.

ADMIN có danh sách/detail/lịch sử xử lý, OPEN/IN_REVIEW/RESOLVED/DISMISSED và mở lại có lý do. CAS theo trạng thái/thời điểm cập nhật, timestamp đơn điệu; race chỉ một bên thành công. Review và audit ghi cùng transaction. Audit không chứa note người dùng/lý do nội bộ. Báo cáo không tự sửa giá hoặc chứng minh an toàn.

UI giữ mô tả và cùng mã gửi khi API thất bại, không thông báo thành công giả. Dialog hỗ trợ bàn phím, xác nhận gửi, phản hồi quota/error. Khi quản trị gặp stale review, tải lại báo cáo giữ lý do nhưng yêu cầu xem lại trạng thái mới. Layout quản trị có mục thực đơn/bằng chứng và báo cáo; các views quản trị khác tiếp tục xây.

Đã sửa cấu hình validator để từ chối thuộc tính ngoài schema thay vì tự xóa chúng. Cách tự xóa trước đó làm mất source trong nhánh union report và có thể làm request bị biến đổi. Toàn bộ database regression xác nhận cấu hình strict mới tương thích.

Kiểm chứng: typecheck/lint qua; toàn bộ PostgreSQL 91/91 qua (16 file); migration-from-empty 17 migration qua. Browser liên quan 20/20 qua desktop/mobile: báo cáo lỗi rồi retry cùng key, admin race/reload giữ lý do, history và restaurant/admin regression. Frontend production build qua. Toàn bộ browser 68/68 và Docker của checkpoint chat ghi trong PLAN_P4_VALIDATION.md; không coi đó là lần chạy lại image/full browser của đợt báo cáo.
