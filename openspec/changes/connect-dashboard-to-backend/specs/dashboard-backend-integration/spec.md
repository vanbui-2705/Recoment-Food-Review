## Purpose

Biến dashboard hiện tại thành client sử dụng backend thật trong khi bảo toàn thiết kế đã chốt và buộc mọi thay đổi giao diện hoặc semantics chưa tương thích phải được người dùng phê duyệt trước.

## ADDED Requirements

### Requirement: Complete all supported user workflows
Hệ thống SHALL cung cấp luồng chạy thật cho xác thực và phiên đăng nhập, khám phá món ăn, tương tác recommendation, địa điểm gần đây, chat streaming, hồ sơ khẩu vị, account và lịch sử tương tác bằng các backend contract hiện có.

#### Scenario: User completes a supported workflow
- **WHEN** người dùng thực hiện một luồng mà backend đã có đầy đủ contract
- **THEN** frontend SHALL đọc và ghi dữ liệu thật từ đầu đến cuối, không dùng timeout, fixture hoặc trạng thái thành công giả

### Requirement: Add missing product domains explicitly
Hệ thống MUST triển khai order, payment, delivery và live dispatcher dưới dạng backend domain riêng trước khi công bố các control tương ứng là hoạt động.

#### Scenario: A commerce control is selected before its backend exists
- **WHEN** người dùng chọn một control thuộc order, payment, delivery hoặc live dispatcher nhưng domain backend tương ứng chưa được duyệt và triển khai
- **THEN** hệ thống MUST NOT giả lập thành công hoặc ánh xạ control sang chat/history và SHALL giữ hạng mục tại checkpoint phê duyệt

### Requirement: Require approval for visible restructuring
Hệ thống SHALL yêu cầu phê duyệt trước khi thêm auth screen, đổi semantics History, thêm vùng loading/error/empty mới, yêu cầu GPS trình duyệt hoặc thay đổi presentation cho account và commerce.

#### Scenario: A real workflow cannot fit the current presentation
- **WHEN** một workflow thật cần thêm hoặc thay đổi nội dung, control, navigation hay layout
- **THEN** implementation SHALL cung cấp phạm vi file và đối chiếu trước-sau rồi dừng trước khi chỉnh presentation

### Requirement: Preserve the approved presentation
Hệ thống SHALL giữ nguyên cấu trúc trình bày hiện tại khi nối API, bao gồm DOM phục vụ layout, class styling, asset, kích thước, khoảng cách, màu sắc, typography, breakpoint responsive và vị trí điều hướng. Nội dung dữ liệu động được phép thay đổi theo backend nhưng không được tự ý thay đổi cách trình bày.

#### Scenario: API data replaces mock data without layout drift
- **WHEN** một màn hình được chuyển từ fixture sang response API với cùng loại dữ liệu
- **THEN** màn hình SHALL vượt qua visual regression trên viewport desktop và mobile đã chốt, không có horizontal overflow hoặc phần tử bị che khuất

#### Scenario: A proposed integration needs visible UI changes
- **WHEN** việc xử lý loading, error, empty state, authentication hoặc dữ liệu thiếu đòi hỏi thêm, xóa, đổi nhãn, đổi control, đổi điều hướng hoặc đổi layout
- **THEN** công việc SHALL dừng ở một checkpoint mô tả thay đổi và ảnh đối chiếu để người dùng duyệt trước khi sửa UI

### Requirement: Use live backend data for supported screens
Hệ thống SHALL lấy dữ liệu người dùng, hồ sơ khẩu vị, khám phá/gợi ý, quán gần đây, chat và lịch sử từ API backend hiện có thay vì dùng fixture hard-code khi hợp đồng API đáp ứng đúng semantics màn hình.

#### Scenario: Supported screen loads successfully
- **WHEN** người dùng đã xác thực mở một màn hình có API tương thích và backend trả về thành công
- **THEN** màn hình SHALL hiển thị dữ liệu từ response đã được chuyển thành view-model của giao diện hiện tại

#### Scenario: Backend returns no records
- **WHEN** API tương thích trả về tập dữ liệu rỗng nhưng UI hiện tại không có empty-state phù hợp
- **THEN** tích hợp SHALL không trình bày fixture như dữ liệu thật và SHALL chuyển trường hợp này sang checkpoint cần duyệt UI

### Requirement: Execute real user actions exactly once
Mỗi thao tác được đánh dấu là đã nối backend SHALL gửi request mutation đúng hợp đồng, sử dụng idempotency key khi API yêu cầu, chống gửi lặp và chỉ phản ánh thành công sau khi backend xác nhận.

#### Scenario: Mutation succeeds
- **WHEN** người dùng gửi chat, lưu hồ sơ hoặc thực hiện một thao tác có endpoint tương thích
- **THEN** frontend SHALL gửi đúng một request hợp lệ và chỉ cập nhật trạng thái thành công sau response thành công

#### Scenario: Mutation fails
- **WHEN** backend từ chối hoặc không hoàn tất mutation
- **THEN** frontend SHALL giữ dữ liệu chưa được xác nhận, không hiển thị false-success và cho phép retry an toàn theo khả năng của API

### Requirement: Keep API contracts outside presentation components
Hệ thống SHALL tập trung HTTP/session handling và chuyển đổi response thành view-model bên ngoài phần JSX trình bày, để component không phụ thuộc trực tiếp vào shape backend và việc nối API không yêu cầu thay đổi styling.

#### Scenario: Backend response maps to an existing card
- **WHEN** response chứa các trường tương đương với card hiện tại
- **THEN** adapter SHALL chuẩn hóa missing/nullable fields trước khi component render mà không chèn logic hợp đồng API vào markup trình bày

### Requirement: Handle authentication and API failure honestly
Hệ thống SHALL dùng token/refresh flow hiện có, không để trang hiển thị dữ liệu mock như dữ liệu cá nhân khi phiên không hợp lệ, và không diễn giải lỗi tải dữ liệu thành trạng thái rỗng hoặc thành công.

#### Scenario: Access token can be refreshed
- **WHEN** request nhận 401 và refresh token còn hợp lệ
- **THEN** client SHALL refresh một lần, lưu token xoay vòng và retry request ban đầu một lần

#### Scenario: No usable session and no approved auth screen
- **WHEN** không thể xác thực nhưng dashboard hiện tại chưa có giao diện đăng nhập được duyệt
- **THEN** implementation SHALL dừng tại checkpoint phê duyệt thay vì tự thêm màn hình, modal hoặc chuyển hướng mới

#### Scenario: Read request fails
- **WHEN** API trả lỗi hoặc mất kết nối
- **THEN** frontend SHALL không thay lỗi bằng fixture hoặc false-empty state và SHALL chỉ dùng vùng thông báo hiện có nếu việc đó không làm thay đổi layout đã chốt

### Requirement: Block unsupported or semantically incompatible features
Hệ thống MUST NOT gọi một chức năng là chạy thật nếu backend không có hợp đồng tương ứng hoặc nếu dữ liệu backend có semantics khác với nội dung UI, gồm đặt món, thanh toán, giao hàng, live order dispatcher và việc trình bày interaction history như order history.

#### Scenario: UI control has no backend contract
- **WHEN** audit xác định một control hiện tại không có endpoint hoặc domain model tương ứng
- **THEN** control SHALL được ghi nhận là blocked và mọi phương án đổi nhãn, vô hiệu hóa, ẩn hoặc xây backend mới SHALL cần người dùng phê duyệt

#### Scenario: API data has different meaning from UI
- **WHEN** response có thể lấp các trường hiển thị nhưng không đại diện cho cùng khái niệm nghiệp vụ
- **THEN** adapter MUST NOT ánh xạ sai và hạng mục SHALL chuyển sang checkpoint phê duyệt

### Requirement: Verify each integration slice before proceeding
Mỗi màn hình SHALL có contract test, functional browser test và visual comparison desktop/mobile chạy đạt trước khi được đánh dấu hoàn thành hoặc trước khi bắt đầu slice tiếp theo.

#### Scenario: A slice is ready to merge
- **WHEN** một màn hình đã được nối API
- **THEN** test SHALL chứng minh request thật được phát sinh, success/failure không bị giả lập, console không có lỗi, không có overflow và visual baseline không thay đổi ngoài vùng dữ liệu động được cho phép
