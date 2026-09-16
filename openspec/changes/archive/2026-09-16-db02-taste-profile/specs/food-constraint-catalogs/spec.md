## Purpose

Chuẩn hóa dị ứng, chế độ ăn và nền ẩm thực để hệ thống có thể lưu các hard constraint và preference của người dùng một cách nhất quán.

## ADDED Requirements

### Requirement: Stable normalized catalogs
Hệ thống SHALL duy trì các danh mục allergen, dietary restriction và cuisine bằng mã duy nhất, ổn định.

#### Scenario: Trùng mã danh mục
- **WHEN** một danh mục nhận thêm bản ghi có code đã tồn tại trong cùng danh mục
- **THEN** database từ chối bản ghi mới

### Requirement: Allergy is a hard constraint
Mọi allergen được gắn với user MUST được xem là hard constraint bất kể severity hoặc notes.

#### Scenario: Lưu mức độ dị ứng
- **WHEN** một user allergy được lưu kèm severity
- **THEN** quan hệ dị ứng vẫn tồn tại như một hard constraint đầy đủ

### Requirement: Unique user catalog selections
Hệ thống MUST không cho phép một user gắn trùng cùng allergen, dietary restriction hoặc cuisine.

#### Scenario: Gắn allergen trùng
- **WHEN** cùng một allergen được gắn lần thứ hai cho cùng user
- **THEN** database từ chối quan hệ trùng

#### Scenario: Gắn chế độ ăn hoặc cuisine trùng
- **WHEN** cùng một dietary restriction hoặc cuisine được gắn lần thứ hai cho cùng user
- **THEN** database từ chối quan hệ trùng

### Requirement: Mandatory dietary restrictions
Mỗi dietary restriction của user SHALL lưu rõ nó là hard constraint bắt buộc hay preference mềm.

#### Scenario: Chế độ ăn bắt buộc
- **WHEN** một dietary restriction được lưu với `is_mandatory` bằng true
- **THEN** dữ liệu có thể được đọc như một hard constraint cho bước lọc sau này

### Requirement: Bounded cuisine preference
Cuisine preference score MUST nằm trong khoảng từ -100 đến 100, bao gồm hai đầu mút.

#### Scenario: Điểm cuisine ngoài miền hợp lệ
- **WHEN** preference score nhỏ hơn -100 hoặc lớn hơn 100
- **THEN** database từ chối bản ghi

### Requirement: Idempotent catalog seed
Seed danh mục SHALL có thể chạy lặp lại mà không tạo allergen, dietary restriction hoặc cuisine trùng code.

#### Scenario: Chạy catalog seed hai lần
- **WHEN** seed được chạy hai lần trên cùng database
- **THEN** số lượng bản ghi danh mục không tăng ở lần chạy thứ hai

