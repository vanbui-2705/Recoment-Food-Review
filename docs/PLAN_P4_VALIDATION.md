# P4: chat tìm món có lịch sử riêng tư

Ngày kiểm chứng: 07/10/2026. Checkpoint 48/86 mục.

Đã xây:

- Conversation/message/run/event lưu theo tài khoản, cascade khi xóa; index chủ sở hữu, idempotency và partial unique index chỉ cho một lượt active mỗi conversation.
- API tạo/list/detail/xóa có xác nhận, gửi tin nhắn, events, stream và cancel kiểm tra chủ sở hữu; không nhận user ID từ model. Tin nhắn tối đa 4.000 ký tự, context có schema và cặp tọa độ bắt buộc.
- Context ngân sách/vị trí/radius được giữ qua lượt, nhận từ trường UI hoặc dữ liệu đã lưu. Thiếu ngân sách/vị trí thì hỏi lại, không đoán tọa độ từ lời nhắn. Revision mô tả được kiểm tra trước khi gọi công cụ.
- Planner structured có tối đa năm tool allowlisted: gợi ý offer, tìm quán, công thức, trạng thái khẩu vị. Tool dùng user ID của backend. Chặn tool lạ, args thừa/user ID, query trống, tool trùng và free-text claim về giá/an toàn.
- PostgreSQL worker claim SKIP LOCKED, lease 120 giây, attempts có giới hạn, crash recovery, deadline mặc định 90 giây. Có watchdog cả khi provider không trả lời; HTTP tool được hủy theo deadline. Context model có giới hạn byte; request quota dùng chung với phân tích/ranking.
- SSE yêu cầu bearer qua authenticated fetch, seq/cursor kết nối lại và heartbeat; không đặt token vào URL. Cancel/xóa ngăn ghi assistant output muộn. Event chỉ lưu reference ID/status và câu trả lời template, không lưu nội dung Places.
- UI có lịch sử, nhiều lượt, ngân sách, lấy vị trí sau thao tác người dùng, giữ nội dung khi gửi lỗi, kết nối lại không gửi trùng, thông báo empty/no-safe-match/pending/provider unavailable, link quán/công thức và quay lại giữ chat. Xóa yêu cầu dialog rõ và giữ dữ liệu khi API thất bại.
- Order/cart/payment/delivery không có tool hay API giao dịch; phản hồi Coming soon.
- Sửa transaction retry nhận cả lỗi serialization tại COMMIT từ Prisma PostgreSQL adapter, giới hạn ba lần; lỗi driver khác không bị thử lại tùy ý.

Kiểm chứng:

- Backend typecheck/lint qua; unit toàn bộ 59/59 qua và 4 kiểm thử policy/retry chạy lại qua sau chỉnh policy cuối.
- PostgreSQL toàn bộ 88/88 qua (15 file); chat 6/6 gồm owner/replay/double submit/seq/cancel/lease recovery/invalid tool/deadline và provider thiếu key.
- Frontend build qua; browser toàn bộ 68/68 qua desktop/mobile trên production preview, một worker. Bốn ca chat kiểm chứng reconnect/context/result navigation và xóa lỗi rồi retry.
- Migration-from-empty: 16 migration qua, schema độc lập đã dọn; local đã áp dụng migration mới.
- Docker production images `rec-food-backend:plan-p4` và `rec-food-frontend:plan-p4` đều build qua.

Giới hạn: chưa có Gemini key nên chưa chạy live chat/model; task 8.8 còn giữ chưa nghiệm thu live. Chưa có giới hạn chi phí tiền tệ; P6 sẽ bổ sung. Worker local hiện chưa bật vì thiếu key; giao diện báo chưa kết nối AI. Merchant adapter live vẫn cần contract/credential. Đây là checkpoint triển khai, không phải tuyên bố toàn bộ 86 mục hoàn tất.
