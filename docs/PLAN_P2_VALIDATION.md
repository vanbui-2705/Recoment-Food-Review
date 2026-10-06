# P2: thực đơn có nguồn, bằng chứng và chi tiết quán

Ngày kiểm chứng: 06/10/2026. Không coi nguồn Places là API thực đơn hoặc suy ra giá món từ mức giá của quán.

Đã triển khai:

- Danh tính nhà cung cấp/quán/món riêng biệt; nhiều lựa chọn kích cỡ cho cùng món chuẩn. Món không rõ liên kết vào trạng thái chờ duyệt.
- Dry-run, cách ly dòng lỗi, staging nhiều trang, commit nguyên tử, replay snapshot và trang theo nội dung. COMPLETE chỉ ngừng bán món vắng mặt sau commit thành công; DELTA giữ món không có trong bản cập nhật.
- Nguồn được cấp quyền, URL HTTPS không chứa credential, VND integer, giới hạn TTL, expiry và availability. Dữ liệu hết hạn không được hiển thị là giá đã xác minh.
- Bằng chứng riêng từng offer: dị ứng, chế độ ăn, lây nhiễm chéo; pending/approved/revoked, lịch sử duyệt và kiểm tra xung đột. Thiếu bằng chứng không được hiểu là không có dị ứng.
- ADMIN APIs và giao diện đăng ký/tắt nguồn, nhập snapshot, xem trước/commit/thử lại, mapping và xét duyệt. Audit ghi cùng transaction, metadata hạn chế và trigger chống sửa audit.
- Trang quán có menu phân trang, nguồn/thời hạn, đánh dấu ngân sách, Maps/liên hệ, ghi nhận chọn món và tìm cách nấu. Chi tiết Places của Google/Goong/Foursquare/Geoapify gọi trên backend; ảnh/đánh giá thuộc quán, không thuộc từng món.
- Loading, empty/no-menu, quyền truy cập, retry, lỗi commit, giá hết hạn và cảnh báo chưa đủ thông tin được hiển thị rõ; không báo thành công khi API thất bại.

Kiểm chứng trong đợt này:

- Backend typecheck, lint: qua.
- Unit: 50 kiểm thử qua, bao gồm contract provider, URL/credential và safety policy.
- PostgreSQL: 72 kiểm thử qua, bao gồm 9 kiểm thử mới về transaction/import/evidence/audit.
- Browser mới: 10 kiểm thử qua trên desktop/mobile; refresh chi tiết quán, no-menu/retry, nhập snapshot thất bại rồi thử lại, quyền quản trị, mapping và xét duyệt.
- Frontend production build: qua.
- Toàn bộ browser regression: 50 kiểm thử qua trên bản build production. Lần chạy Vite trước đó có 49/50 qua; trace ca lỗi ghi `ERR_NETWORK_CHANGED` khi tải JS. Chế độ preview production đã thêm vào CI để kiểm chứng đúng bundle phát hành.
- Docker production images backend/frontend: build qua (`rec-food-backend:plan-p2`, `rec-food-frontend:plan-p2`).
- Migration-from-empty: 12 migration áp dụng được vào schema độc lập rồi dọn đúng schema kiểm thử.

Giới hạn chưa nghiệm thu:

- Chưa có hợp đồng/tài liệu/credential của nguồn merchant; chưa viết adapter tùy ý và chưa chạy live ingest/scheduler. Form nhập snapshot dành cho vận hành nguồn đã cấp quyền, không thay thế kết nối API tự động.
- Không đưa dữ liệu giả vào màn hình production. Nguồn Places thiếu thực đơn hiện cảnh báo và đường liên hệ quán.
- Pipeline gợi ý P3, chat P4, quản trị/tài khoản/vận hành P5–P6 đang là việc tiếp theo. Giao diện chi tiết đã có safety validator; chưa đánh dấu hard filter toàn bộ hệ thống hoàn tất trước khi P3 dùng cùng policy.
- Các kiểm thử fake provider không chứng minh provider live-ready. Cart/order/payment/delivery tiếp tục Coming soon.
