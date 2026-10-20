## Context

Xem `proposal.md` phần Why. Backend đã có enum `MealPeriod` và mỗi món có `mealPeriods`, nhưng endpoint gợi ý hôm nay chưa nhận bữa theo giờ hiện tại. DiscoveryPage đang tải cả món và quán ngay khi mở, trong khi luồng mong muốn là món trước, quán sau.

## Goals / Non-Goals

**Goals:**

- Dùng giờ địa phương phía browser để chọn `BREAKFAST`, `LUNCH` hoặc `DINNER`.
- Giữ backend là nơi lọc món theo bữa và hồ sơ.
- Giữ card/layout hiện có, chỉ ngừng tải/render quán trước khi chọn món.
- Duy trì interaction `CHOSEN` ở nút xác nhận cuối cùng.

**Non-Goals:**

- Không thêm trường cơ thể hoặc tính calo/BMI trong change này.
- Không xác nhận quán thực sự bán món khi provider miễn phí không có menu.
- Không đổi navigation, hệ màu, typography hoặc responsive shell.

## Decisions

### Derive meal period in the client and validate it in the API

Client biết giờ địa phương của người dùng chính xác hơn server. Quy ước là 05:00–10:59 `BREAKFAST`, 11:00–15:59 `LUNCH`, còn lại `DINNER`. API chỉ nhận ba giá trị này và truyền vào food service. Không dùng timezone server vì có thể khác người dùng.

Alternative: lưu đè `profile.mealPeriod` mỗi lần mở trang. Loại bỏ vì gây mutation ngầm và làm hồ sơ thay đổi ngoài ý muốn.

### Filter catalog dishes on the backend

Food service nhận meal-period override cho request hiện tại và dùng cùng rule an toàn/khẩu vị/cooldown hiện có. Adapter giữ `mealPeriods` để test và hiển thị dữ liệu trung thực.

Alternative: lọc chỉ ở frontend. Loại bỏ vì recipe/dish payload không phải lúc nào cũng đủ dữ liệu và có thể hiển thị món không phù hợp trước khi lọc.

### Defer restaurant loading until dish selection

DiscoveryPage không gọi nearby-food khi tải trang. `searchRestaurants` chỉ chạy trong handler click card, dùng GPS trước rồi tọa độ hồ sơ, với bán kính 3–4 km hiện có.

## Risks / Trade-offs

- [TheMealDB không gắn meal period] → Xếp recipe sau catalog dish đã cá nhân hóa và không tuyên bố recipe được xác minh dinh dưỡng theo bữa.
- [Danh mục có ít món được gắn meal period] → Món không khai báo bữa vẫn được phép như rule hiện hành; không tạo dữ liệu giả.
- [Không có chỉ số cơ thể] → Nội dung chỉ nói cá nhân hóa theo các trường hồ sơ thực tế; mở change riêng nếu bổ sung health profile.

## Migration Plan

Không cần migration database. Phát hành backend và frontend cùng lần, kiểm tra contract cũ khi không truyền `mealPeriod`, rồi smoke test qua cổng 8081. Rollback bằng image backend/frontend trước thay đổi.
