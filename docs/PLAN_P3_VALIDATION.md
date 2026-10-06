# P3: gợi ý từ offer đã xác minh

Ngày kiểm chứng: 06/10/2026. Tiến độ kế hoạch: 40/86 mục nghiệm thu.

- Candidate sử dụng giá thực của offer VND, nguồn đang bật, hạn dữ liệu, trạng thái bán, khoảng cách chính xác và mapping đã duyệt. Lọc dị ứng/chế độ ăn/lây nhiễm chéo trước khi tính điểm; thiếu bằng chứng không được hiểu là an toàn.
- CHOSEN/EATEN loại món chuẩn trong 96 giờ; công thức nấu có tên chuẩn/alias được đối chiếu xuyên nguồn. Biên đúng 96 giờ được kiểm thử. Giá ước lượng trong knowledge base không thay thế giá offer.
- POST `/recommendations` có idempotency, lease và kiểm tra revision; GET kết quả và feedback kiểm tra chủ sở hữu. Snapshot không lưu ảnh, đánh giá hoặc nội dung Places. Dữ liệu giá hết hạn và nguồn thay đổi được kiểm tra lại khi đọc/xác nhận.
- Điểm chuẩn hóa 0–100, trọng số có giới hạn, thứ tự ổn định và đa dạng món/quán. AI chỉ sắp xếp các ID đã lọc và chọn lý do có căn cứ; ID lạ, trùng, thiếu hoặc lý do không được phép chuyển sang fallback giữ candidate hợp lệ. Có quota request, deadline và giới hạn token; giới hạn chi phí tiền tệ còn ở P6.
- Budget/radius/vị trí được lưu riêng khỏi mô tả khẩu vị. Today tự tải khi hồ sơ đã xử lý và có tọa độ đã lưu; không tự xin GPS. Lỗi GPS, nguồn chưa cấu hình, pending, no-safe-match, fallback và mở cửa chưa xác nhận có thông báo rõ. Revision mới hủy ảnh hưởng của response cũ.
- Wheel dùng pool hợp lệ; xác nhận lựa chọn rồi mới loại món. Sự kiện món nấu/món tại quán cập nhật pool theo tên chuẩn/alias. ADMIN giữ form khi tải lại và không hiển thị thành công trước API.

Kiểm chứng:

- Backend typecheck/lint: qua. Unit gần nhất: 55/55 qua.
- Toàn bộ PostgreSQL: 80/80 qua, 13 file. Thêm coverage về collision xuyên nguồn, quota ADMIN, idempotency concurrent, quyền sở hữu, snapshot, giá thật, safety, revision race, 96 giờ và discovery settings.
- Browser production: 58/60 qua trong đợt đầy đủ; 2 ca mobile thất bại do khởi tạo page quá thời gian và trạng thái render quá timeout 5 giây. Snapshot ca thứ hai đã có thông báo đúng. Chạy lại riêng cả 2 với một worker: 2/2 qua. Không thay timeout hoặc sửa logic sản phẩm để che lỗi.
- Các luồng mới gồm tự tải/revision/GPS/no-safe-match và chi tiết quán/back đã qua desktop/mobile.
- Migration từ schema trống: 15 migration qua; schema local đã cập nhật. Docker P2 đã qua; chưa chạy lại image P3 tại checkpoint này.

Chưa nghiệm thu live: chưa có supplier contract/key và Gemini key. Chưa có adapter merchant live hoặc live model smoke. Không sử dụng fixture kiểm thử làm dữ liệu production. Phần chat, feedback/history hoàn chỉnh, admin, tài khoản và vận hành tiếp tục xây; cart/payment/delivery giữ Coming soon.
