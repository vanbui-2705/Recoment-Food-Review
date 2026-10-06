# Nhật ký riêng tư và xóa có xác nhận

06/10/2026; checkpoint 41/86 mục. Tiếp tục triển khai các mục còn lại.

API `/users/me/history` gộp món tại quán và món nấu, phân trang cursor theo thời điểm/nguồn/ID, lọc nguồn và CHOSEN/EATEN. Không thay đổi API lịch sử cũ.

Xóa yêu cầu đọc preview, xác nhận rõ và version hash. Preview xét các lần chọn/ăn liên quan trong 96 giờ, gồm tên chuẩn/alias công thức. Transaction serializable kiểm tra lại để từ chối preview cũ khi nhật ký đổi. Dị ứng/chế độ ăn không bị sửa. Truy cập bản ghi tài khoản khác trả 404.

UI có loading, empty theo bộ lọc, retry giữ dữ liệu, phân trang, dialog bàn phím với focus và cảnh báo không hoàn tác. Thông báo thành công chỉ sau DELETE thành công; thất bại giữ dialog/bản ghi. Xóa làm vô hiệu pool vòng quay đang giữ để tìm lại.

Phản hồi EATEN thuộc kết quả của tài khoản được ghi nhận như lịch sử, kể cả thực đơn hiện tại đổi; CHOSEN vẫn kiểm tra nguồn/safety/freshness/giá trong ngân sách của lượt tìm trước khi lưu.

Kiểm chứng: typecheck/lint qua; 8/8 PostgreSQL cho history/recommendation qua, gồm replay/owner/preview stale và CHOSEN vượt ngân sách vs EATEN quá khứ. Browser mới 4/4 qua desktop/mobile, có retry DELETE thất bại, cảnh báo cooldown và phân trang/lọc. Frontend build production qua. Đợt này không chạy lại toàn bộ browser hoặc Docker; checkpoint trước ghi riêng ở PLAN_P3_VALIDATION.md.
