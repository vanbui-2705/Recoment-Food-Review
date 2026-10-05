import { useState } from "react";
import { ACCESS_TOKEN_KEY, apiRequest } from "../../profileApi";

export default function Auth({ onLogin }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const credentials = {
      email: form.get("email"),
      password: form.get("password"),
    };
    try {
      if (register)
        await apiRequest("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            ...credentials,
            displayName: form.get("name"),
          }),
        });
      const response = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      localStorage.setItem(ACCESS_TOKEN_KEY, response.data.accessToken);
      sessionStorage.setItem("food_refresh_token", response.data.refreshToken);
      onLogin();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="food-auth">
      <p className="food-eyebrow">EATWISE / MỖI NGÀY MỘT LỰA CHỌN</p>
      <h1>
        Hôm nay,
        <br />
        ăn gì hợp gu?
      </h1>
      <p>
        Lưu khẩu vị một lần. Khám phá món phù hợp mỗi ngày, tự động đổi món sau
        khi bạn chọn.
      </p>
      <form onSubmit={submit}>
        {register && (
          <label>
            Tên của bạn
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Mật khẩu
          <input
            name="password"
            type="password"
            minLength={register ? 8 : 1}
            maxLength={255}
            required
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {error && (
          <p role="alert" className="food-error">
            {error}
          </p>
        )}
        <button className="food-primary" disabled={busy}>
          {busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"}
        </button>
      </form>
      <button
        onClick={() => {
          setRegister(!register);
          setError("");
        }}
      >
        {register ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
      </button>
    </main>
  );
}
