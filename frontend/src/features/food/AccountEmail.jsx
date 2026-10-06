import { useEffect, useState } from "react";
import { apiRequest } from "../../profileApi";
import UserNotice from "./UserNotice";
export default function AccountEmail() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      setData((await apiRequest("/auth/email-status")).data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    apiRequest("/auth/email-status")
      .then((result) => {
        if (alive) setData(result.data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  async function resend() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setNotice(
        (await apiRequest("/auth/resend-verification", { method: "POST" })).data
          .message,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="food-panel">
      <h2>Xác minh email</h2>
      {error && <UserNotice tone="error">{error}</UserNotice>}
      {notice && <UserNotice>{notice}</UserNotice>}
      {data ? (
        <>
          <p>
            {data.email} ·{" "}
            {data.emailVerifiedAt ? "Đã xác minh" : "Chưa xác minh"}
          </p>
          {!data.configured && !data.emailVerifiedAt && (
            <UserNotice tone="warning">
              Dịch vụ email chưa được cấu hình. Bạn có thể dùng app; chức năng
              gửi liên kết sẽ có khi dịch vụ được bật.
            </UserNotice>
          )}
          {!data.emailVerifiedAt && (
            <button disabled={busy || !data.configured} onClick={resend}>
              {busy ? "Đang gửi yêu cầu…" : "Yêu cầu liên kết xác minh"}
            </button>
          )}
        </>
      ) : (
        <p role="status">
          {error ? "Chưa kiểm tra được email." : "Đang kiểm tra email…"}
        </p>
      )}
      <button disabled={busy} onClick={load}>
        Kiểm tra lại trạng thái email
      </button>
    </section>
  );
}
