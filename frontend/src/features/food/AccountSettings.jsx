import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import UserNotice from "./UserNotice";

export default function AccountSettings({ onSignedOut }) {
  const [name, setName] = useState("");
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const dialog = useRef(null),
    focusBack = useRef(null);
  async function loadSessions() {
    setSessionError("");
    try {
      setSessions((await apiRequest("/auth/sessions")).data.items);
    } catch (e) {
      setSessionError(e.message);
    }
  }
  async function loadUser() {
    setLoading(true);
    setError("");
    try {
      const next = (await apiRequest("/users/me")).data.user;
      setUser(next);
      setName(next.displayName);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let alive = true;
    apiRequest("/users/me")
      .then(({ data }) => {
        if (alive) {
          setUser(data.user);
          setName(data.user.displayName);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    apiRequest("/auth/sessions")
      .then(({ data }) => {
        if (alive) setSessions(data.items);
      })
      .catch((e) => {
        if (alive) setSessionError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (confirm) {
      focusBack.current = document.activeElement;
      dialog.current?.showModal();
    } else focusBack.current?.focus();
  }, [confirm]);
  const begin = () => {
    setBusy(true);
    setError("");
    setNotice("");
  };
  async function saveName(event) {
    event.preventDefault();
    begin();
    try {
      const { data } = await apiRequest("/users/me/name", {
        method: "PUT",
        body: JSON.stringify({ displayName: name }),
      });
      setName(data.displayName);
      setUser((old) => ({ ...old, displayName: data.displayName }));
      setNotice("Đã cập nhật tên hiển thị.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(event) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form);
    if (data.get("newPassword") !== data.get("confirmPassword")) {
      setError("Mật khẩu xác nhận chưa khớp với mật khẩu mới.");
      return;
    }
    begin();
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          newPassword: data.get("newPassword"),
        }),
      });
      form.reset();
      onSignedOut(
        "Đã đổi mật khẩu và đăng xuất tất cả thiết bị. Hãy đăng nhập bằng mật khẩu mới.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    begin();
    try {
      await apiRequest(
        confirm.all ? "/auth/logout-all" : `/auth/sessions/${confirm.id}`,
        { method: confirm.all ? "POST" : "DELETE" },
      );
      if (confirm.all || confirm.current)
        onSignedOut(
          "Đã thu hồi phiên đăng nhập. Hãy đăng nhập lại khi cần sử dụng app.",
        );
      else {
        setSessions((old) => old.filter((item) => item.id !== confirm.id));
        setNotice("Đã đăng xuất thiết bị được chọn.");
      }
      setConfirm(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="food-account">
      <p className="food-eyebrow">TÀI KHOẢN CỦA BẠN</p>
      <h1>Cài đặt tài khoản</h1>
      <p>Quản lý tên, mật khẩu và những thiết bị đang đăng nhập.</p>
      {error && !confirm && (
        <UserNotice tone="error" onDismiss={() => setError("")}>
          {error}
        </UserNotice>
      )}
      {notice && (
        <UserNotice tone="success" onDismiss={() => setNotice("")}>
          {notice}
        </UserNotice>
      )}
      {loading ? (
        <p role="status">Đang tải tài khoản…</p>
      ) : !user ? (
        <button onClick={loadUser}>Thử tải lại tài khoản</button>
      ) : (
        <>
          <form className="food-panel" onSubmit={saveName}>
            <h2>Thông tin tài khoản</h2>
            <p>{user.email}</p>
            <label>
              Tên hiển thị
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={100}
                required
                autoComplete="nickname"
                disabled={busy}
              />
            </label>
            <button
              className="primary"
              disabled={
                busy || name.trim().length < 2 || name === user.displayName
              }
            >
              {busy ? "Đang lưu…" : "Lưu tên"}
            </button>
          </form>
          <form className="food-panel" onSubmit={changePassword}>
            <h2>Đổi mật khẩu</h2>
            <p>Khi đổi thành công, tất cả thiết bị sẽ được đăng xuất ngay.</p>
            <fieldset disabled={busy}>
              <label>
                Mật khẩu hiện tại
                <input
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  required
                  maxLength={255}
                />
              </label>
              <label>
                Mật khẩu mới
                <input
                  type="password"
                  name="newPassword"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={255}
                />
              </label>
              <small>Dùng ít nhất 8 ký tự và khác mật khẩu hiện tại.</small>
              <label>
                Nhập lại mật khẩu mới
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={255}
                />
              </label>
              <button className="primary">
                {busy ? "Đang xử lý…" : "Đổi mật khẩu và đăng xuất"}
              </button>
            </fieldset>
          </form>
        </>
      )}
      <section className="food-panel">
        <h2>Thiết bị đang đăng nhập</h2>
        <p>
          Danh sách tối đa 50 phiên gần nhất. Thu hồi sẽ ngừng cả phiên truy cập
          và khả năng tự đăng nhập lại của thiết bị.
        </p>
        {sessionError && <UserNotice tone="error">{sessionError}</UserNotice>}
        <button onClick={loadSessions} disabled={busy}>
          Tải lại thiết bị
        </button>
        {sessions === null ? (
          <p role="status">
            {sessionError
              ? "Chưa tải được danh sách thiết bị."
              : "Đang tải thiết bị…"}
          </p>
        ) : sessions.length === 0 ? (
          <p>
            Không có phiên thiết bị còn hiệu lực trong danh sách. Phiên cũ có
            thể chưa có thông tin thiết bị.
          </p>
        ) : (
          <ul className="food-session-list">
            {sessions.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>
                    {item.current ? "Thiết bị hiện tại" : "Thiết bị khác"}
                  </strong>
                  <p>{item.device}</p>
                  <small>
                    Hiệu lực đến{" "}
                    {new Date(item.expiresAt).toLocaleString("vi-VN")}
                  </small>
                </div>
                <button
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setConfirm(item);
                  }}
                >
                  Đăng xuất{" "}
                  {item.current ? "thiết bị hiện tại" : "thiết bị này"}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          disabled={busy}
          onClick={() => {
            setError("");
            setConfirm({ all: true });
          }}
        >
          Đăng xuất tất cả thiết bị
        </button>
      </section>
      {confirm && (
        <dialog
          ref={dialog}
          className="food-confirm-dialog"
          onCancel={(event) => {
            if (busy) event.preventDefault();
            else setConfirm(null);
          }}
          aria-labelledby="session-confirm-title"
        >
          <h2 id="session-confirm-title">
            {confirm.all
              ? "Đăng xuất tất cả thiết bị?"
              : "Đăng xuất thiết bị này?"}
          </h2>
          <p>
            {confirm.all || confirm.current
              ? "Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng app."
              : "Thiết bị được chọn sẽ cần đăng nhập lại. Phiên hiện tại vẫn tiếp tục."}
          </p>
          {error && <UserNotice tone="error">{error}</UserNotice>}
          <button disabled={busy} onClick={() => setConfirm(null)}>
            Giữ phiên đăng nhập
          </button>
          <button className="primary" disabled={busy} onClick={revoke}>
            {busy ? "Đang thu hồi…" : "Xác nhận đăng xuất"}
          </button>
        </dialog>
      )}
    </section>
  );
}
