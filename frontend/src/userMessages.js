const messages = {
  MENU_SYNC_NOT_CONFIGURED:
    "Chưa kết nối nguồn thực đơn được cấp phép hoặc worker đồng bộ chưa được bật. Chưa có yêu cầu đồng bộ nào được tiếp nhận.",
  MENU_SYNC_CHANGED:
    "Trạng thái đồng bộ đã thay đổi. Tải lại và xem trạng thái mới trước khi xác nhận.",
  MENU_SYNC_PAUSED:
    "Nguồn hoặc lịch đồng bộ đang tạm ngừng. Thực đơn đã lưu vẫn giữ thời hạn xác minh ban đầu.",
  MENU_SYNC_NOT_FOUND: "Lượt đồng bộ không còn tồn tại. Hãy tải lại danh sách.",
  MENU_SYNC_SOURCE_BOUND:
    "Nguồn đã gắn với một adapter. Nguồn dữ liệu khác cần định danh riêng để tránh nhầm quán và món.",
  CONTENT_CHANGED:
    "Dữ liệu đã thay đổi ở phiên khác. Tải lại và xem trước khi xác nhận.",
  CONTENT_NOT_FOUND: "Dữ liệu không còn tồn tại. Hãy tải lại danh sách.",
  DISH_UNAVAILABLE:
    "Món đang tạm ngừng gợi ý. Hãy tải lại danh sách để chọn món khác.",
  CATALOG_CODE_EXISTS:
    "Mã danh mục đã tồn tại. Tìm trong danh sách trước khi tạo lại.",
  AI_BUDGET_EXCEEDED:
    "AI tạm thời chạm giới hạn ngân sách xử lý. Bạn vẫn có thể tìm món và quán; phần gợi ý dùng cách xếp hạng dự phòng.",
  RATE_LIMIT_UNAVAILABLE:
    "Chưa kiểm tra được giới hạn yêu cầu. Vui lòng thử lại khi kết nối hệ thống ổn định.",
  DELETION_JOB_CONFLICT:
    "Yêu cầu xóa đã thay đổi ở phiên khác. Tải lại trạng thái trước khi xử lý tiếp.",
  DELETION_JOB_NOT_FOUND:
    "Yêu cầu xóa đã được xử lý hoặc không còn tồn tại. Hãy tải lại danh sách.",
  ACCOUNT_REAUTH_REQUIRED:
    "Mật khẩu hiện tại chưa đúng. Nhập lại để xác nhận thao tác dữ liệu cá nhân.",
  ACCOUNT_DELETION_UNAVAILABLE:
    "Xử lý xóa dữ liệu tạm thời chưa sẵn sàng. Tài khoản của bạn chưa bị thay đổi; hãy thử lại sau hoặc liên hệ hỗ trợ.",
  ACCOUNT_DELETION_PENDING:
    "Tài khoản đang trong quy trình xóa dữ liệu và không thể mở lại.",
  EXPORT_TOO_LARGE:
    "Xuất dữ liệu vượt giới hạn phiên tải. Hãy liên hệ hỗ trợ để nhận dữ liệu đầy đủ.",
  EMAIL_NOT_CONFIGURED:
    "Dịch vụ email chưa được cấu hình. Chưa có email nào được gửi; bạn có thể thử lại sau khi dịch vụ được bật.",
  EMAIL_LINK_INVALID:
    "Liên kết đã hết hạn hoặc đã được dùng. Hãy yêu cầu liên kết mới và mở email mới nhất.",
  LAST_ACTIVE_ADMIN:
    "Không thể khóa quản trị viên đang hoạt động cuối cùng. Hãy giữ ít nhất một tài khoản quản trị hoạt động.",
  USER_STATUS_CHANGED:
    "Tài khoản đã thay đổi ở phiên khác. Tải lại trạng thái và kiểm tra trước khi xác nhận.",
  USER_NOT_FOUND: "Tài khoản không còn trong danh sách. Hãy tải lại dữ liệu.",
  ACCOUNT_CHANGED:
    "Tài khoản đã thay đổi. Hãy đăng nhập lại trước khi tiếp tục.",
  SESSION_NOT_FOUND:
    "Thiết bị không còn trong tài khoản của bạn. Hãy tải lại danh sách.",
  INVALID_DISPLAY_NAME:
    "Tên hiển thị cần ít nhất 2 ký tự sau khi bỏ khoảng trắng thừa.",
  REPORT_NOT_FOUND:
    "Báo cáo không còn trong danh sách. Hãy tải lại để kiểm tra.",
  REPORT_TARGET_NOT_FOUND:
    "Dữ liệu món không còn ở nguồn hiện tại. Hãy tải lại trước khi báo cáo.",
  REPORT_REVIEW_CONFLICT:
    "Báo cáo đã được xử lý ở phiên khác. Tải lại báo cáo để kiểm tra trước khi lưu.",
  REPORT_STATUS_CONFLICT:
    "Trạng thái báo cáo đã thay đổi hoặc thao tác không hợp lệ. Hãy tải lại báo cáo.",
  INVALID_REPORT_NOTE:
    "Hãy mô tả thông tin cần kiểm tra trước khi gửi báo cáo.",
  INVALID_REVIEW_REASON: "Hãy nhập lý do xử lý hoặc mở lại báo cáo.",
  CHAT_RUN_ACTIVE:
    "Có lượt tìm đang xử lý. Hãy chờ kết quả hoặc hủy lượt trước khi gửi tiếp.",
  CHAT_DEADLINE: "Lượt tìm món quá thời gian. Bạn có thể gửi lại câu hỏi.",
  CHAT_ATTEMPTS_EXHAUSTED:
    "Lượt tìm bị gián đoạn nhiều lần. Hãy gửi lại câu hỏi để bắt đầu lượt mới.",
  CHAT_UNAVAILABLE:
    "Chat tạm thời chưa trả lời được. Câu hỏi đã lưu; bạn có thể thử lại.",
  CHAT_STREAM_INTERRUPTED:
    "Kết nối kết quả bị gián đoạn. Bấm kết nối lại; không cần gửi lại câu hỏi.",
  CONVERSATION_NOT_FOUND:
    "Cuộc trò chuyện không còn trong tài khoản của bạn. Hãy tải lại danh sách.",
  HISTORY_CHANGED:
    "Nhật ký đã thay đổi. Kiểm tra lại thời gian chờ trước khi xác nhận xóa.",
  HISTORY_NOT_FOUND:
    "Bản ghi không còn trong nhật ký của bạn. Hãy tải lại danh sách.",
  INVALID_HISTORY_CURSOR:
    "Trang nhật ký không hợp lệ. Hãy tải lại danh sách từ đầu.",
  RECOMMENDATION_IN_PROGRESS:
    "Lượt gợi ý đang xử lý. Hãy chờ một chút rồi thử lại.",
  RECOMMENDATION_PROFILE_CHANGED:
    "Khẩu vị đã thay đổi trong lúc tìm món. Hãy tìm lại để dùng thông tin mới nhất.",
  OFFER_NO_LONGER_ELIGIBLE:
    "Món đã thay đổi, hết hạn dữ liệu hoặc chưa đủ bằng chứng cho ràng buộc ăn uống. Hãy tải lại gợi ý trước khi xác nhận.",
  WRITE_CONFLICT:
    "Dữ liệu đang được cập nhật. Thao tác chưa được xác nhận; hãy thử lại.",
  OFFER_CHANGED:
    "Thực đơn đã được cập nhật. Hãy tải lại dữ liệu rồi kiểm tra liên kết món chuẩn.",
  EVIDENCE_REVIEW_CONFLICT:
    "Bằng chứng đã được xét duyệt ở phiên khác hoặc đã bị thu hồi. Hãy tải lại trạng thái mới nhất.",
  SYNC_INCOMPLETE:
    "Snapshot chưa đủ trang. Hãy thử lại bằng đúng tệp ban đầu; thực đơn hiện tại vẫn được giữ.",
  SYNC_HAS_QUARANTINE:
    "Snapshot có dòng dữ liệu không hợp lệ. Kiểm tra kết quả xem trước và sửa tại nguồn trước khi áp dụng.",
  PLACES_NOT_CONFIGURED: "Tìm quán chưa được cấu hình",
  NETWORK_ERROR:
    "Không kết nối được. Kiểm tra mạng rồi thử lại; thao tác vừa rồi chưa được xác nhận thành công.",
  FOOD_KNOWLEDGE_CONFLICT:
    "Mô tả đã được thay đổi ở một phiên khác. Nội dung bạn đang nhập vẫn được giữ; hãy kiểm tra bản đã lưu trước khi lưu lại.",
  ANALYSIS_REVISION_CONFLICT:
    "Mô tả đã thay đổi. Hãy phân tích và xác nhận bản mới nhất.",
  ANALYSIS_NEEDS_CLARIFICATION:
    "Thông tin ăn uống chưa rõ. Hãy sửa mô tả trước khi xác nhận.",
  AI_NOT_CONFIGURED:
    "Phân tích khẩu vị chưa được kết nối. Mô tả vẫn được lưu; bạn có thể tìm món và quán quanh đây.",
  AI_QUOTA_EXCEEDED:
    "Phân tích khẩu vị đã đạt hạn mức hoặc nguồn AI đang giới hạn yêu cầu. Hãy thử lại sau; mô tả vẫn được lưu.",
  AI_UNAVAILABLE:
    "Nguồn phân tích khẩu vị đang bận. Hãy thử lại sau; mô tả vẫn được lưu.",
  AI_INVALID_OUTPUT:
    "Chưa đọc được mô tả một cách chắc chắn. Hãy ghi rõ sở thích và ràng buộc ăn uống rồi thử lại.",
  AI_WORKER_INTERRUPTED:
    "Phân tích bị gián đoạn. Mô tả vẫn được lưu; hãy bấm phân tích lại.",
  LOCATION_REQUIRED:
    "Cần vị trí để tìm quán quanh bạn. Hãy cho phép truy cập vị trí rồi thử lại.",
};
export function userErrorMessage(code, status, fallback) {
  if (messages[code]) return messages[code];
  if (status === 429)
    return "Bạn đang thao tác quá nhanh hoặc nguồn dữ liệu đã đạt hạn mức. Chờ một lúc rồi thử lại.";
  if (status === 401)
    return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.";
  if (status === 403)
    return "Tài khoản của bạn không có quyền thực hiện thao tác này.";
  if (status >= 500)
    return "Hệ thống tạm thời chưa xử lý được yêu cầu. Hãy thử lại sau; thao tác chưa được xác nhận thành công.";
  return (
    fallback || "Không thể xử lý yêu cầu. Hãy kiểm tra thông tin và thử lại."
  );
}
