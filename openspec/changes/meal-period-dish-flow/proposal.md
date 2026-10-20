## Why

Màn hình chính hiện trộn món và quán, đồng thời chưa xác định bữa ăn theo thời gian hiện tại. Người dùng cần nhìn thấy danh sách món phù hợp cho buổi sáng, trưa hoặc tối trước; quán chỉ xuất hiện sau khi họ chọn một món.

## What Changes

- Xác định `mealPeriod` theo giờ địa phương của người dùng và truyền vào API gợi ý.
- Lọc/ranking món theo bữa, đồng thời tiếp tục áp dụng khẩu vị, dị ứng, chế độ ăn, ngân sách và cooldown 96 giờ hiện có.
- Màn hình chính chỉ render danh sách món gợi ý có ảnh; không render danh sách quán độc lập.
- Khi bấm một món, frontend mới tìm và hiển thị quán liên quan theo GPS/bán kính.
- Chỉ ghi `CHOSEN` sau khi chọn quán và xác nhận; đóng hoặc quay lại không kích hoạt cooldown.
- Không tuyên bố cá nhân hóa theo chỉ số cơ thể khi hệ thống chưa lưu tuổi, giới tính, chiều cao, cân nặng, mức vận động hoặc mục tiêu sức khỏe.

## Capabilities

### New Capabilities

- `meal-period-recommendations`: Gợi ý món theo bữa hiện tại và luồng món-trước, quán-sau.

### Modified Capabilities


## Impact

- Backend recommendation/food route, schema và service nhận `mealPeriod` có kiểm soát.
- Frontend dashboard API, adapter, DiscoveryPage và Playwright tests.
- Không thêm dependency, không đổi cơ sở dữ liệu, không thay đổi cấu trúc navigation hay hệ màu/layout đã duyệt.
