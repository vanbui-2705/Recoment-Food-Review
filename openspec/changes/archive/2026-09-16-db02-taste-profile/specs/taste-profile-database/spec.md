## Purpose

Lưu hồ sơ khẩu vị và giới hạn thực tế của mỗi người dùng làm đầu vào có cấu trúc cho quá trình lọc và xếp hạng món ăn.

## ADDED Requirements

### Requirement: One taste profile per user
Hệ thống SHALL cho phép mỗi user có tối đa một taste profile và SHALL xóa profile khi user bị xóa.

#### Scenario: Tạo profile thứ hai
- **WHEN** một profile mới được lưu cho user đã có taste profile
- **THEN** database từ chối bản ghi mới bằng unique constraint

#### Scenario: Xóa user có profile
- **WHEN** một user có taste profile bị xóa
- **THEN** taste profile tương ứng cũng bị xóa

### Requirement: Valid flavor scores
Hệ thống MUST chỉ chấp nhận các điểm cay, ngọt, chua và mặn trong khoảng từ 0 đến 100, bao gồm hai đầu mút.

#### Scenario: Điểm vị giác ngoài miền hợp lệ
- **WHEN** một taste profile chứa bất kỳ điểm vị giác nào nhỏ hơn 0 hoặc lớn hơn 100
- **THEN** database từ chối bản ghi

### Requirement: Valid budget range
Hệ thống MUST yêu cầu ngân sách tối thiểu và tối đa không âm, đồng thời ngân sách tối đa không nhỏ hơn ngân sách tối thiểu.

#### Scenario: Khoảng ngân sách đảo ngược
- **WHEN** budget tối đa nhỏ hơn budget tối thiểu
- **THEN** database từ chối bản ghi

### Requirement: Valid maximum distance
Hệ thống MUST chỉ chấp nhận khoảng cách tối đa lớn hơn 0 mét.

#### Scenario: Khoảng cách không dương
- **WHEN** max distance bằng 0 hoặc là số âm
- **THEN** database từ chối bản ghi

