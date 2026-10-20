## Why

Dashboard React hiện tại hiển thị đầy đủ các màn hình sản phẩm nhưng phần lớn dữ liệu và thao tác vẫn là mock cục bộ, nên người dùng không thể sử dụng các API backend đã có. Cần nối lại frontend với backend mà giữ nguyên giao diện hiện tại, đồng thời tách riêng mọi trường hợp thiếu hợp đồng backend hoặc buộc phải thay đổi UI để người dùng duyệt trước.

## What Changes

- Mở rộng change từ việc chỉ nối các màn hình tương thích thành kế hoạch hoàn thiện toàn bộ luồng người dùng: auth/session, discovery, nearby/map, chat, taste profile, account và history/feedback.
- Với chức năng chưa có backend như order, payment, delivery và live dispatcher, lập phase backend riêng thay vì để control giả hoặc ánh xạ sai sang API khác.
- Giữ nguyên presentation shell cho các slice chỉ thay dữ liệu và hành vi. Mọi auth screen, thay đổi semantics của History, trạng thái lỗi/rỗng mới, GPS prompt hoặc commerce UI vẫn phải qua checkpoint duyệt trước khi chỉnh giao diện.

- Kết nối các màn hình hiện tại với API thật cho tài khoản, hồ sơ khẩu vị, khám phá/gợi ý, quán gần đây, chat và lịch sử ở những nơi hợp đồng backend đã tương thích.
- Thay dữ liệu hard-code bằng dữ liệu API nhưng giữ nguyên DOM, class Tailwind, kích thước, khoảng cách, typography, màu sắc, responsive breakpoints và cấu trúc điều hướng hiện tại.
- Bổ sung lớp chuyển đổi dữ liệu giữa response backend và view-model mà UI hiện tại cần, không để component tự suy diễn hợp đồng API.
- Thiết lập baseline ảnh chụp giao diện desktop/mobile và kiểm tra hồi quy để mọi thay đổi thuộc nhóm “không ảnh hưởng UI” phải chứng minh không làm vỡ layout trước khi được áp dụng.
- Chia công việc thành hai nhóm: nhóm được phép triển khai không đổi giao diện và nhóm bắt buộc dừng để người dùng duyệt khi cần thêm/bớt/đổi nội dung, control, trạng thái, điều hướng hoặc semantics hiển thị.
- Giữ ngoài phạm vi triển khai tự động các chức năng chưa có backend tương ứng như đặt món, thanh toán, giao hàng và live order dispatcher; không giả lập chúng thành chức năng thật và không đổi UI khi chưa được duyệt.
- Không khôi phục hàng loạt frontend cũ và không ghi đè các thay đổi giao diện hiện có.

## Capabilities

### New Capabilities

- `dashboard-backend-integration`: Quy định dashboard hiện tại phải dùng dữ liệu và thao tác backend thật, bảo toàn giao diện bằng visual regression, xử lý phiên/API nhất quán, và áp dụng cổng phê duyệt cho mọi thay đổi có ảnh hưởng nhìn thấy hoặc thiếu hợp đồng backend.

### Modified Capabilities

Không thay đổi yêu cầu của các capability nền tảng. Change này dùng các API auth, profile, discovery, chat và history hiện có; nếu audit phát hiện cần đổi hợp đồng backend thì phải tạo delta spec riêng và xin duyệt trước.

## Impact

- Phạm vi frontend mở rộng tới toàn bộ route và session flow; phạm vi backend chỉ mở rộng ở phase riêng cho những domain thực sự chưa tồn tại và không được thực hiện trước checkpoint duyệt.

- Frontend: `src/profileApi.js`, dashboard/pages hiện tại, các module adapter/hook mới và Playwright tests. Các file CSS, className, asset và cấu trúc layout được coi là vùng đóng băng.
- Backend: mặc định không sửa. Chỉ được đề xuất thay đổi sau khi chứng minh API hiện tại không đáp ứng và nhận phê duyệt riêng.
- Runtime: frontend tiếp tục gọi `/api` qua Nginx trong Docker; không đưa secret hoặc gọi provider trực tiếp từ browser.
- Dữ liệu: nội dung mock sẽ được thay bằng dữ liệu thật theo từng màn hình; các khác biệt semantics như “đơn hàng” so với “lịch sử tương tác” không được ánh xạ sai chỉ để lấp UI.
- Quy trình: mỗi phase phải có contract test, functional E2E và visual comparison desktop/mobile trước khi tiếp tục.
