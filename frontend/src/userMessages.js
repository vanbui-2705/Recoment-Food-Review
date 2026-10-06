const messages = {
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
