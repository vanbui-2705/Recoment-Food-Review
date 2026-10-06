import { useEffect, useState } from "react";
import { apiRequest } from "../../profileApi";
import UserNotice from "./UserNotice";
export default function EmailRecovery({ screen, onPasswordReset }) {
  const [token, setToken] = useState(() => {
    const value = window.location.hash.split("/")[1] || "";
    return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : "";
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [complete, setComplete] = useState(false);
  const forgot = screen === "forgot-password",
    reset = screen === "reset-password";
  useEffect(() => {
    // Keep link secrets only in component memory, never in storage or API URLs.
    if (!forgot)
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#${screen}`,
      );
  }, [forgot, screen]);
  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = event.currentTarget,
      data = new FormData(form);
    if (reset && data.get("newPassword") !== data.get("confirmPassword")) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setBusy(true);
    try {
      if (forgot) {
        const result = await apiRequest("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: data.get("email") }),
        });
        setNotice(result.data.message);
        setComplete(true);
      } else {
        await apiRequest(
          reset ? "/auth/reset-password" : "/auth/verify-email",
          {
            method: "POST",
            body: JSON.stringify(
              reset
                ? { token, newPassword: data.get("newPassword") }
                : { token },
            ),
          },
        );
        form.reset();
        setComplete(true);
        setToken("");
        if (reset) onPasswordReset();
        setNotice(
          reset
            ? "Đã đặt lại mật khẩu và thu hồi các phiên cũ. Hãy đăng nhập bằng mật khẩu mới."
            : "Đã xác minh email. Bạn có thể quay lại tài khoản để kiểm tra trạng thái.",
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="food-auth">
      <p className="food-eyebrow">EATWISE / TÀI KHOẢN</p>
      <h1>
        {forgot
          ? "Quên mật khẩu?"
          : reset
            ? "Đặt lại mật khẩu"
            : "Xác minh email"}
      </h1>
      <p>
        {forgot
          ? "Nhập email tài khoản. Nếu có tài khoản đang hoạt động, hệ thống sẽ xử lý yêu cầu gửi liên kết có hiệu lực 30 phút."
          : "Liên kết dùng một lần, có hiệu lực 30 phút. Xác nhận dưới đây để tiếp tục."}
      </p>
      {error && <UserNotice tone="error">{error}</UserNotice>}
      {notice && (
        <UserNotice tone={forgot ? "info" : "success"}>{notice}</UserNotice>
      )}
      {!forgot && !token && !complete ? (
        <UserNotice tone="warning">
          Thiếu liên kết hợp lệ. Hãy mở lại liên kết trong email hoặc yêu cầu
          liên kết mới.
        </UserNotice>
      ) : (
        !complete && (
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              {forgot && (
                <label>
                  Email tài khoản
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    maxLength={255}
                    required
                  />
                </label>
              )}
              {reset && (
                <>
                  <label>
                    Mật khẩu mới
                    <input
                      type="password"
                      name="newPassword"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={255}
                      required
                    />
                  </label>
                  <label>
                    Nhập lại mật khẩu mới
                    <input
                      type="password"
                      name="confirmPassword"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={255}
                      required
                    />
                  </label>
                </>
              )}
              <button className="primary">
                {busy
                  ? "Đang xử lý…"
                  : forgot
                    ? "Yêu cầu liên kết khôi phục"
                    : reset
                      ? "Xác nhận mật khẩu mới"
                      : "Xác nhận email"}
              </button>
            </fieldset>
          </form>
        )
      )}
      {complete && forgot && (
        <button
          onClick={() => {
            setComplete(false);
            setNotice("");
          }}
        >
          Yêu cầu lại bằng email khác
        </button>
      )}
      {!forgot && (
        <a href={reset ? "#forgot-password" : "#account"}>
          {reset
            ? "Yêu cầu liên kết khôi phục mới"
            : "Về tài khoản / yêu cầu liên kết mới"}
        </a>
      )}
      <p>
        <a href="#today">← Quay lại app / đăng nhập</a>
      </p>
    </main>
  );
}
