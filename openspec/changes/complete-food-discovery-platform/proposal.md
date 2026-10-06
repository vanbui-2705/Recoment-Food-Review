## Why

Rec-Food đã có discovery, công thức nấu và lịch sử 96 giờ, nhưng mô tả khẩu vị chưa được AI phân tích và chưa có pipeline thực đơn thật để gợi ý món tại quán theo ngân sách. Cần hoàn thiện phần khám phá và quản trị thành một sản phẩm vận hành được; giỏ hàng/đơn hàng (nhóm 9) và thanh toán/giao hàng (nhóm 10) giữ Coming soon theo quyết định ngày 06/10/2026.

## What Changes

- AI trích xuất mô tả khẩu vị, giữ revision và yêu cầu xác nhận ràng buộc an toàn chưa rõ.
- Đồng bộ thực đơn từ nguồn được phép, có giá/ảnh/thời hạn và bằng chứng thành phần theo quán.
- Tự tải gợi ý gần vị trí, ranking cá nhân hóa, LLM giải thích có căn cứ và fallback deterministic.
- Trang chi tiết quán, chat nhiều lượt/streaming chỉ dùng công cụ khám phá.
- Feedback, báo cáo dữ liệu sai, quản lý lịch sử và dữ liệu cá nhân.
- Admin UI, xử lý báo cáo, kiểm duyệt và audit; tài khoản/email; CI, quan sát, backup và triển khai.
- UI ghi Coming soon cho đặt món/thanh toán/giao hàng; không tạo API giao dịch hoặc công cụ đặt đơn trong đợt này.

## Capabilities

### New Capabilities

- `personal-taste-analysis`: phân tích mô tả tự do và áp dụng hồ sơ có kiểm soát.
- `merchant-menu-evidence`: đồng bộ menu và bằng chứng an toàn theo quán, nguồn và thời hạn.
- `personalized-discovery`: gợi ý tự tải, ranking, LLM và lịch sử request.
- `discovery-assistant`: hội thoại có streaming, tool discovery và giới hạn Coming soon.
- `restaurant-details`: chi tiết quán và menu có nguồn.
- `user-feedback-controls`: feedback, báo cáo, quản lý lịch sử và ưu tiên riêng tư.
- `admin-content-workflows`: quản trị, xác minh, khóa tài khoản và audit.
- `account-self-service`: cài đặt tài khoản, xác minh/reset mật khẩu và dữ liệu cá nhân.
- `production-readiness`: CI đầy đủ, metrics, secrets, backup và release gates.

### Modified Capabilities

Không sửa hợp đồng các spec nền tảng trong đề xuất này. Các capability mới sử dụng auth/profile/catalog/history hiện có; khi migration thay đổi bất biến đã có phải bổ sung delta tương ứng trước triển khai.

## Impact

Backend Fastify/Prisma/PostgreSQL và frontend React hiện có được mở rộng theo module; không viết lại discovery hoặc auth đã chạy. Cần migration cho job phân tích, external identity/menu evidence, chat, feedback/report, audit và token email. Các route đề xuất, thứ tự PR, test và release gates được mô tả trong design/tasks và docs/REC_FOOD_COMPLETION_PLAN.md. LLM, email và merchant supplier là phụ thuộc bên ngoài: chuẩn bị adapter/config/test fake nhưng không đánh dấu tích hợp live hoàn thành khi thiếu credentials hoặc hợp đồng dữ liệu.
