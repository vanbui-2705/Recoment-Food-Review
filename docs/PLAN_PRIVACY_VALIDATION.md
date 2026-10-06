# Dữ liệu tài khoản và quyền riêng tư

07/10/2026 — hoàn tất 11.6, 11.7, 11.8; tiến độ 63/86.

`POST /users/me/export` yêu cầu mật khẩu hiện tại, chỉ xuất dữ liệu chủ tài khoản bằng JSONL có bản ghi hoàn tất. Mỗi trang 200 bản ghi, tối đa 50 MB/120 giây, kiểm tra trạng thái tài khoản và phiên trước mỗi trang. Thu hồi riêng thiết bị đang tải cũng dừng export; thiết bị khác vẫn dùng được. Không xuất password/token hash, IP, khóa, payload email, nội dung quán/công thức do provider cấp hoặc review nội bộ. Không lưu file export trên server. Client chỉ tải file khi stream có bản ghi hoàn tất; lỗi giữ input và cho thử lại.

`DELETE /users/me/account` yêu cầu mật khẩu, consent và nhập chính xác `XÓA TÀI KHOẢN`. Khi worker chưa bật, API trả 503 và giữ tài khoản. Khi tiếp nhận, transaction khóa tài khoản, thu hồi mọi phiên và đưa vào hàng đợi; UI ghi rõ đã tiếp nhận, chưa khẳng định xóa hoàn tất. ADMIN cuối cùng được bảo vệ. ADMIN không thể mở lại tài khoản đang chờ xóa.

Worker claim bằng SKIP LOCKED, lease 60 giây, tối đa 5 lần; transaction xóa dữ liệu sở hữu/cascade, ẩn danh report/review/evidence/audit và lưu receipt không chứa user ID. Audit vẫn chống sửa nội dung; chỉ cho phép null định danh tương ứng trong transaction ẩn danh. Lỗi rollback toàn bộ, retry có backoff; job thất bại cần kiểm tra vận hành. Không tự chạy cleanup toàn database trong đợt kiểm thử.

Retention mặc định: chat và recommendation 90 ngày, hành vi 180 ngày, audit 365 ngày, token/email đã hết hạn thêm 7 ngày. Không xóa mô tả khẩu vị hiện tại. Giữ run có lease còn hiệu lực; hội thoại cũ bị kẹt QUEUED không giữ dữ liệu vô hạn. Mỗi nhóm tối đa 200 bản ghi/transaction; lease chung chống chạy trùng worker. Cooldown 96 giờ nằm hoàn toàn trong khoảng giữ hành vi 180 ngày. Public privacy API hiển thị DISABLED/PENDING/ACTIVE theo flag và lần cleanup gần nhất; UI không hứa cleanup đang chạy khi worker chưa hoạt động.

Migration additive 24/25 đã chạy từ schema rỗng. Backend build/lint đạt, unit 65/65, PostgreSQL 114/114. Browser production desktop/mobile 96/96. Docker backend/frontend `plan-privacy` build đạt. Regression mới kiểm tra owner isolation, thu hồi riêng phiên đang export, xác nhận xóa, anonymization/immutable audit, recovery một lần qua hai worker, retention giữ cooldown và lease đang chạy.

Đưa lên môi trường thật: chạy migration riêng, triển khai web và worker cùng phiên bản, bật `WORKER_ENABLED=true` ở cả hai khi worker sẵn sàng. Kiểm tra maintenance lease và job thất bại, backup theo chính sách triển khai. Việc xóa trên database đang hoạt động không tự xóa ngay các bản backup đã tạo; không restore backup cũ vào production trước khi xử lý lại yêu cầu xóa. Phần kiểm thử backup/restore và bảng giám sát tiếp tục ở nhóm 12.
