## Purpose

Cung cấp nền tảng dữ liệu có version cho tài khoản và phiên đăng nhập, bảo đảm thông tin xác thực không được lưu dưới dạng bí mật thô.

## ADDED Requirements

### Requirement: Versioned authentication schema
Hệ thống SHALL quản lý schema tài khoản và refresh token bằng các migration được lưu cùng source code.

#### Scenario: Khởi tạo database mới
- **WHEN** toàn bộ migration đã commit được áp dụng lên một PostgreSQL database rỗng
- **THEN** hệ thống tạo đủ schema authentication mà không cần chỉnh sửa SQL thủ công

### Requirement: Unique user identity
Hệ thống MUST lưu mỗi địa chỉ email chuẩn hóa cho tối đa một tài khoản.

#### Scenario: Email bị trùng
- **WHEN** hai tài khoản được lưu với cùng một email chuẩn hóa
- **THEN** database từ chối tài khoản thứ hai bằng unique constraint

### Requirement: Protected authentication secrets
Hệ thống MUST chỉ lưu password hash và refresh token hash, không lưu password hoặc refresh token dạng plain text.

#### Scenario: Lưu thông tin xác thực
- **WHEN** tài khoản hoặc refresh token được ghi vào database
- **THEN** bản ghi chỉ chứa giá trị hash tương ứng

### Requirement: Refresh token ownership lifecycle
Mỗi refresh token SHALL thuộc về đúng một user và SHALL bị xóa khi user đó bị xóa.

#### Scenario: Xóa tài khoản
- **WHEN** một user có refresh token bị xóa
- **THEN** database tự động xóa toàn bộ refresh token thuộc user đó

### Requirement: Idempotent development seed
Development seed SHALL có thể chạy lặp lại mà không tạo nhiều tài khoản quản trị trùng email.

#### Scenario: Chạy seed hai lần
- **WHEN** seed được chạy hai lần với cùng email quản trị
- **THEN** database chỉ có một tài khoản tương ứng với email đó
