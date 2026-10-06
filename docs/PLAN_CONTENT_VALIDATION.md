# Quản trị nội dung và tạm ngừng gợi ý

07/10/2026 — hoàn tất 10.2, 10.5, 10.7; tiến độ 70/86.

Migration 29 bổ sung trạng thái hoạt động cho món, ẩm thực, nguyên liệu, quán; trạng thái kiểm duyệt món bán được lưu riêng với tình trạng do nhà cung cấp đồng bộ. Đồng bộ cập nhật giá/tình trạng nguồn không tự mở lại món bị quản trị viên tạm ngừng. Không xóa danh mục có tham chiếu lịch sử.

ADMIN có danh sách phân trang, tìm kiếm và lọc trạng thái cho năm nhóm dữ liệu; sửa tên/mô tả danh mục kiến thức, thêm ẩm thực/nguyên liệu. Món bán/giá/địa chỉ tiếp tục do API nhà cung cấp quản lý. Các API kiến thức món đầy đủ giữ cơ chế validation và bổ sung phiên bản cập nhật/audit. Mọi write quản trị mới yêu cầu quyền ADMIN, không chấp nhận trường ngoài schema; cập nhật nhãn/trạng thái dùng optimistic concurrency và nhật ký cùng transaction. Khi xung đột, UI giữ form và yêu cầu tải lại/xem lại trước khi xác nhận, không tự ghi đè hoặc báo thành công.

Hard filters loại món/quán/ẩm thực/offer tạm ngừng khỏi pool; GET recommendation và CHOSEN từ snapshot cũ kiểm tra lại trạng thái hiện tại. Legacy CHOSEN chạy serializable transaction, giữ idempotent replay; EATEN vẫn cho phép ghi nhận sự việc đã xảy ra. Danh mục chi tiết và lịch sử vẫn xem được, canonical ID và cooldown 96 giờ không bị thay đổi. Nguyên liệu ngừng hoạt động bị ẩn khỏi danh mục lựa chọn mới; bằng chứng dị ứng đã lưu vẫn được giữ.

Vận hành: vào Quản trị → Danh mục và quán, chọn loại và tìm tên. Tạm ngừng cần chọn lý do và xác nhận. Bật lại không bỏ qua giá, bán kính, freshness, mapping hay safety gates. Với menu, rà soát mapping/evidence ở Thực đơn và bằng chứng; với lỗi dữ liệu, xử lý ở Báo cáo dữ liệu. Khóa/mở tài khoản ở Người dùng, xem sự kiện ở Nhật ký quản trị. Khi dữ liệu đã thay đổi, tải phiên bản mới rồi đọc lại trước khi lưu. Không sử dụng tạm ngừng để xóa lịch sử hoặc sửa nội dung do API cung cấp.

Validation: backend build/lint, 69 unit, 127 database; migration-from-empty 29 đạt. Frontend production 106/106 ca desktop/mobile bao gồm review mapping/evidence/report/block/deactivate, stale retry, denied access, giữ form sau lỗi, empty states. Docker backend/frontend `plan-content` build đạt. Ban đầu fixture email ADMIN viết hoa không khớp normalization đăng nhập và assertion thông báo sai; đã sửa và chạy lại đầy đủ, không bỏ qua ca thất bại. Chưa gọi supplier/model/email live.
