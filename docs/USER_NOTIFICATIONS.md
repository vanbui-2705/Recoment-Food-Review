# Thông báo trong ứng dụng

Thông báo dành cho những chức năng đang triển khai, không hiển thị thành công trước khi backend xác nhận. Không tự gửi lại thao tác lưu khi mạng trở lại.

| Tình huống | Thông báo / hành động |
|---|---|
| Lưu khẩu vị, chọn/ăn món thành công | Thông báo xanh có nút đóng; chọn/ăn nhắc vòng chờ 96 giờ |
| Ngoại tuyến | Cảnh báo giữ trên các màn hình; hướng dẫn kiểm tra mạng, dữ liệu có thể chưa cập nhật |
| Kết nối trở lại | Cho biết có thể thử lại; không khẳng định server đã hoạt động hoặc tự ghi lại thao tác |
| Hết phiên đăng nhập | Giải thích trên màn hình đăng nhập; token không còn hợp lệ được xóa |
| Lưu lỗi mạng / lỗi máy chủ | Không báo đã lưu, giữ nội dung đang nhập khi còn trên màn hình; hướng dẫn thử lại |
| Thao tác quá nhanh / hạn mức | Nhắc chờ và thử lại, không hiển thị stack trace/provider secret |
| Mô tả chưa lưu | Nhắc lưu trước khi rời màn hình; browser cảnh báo khi đóng/tải lại tab nếu hỗ trợ. Chưa lưu draft bền vững và chưa chặn mọi điều hướng nội bộ |
| Mô tả có revision mới | Giữ bản nhập, yêu cầu kiểm tra bản đã lưu; không ghi đè tự động |
| AI chưa kết nối / đang xử lý | Trạng thái hiện có; vẫn cho phép tìm kiếm chủ động |
| AI xử lý lâu hơn hai phút | Ngừng polling tự động, hướng dẫn cập nhật trạng thái, không cần gửi lại mô tả |
| AI thất bại / hết quota | Giải thích lỗi bằng tiếng Việt; nút phân tích lại |
| Dị ứng/diet cần review | Cảnh báo kiểm tra tên và thông tin nguồn, sửa mô tả nếu sai; chưa xác minh món tại quán an toàn |
| GPS bị từ chối / timeout / chưa có vị trí | Hướng dẫn bật quyền hoặc kiểm tra GPS, bấm tìm lại |
| Một nguồn quán lỗi | Cảnh báo danh sách có thể chưa đầy đủ; giữ kết quả nguồn khác |
| Quán chưa có menu/giá xác nhận | Cảnh báo hỏi quán về giá, nguyên liệu/dị ứng; ảnh/đánh giá là của quán |
| Không đủ bằng chứng an toàn / không có món phù hợp | Giữ thông báo và bộ lọc hiện có; không nới an toàn hoặc cooldown để lấp kết quả |
| Công thức thiếu nguyên liệu/cách nấu | Giữ hướng dẫn xem nguồn gốc; không tạo nội dung giả |
| Đặt món/thanh toán/giao hàng | Coming soon, không báo đã đặt hoặc thanh toán |

Component dùng chung `UserNotice` có mức info/success/warning/error, ký hiệu và nội dung văn bản; không dùng màu làm dấu hiệu duy nhất. Thông báo thành công có thể đóng, không tự biến mất; cảnh báo theo dữ liệu được giữ tại màn hình liên quan. Error dùng `role=alert`, trạng thái dùng `role=status`; layout có kiểm tra desktop/mobile.

Thông báo trong app đã gắn vào các luồng hiện có. Email xác minh tài khoản/đặt lại mật khẩu đã có adapter Resend, outbox mã hóa, lease/retry và giao diện; gửi email thật còn chờ cấu hình/domain và nghiệm thu. Chưa có push/SMS, hộp thư thông báo lưu server, nhắc bữa ăn theo lịch hoặc nhắc đơn hàng.

Checkpoint 07/10/2026: 78/86 mục, còn tám điều kiện supplier/provider/staging live. Các trạng thái thông báo cho chat, feedback/report, admin content, account/privacy và menu sync đã gắn frontend/backend. Sync chỉ báo đã xếp hàng khi enqueue thành công; retry không khẳng định menu đã cập nhật; revision lỗi giữ bản nhập và yêu cầu tải lại rõ ràng. Xem [runbook](RELEASE_RUNBOOK.md) và checklist OpenSpec để phân biệt code-ready/live-ready.

## Kiểm tra hiện tại

71 unit, 132 database và 112 browser desktop/mobile đạt trong đợt hoàn thiện gần nhất; 31 migrations chạy từ database mới. Các số đo bên dưới là lịch sử của đợt thông báo đầu tiên, không phải tổng hiện tại.

## Kiểm tra đợt bổ sung ban đầu

- Production frontend build và Prettier các file thay đổi: pass.
- Đã xem ảnh chụp màn hình review/cảnh báo ở mobile 390 px; không tràn ngang, thông tin và nút xác nhận hiển thị theo luồng dọc.
- Playwright desktop/mobile: suite hiện có + thông báo 34/34; ca bổ sung refresh/login 6/6 chạy riêng, tổng 40 ca. Các ca kiểm tra giữ cảnh báo ngoại tuyến qua điều hướng, reconnect/đóng thông báo, hết phiên, giữ nội dung khi lưu lỗi mạng, AI quota, không lộ lỗi nội bộ và refresh token bị backend từ chối.
- Lượt đầu của test reconnect dùng mock sai đường dẫn history nên gửi token test tới backend thật; đã sửa và chạy lại suite 34/34. Lượt đầu của ca login mobile bị Chrome ERR_NETWORK_CHANGED khi tải JS; lượt chạy riêng một worker sau đó đạt 6/6. Các lượt lỗi không được tính là nghiệm thu thành công.
- Không thay backend/database trong đợt này; kết quả 43 unit/63 database của đợt P0/P1 là lịch sử, không gọi là kết quả chạy mới của đợt thông báo.
