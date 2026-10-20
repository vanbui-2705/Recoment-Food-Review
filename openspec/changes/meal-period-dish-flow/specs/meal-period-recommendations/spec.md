## Purpose

Cho phép người dùng nhận danh sách món phù hợp với bữa hiện tại trước khi chọn món để tìm quán liên quan theo vị trí.

## ADDED Requirements

### Requirement: Recommendations respect the requested meal period
Hệ thống SHALL chấp nhận một `mealPeriod` hợp lệ khi lấy hoặc tạo gợi ý và SHALL chỉ trả món có thể dùng cho bữa đó khi món có khai báo bữa ăn.

#### Scenario: Current local time maps to a meal period
- **WHEN** frontend tải màn hình chính vào buổi sáng, trưa hoặc tối theo giờ địa phương
- **THEN** frontend SHALL gửi lần lượt `BREAKFAST`, `LUNCH` hoặc `DINNER` trong request gợi ý

#### Scenario: Dish has explicit meal periods
- **WHEN** một món khai báo danh sách `mealPeriods` không chứa bữa được yêu cầu
- **THEN** hệ thống MUST loại món đó khỏi danh sách gợi ý

### Requirement: Main discovery screen presents dishes before restaurants
Màn hình chính SHALL hiển thị danh sách món gợi ý và MUST NOT hiển thị danh sách quán độc lập trước khi người dùng chọn món.

#### Scenario: User opens the main screen
- **WHEN** dữ liệu gợi ý tải thành công
- **THEN** người dùng SHALL thấy danh sách món có tên, ảnh khi nguồn cung cấp ảnh và lý do phù hợp, nhưng chưa thấy danh sách quán

#### Scenario: User selects a dish
- **WHEN** người dùng bấm vào một món
- **THEN** frontend SHALL tìm quán liên quan bằng GPS hoặc tọa độ hồ sơ trong bán kính cho phép và hiển thị kết quả ở bước tiếp theo

### Requirement: Cooldown starts only after final confirmation
Hệ thống MUST chỉ ghi `CHOSEN` sau khi người dùng đã chọn quán và xác nhận món.

#### Scenario: User backs out before confirmation
- **WHEN** người dùng đóng hoặc quay lại khỏi danh sách quán mà chưa xác nhận
- **THEN** hệ thống MUST NOT tạo interaction `CHOSEN` và món MUST NOT vào cooldown 96 giờ

#### Scenario: User confirms a restaurant and dish
- **WHEN** người dùng chọn một quán rồi bấm xác nhận cuối cùng
- **THEN** hệ thống SHALL tạo đúng một interaction `CHOSEN` và áp dụng cooldown 96 giờ

### Requirement: Personalization claims match stored profile data
Hệ thống SHALL cá nhân hóa bằng khẩu vị, dị ứng, chế độ ăn, ngân sách và lịch sử đã lưu, và MUST NOT tuyên bố dùng chỉ số cơ thể chưa được thu thập.

#### Scenario: Body metrics are unavailable
- **WHEN** hồ sơ chưa có tuổi, giới tính, chiều cao, cân nặng, mức vận động hoặc mục tiêu sức khỏe
- **THEN** giao diện MUST NOT hiển thị tuyên bố rằng gợi ý đã được tính theo các chỉ số đó
