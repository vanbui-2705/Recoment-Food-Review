export default function PublicLegal({ screen }) {
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
        GPS chỉ được yêu cầu khi bạn bấm lấy vị trí. Khi tìm quán, tên món và
        tọa độ được gửi tới Google Maps; thông tin dị ứng và lịch sử ăn không
        được gửi tới Google.
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
    </>
  );
}
