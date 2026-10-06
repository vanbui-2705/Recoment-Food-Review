import { useEffect, useState } from "react";
import { apiRequest } from "../../profileApi";
import UserNotice from "./UserNotice";
export default function PublicLegal({ screen }) {
  const [policy, setPolicy] = useState(null),
    [failed, setFailed] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (screen !== "privacy") return;
    let alive = true;
    setFailed(false);
    apiRequest("/privacy-policy")
      .then((result) => {
        if (alive) setPolicy(result.data);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [screen, revision]);
  return screen === "terms" ? (
    <>
      <h1>Điều khoản sử dụng</h1>
      <p>
        EatWise cung cấp gợi ý và tìm quán, chưa hỗ trợ đặt món hoặc thanh toán.
        Giá công thức chỉ tham khảo. Kết quả tìm quán không xác nhận thực đơn
        hoặc an toàn dị ứng. Hãy xác nhận với quán trước khi ăn.
      </p>
      <p>
        Dữ liệu Google Maps chịu sự điều chỉnh của{" "}
        <a
          href="https://maps.google.com/help/terms_maps.html"
          target="_blank"
          rel="noreferrer"
        >
          Điều khoản Google Maps
        </a>
        .
      </p>
    </>
  ) : (
    <>
      <h1>Quyền riêng tư</h1>
      <p>
        Hồ sơ khẩu vị, vị trí và lịch sử lựa chọn được lưu để cá nhân hóa gợi ý.
        GPS chỉ được yêu cầu khi bạn bấm lấy vị trí. Khi tìm quán, từ khóa và
        tọa độ được gửi đến nguồn tìm địa điểm đang bật: Google Maps, Goong,
        Foursquare hoặc Geoapify. Khi tìm công thức, từ khóa được gửi đến
        TheMealDB hoặc Spoonacular. Hồ sơ dị ứng đã lưu và nhật ký ăn không được
        gửi trực tiếp đến các nguồn tìm quán.
      </p>
      <p>
        Google xử lý dữ liệu theo{" "}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noreferrer"
        >
          Chính sách quyền riêng tư Google
        </a>
        . Liên hệ đơn vị vận hành để yêu cầu truy cập hoặc xóa dữ liệu tài
        khoản.
      </p>
      <p>
        Khi dùng phân tích khẩu vị hoặc chat, mô tả và nội dung liên quan có thể
        được gửi đến dịch vụ AI để xử lý. Khi yêu cầu khôi phục mật khẩu hoặc
        xác minh email, địa chỉ email và liên kết dùng một lần được gửi đến dịch
        vụ email Resend nếu đã bật. Mật khẩu và hồ sơ khẩu vị không được gửi đến
        dịch vụ email.
      </p>
      <p>
        Trong mục Tài khoản, bạn có thể xuất dữ liệu sau khi nhập lại mật khẩu,
        hoặc xác nhận yêu cầu xóa khi dịch vụ xử lý đã bật. Yêu cầu xóa thu hồi
        mọi phiên ngay; dữ liệu riêng được xử lý xóa, báo cáo và nhật ký vận
        hành được ẩn danh. Hồ sơ và mô tả hiện tại được giữ khi tài khoản còn
        tồn tại.
      </p>
      {policy && (
        <p>
          Thời hạn mặc định cho cuộc trò chuyện và lượt gợi ý:{" "}
          {policy.retention.conversationsDays} ngày; nhật ký hành vi:{" "}
          {policy.retention.actionsDays} ngày; audit vận hành:{" "}
          {policy.retention.auditDays} ngày. Báo cáo đã xử lý được dọn sau 90
          ngày; báo cáo đang xử lý được giữ để giải quyết. Tệp xuất truyền trực
          tiếp, không có bản tải xuống lưu trên server.
        </p>
      )}
      {policy && policy.cleanupState !== "ACTIVE" && (
        <UserNotice tone="warning">
          Dọn dữ liệu định kỳ{" "}
          {policy.cleanupState === "DISABLED"
            ? "chưa được bật"
            : "đang chờ xác nhận lần chạy"}
          . Liên hệ đơn vị vận hành nếu cần xử lý dữ liệu sớm.
        </UserNotice>
      )}
      {failed && (
        <UserNotice tone="warning">
          Chưa kiểm tra được thời hạn lưu dữ liệu hiện tại.{" "}
          <button onClick={() => setRevision((value) => value + 1)}>
            Kiểm tra lại
          </button>
        </UserNotice>
      )}
    </>
  );
}
