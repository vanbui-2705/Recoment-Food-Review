# Phản hồi, tài khoản và quản trị phiên đăng nhập

07/10/2026 — checkpoint 57/86 mục. Đợt này hoàn tất 9.1, 9.2, 9.5, 9.6, 10.3, 11.1 và 12.3. Các mục email, xuất/xóa tài khoản, quản trị toàn bộ nội dung, đồng bộ merchant theo lịch và vận hành còn tiếp tục; không coi 86 mục đã hoàn tất.

## Hành vi và dữ liệu

Đánh giá 1–5 sao, thích và bỏ qua gắn với kết quả gợi ý hoặc bản ghi món/công thức thuộc tài khoản. API xác thực loại phản hồi/rating, idempotency và quyền sở hữu. UI giữ dữ liệu và cùng mã thao tác khi thử lại. Đánh giá app được ghi nhãn riêng với điểm đánh giá quán của Google.

Phản hồi chỉ điều chỉnh tối đa 3 điểm trong thang 100, dùng phản hồi gần nhất theo loại, không cộng dồn do gửi lặp và không thay đổi dị ứng/diet. Bộ lọc cứng chạy trước. CHOSEN/EATEN mới tạo cooldown 96 giờ; rating/thích/bỏ qua không kéo dài cooldown. Recipe có canonicalDishId để việc đổi tên không làm mất liên kết; tên/alias mơ hồ không gộp tùy ý. API lịch sử công thức cũ vẫn chỉ trả CHOSEN/EATEN.

Xóa lịch sử có preview số phản hồi liên quan và hash chống trạng thái cũ; xác nhận xóa bản ghi sẽ xóa phản hồi con cùng transaction. Không xóa lịch sử hoặc phản hồi của tài khoản khác.

Các migration additive 18–20 thêm liên kết phản hồi, canonical recipe, rating constraint và mở rộng loại phản hồi. Migration 21 thêm phiên thiết bị/family và phiên bản xác thực; backfill giữ family xuyên chuỗi refresh cũ. Migration 22 thêm cờ thu hồi access token chưa có claim thiết bị. Các migration đã áp dụng không bị sửa.

## Tài khoản và quản trị

Người dùng đổi tên, đổi mật khẩu, xem tối đa 50 phiên gần nhất, thu hồi thiết bị hoặc đăng xuất tất cả. Đổi mật khẩu CAS theo password hash và tăng authVersion, thu hồi mọi refresh/access token. Thu hồi một family không đăng xuất các thiết bị hiện đại khác; token legacy không nhận diện thiết bị bị vô hiệu hóa. Refresh/đăng xuất đồng thời không hồi sinh phiên. API danh sách không trả hash, token hoặc IP; có no-store.

UI có lỗi/thử lại, kiểm tra mật khẩu xác nhận, giữ input khi thất bại, autocomplete phù hợp và dialog xác nhận thu hồi; chỉ xóa phiên local sau thành công. Khóa/mở lại tài khoản có tìm kiếm/phân trang, CAS timestamp, enum lý do có giới hạn và audit transaction. Mở khóa yêu cầu đăng nhập mới. Global advisory lock và serializable retry bảo vệ việc kiểm tra quản trị viên hoạt động cuối cùng. Bộ kiểm thử gồm boundary last-admin, race moderation và access/refresh sau khóa/mở lại. UI quản trị có danh sách người dùng và audit; các views nội dung khác chưa hoàn chỉnh.

## Vận hành và kiểm chứng

GET /health là liveness; GET /ready kiểm tra database với deadline 3 giây, query/transaction giới hạn và trả 503 khi không sẵn sàng. GET /admin/metrics yêu cầu ADMIN, trả Prometheus counters/histogram gợi ý, số job theo loại/trạng thái và quota request AI hôm nay; không có user ID, mô tả khẩu vị hoặc khóa provider. Metrics counter là theo process, số job/quota lấy từ database. Chi phí tiền, provider quota đa replica và dashboard/alert còn chưa hoàn tất.

Request serializer bỏ query string, headers và body; error serializer chỉ giữ loại/code kiểm soát, không ghi message/stack/query args nội bộ. Không coi đây là kiểm chứng toàn bộ log của worker/provider ngoài phạm vi request/startup hiện tại.

Đã qua toàn bộ frontend production browser 84/84 desktop/mobile; backend build, lint và unit 62/62; PostgreSQL toàn bộ 103/103. Một lần chạy trước gặp quota thật tích lũy làm fake model không chạy ca revision CAS; đã cấu hình quota riêng cho injected fake model trong test, không reset quota database hoặc sửa giới hạn production. Browser fixture thông báo offline và admin được cập nhật theo endpoint hiện tại; không che lỗi 401 trong ứng dụng.

Trước migration legacy 22: migration-from-empty 21 migration và Docker backend/frontend `plan-account` đã qua. Sau bổ sung legacy: kiểm tra auth/account/admin/operations và migration-from-empty được chạy lại; kết quả cuối đợt ghi tiếp dưới đây. Không coi kiểm thử provider giả là live smoke. Email/key merchant/model và môi trường phát hành thật vẫn cần cấu hình/quyền truy cập thật.

Kết quả sau migration 22: typecheck/lint và unit 62/62 qua; auth/account/admin/operations PostgreSQL 11/11 qua, gồm token legacy bị thu hồi mà thiết bị hiện đại khác vẫn hoạt động; migration-from-empty 22 migration qua; Docker backend `plan-account` được build lại thành công. Frontend không đổi sau lần 84/84 và image frontend đã kiểm chứng. Chưa chạy lại toàn bộ 103 database sau cờ legacy; đợt này dùng regression tập trung cho phần vừa thay đổi.
