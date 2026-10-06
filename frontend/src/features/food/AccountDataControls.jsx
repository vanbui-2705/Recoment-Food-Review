import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import UserNotice from "./UserNotice";
export default function AccountDataControls({ onSignedOut }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [mode, setMode] = useState(null),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState(""),
    [understood, setUnderstood] = useState(false);
  const dialog = useRef(null),
    focusBack = useRef(null),
    abort = useRef(null);
  async function load() {
    setError("");
    try {
      setData((await apiRequest("/users/me/data-controls")).data);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    let alive = true;
    apiRequest("/users/me/data-controls")
      .then((result) => {
        if (alive) setData(result.data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (mode) {
      focusBack.current = document.activeElement;
      dialog.current?.showModal();
    } else focusBack.current?.focus();
  }, [mode]);
  function open(next) {
    setMode(next);
    setPassword("");
    setConfirmation("");
    setUnderstood(false);
    setError("");
    setNotice("");
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      if (mode === "delete") {
        const result = await apiRequest("/users/me/account", {
          method: "DELETE",
          signal: controller.signal,
          body: JSON.stringify({
            currentPassword: password,
            confirm: understood,
            confirmation,
          }),
        });
        setPassword("");
        setMode(null);
        onSignedOut(
          `Đã tiếp nhận yêu cầu xóa tài khoản và thu hồi các phiên đăng nhập. Dữ liệu đang được xử lý xóa. Mã yêu cầu: ${result.data.requestId}.`,
        );
      } else {
        const response = await apiRequest("/users/me/export", {
          method: "POST",
          signal: controller.signal,
          responseType: "stream",
          body: JSON.stringify({ currentPassword: password }),
        });
        const reader = response.body?.getReader();
        if (!reader)
          throw new Error("Không đọc được dữ liệu xuất. Hãy thử lại.");
        let size = 0;
        const chunks = [];
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            size += next.value.length;
            if (size > 50000000) {
              controller.abort();
              throw new Error(
                "Dữ liệu vượt giới hạn phiên tải. Hãy liên hệ hỗ trợ để nhận dữ liệu đầy đủ.",
              );
            }
            chunks.push(next.value);
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        const blob = new Blob(chunks, { type: "application/x-ndjson" }),
          text = (await blob.text()).trimEnd();
        let complete;
        try {
          complete = JSON.parse(text.slice(text.lastIndexOf("\n") + 1));
        } catch {
          /* Incomplete stream is rejected. */
        }
        if (complete?.type !== "complete")
          throw new Error(
            "Phiên tải bị gián đoạn. Dữ liệu chưa được xác nhận đầy đủ; hãy tải lại.",
          );
        const url = URL.createObjectURL(blob),
          link = document.createElement("a");
        link.href = url;
        link.download = "eatwise-personal-data.jsonl";
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setPassword("");
        setMode(null);
        setNotice(
          "Đã chuẩn bị tệp dữ liệu cá nhân đầy đủ cho phiên tải. Kiểm tra mục tải xuống của trình duyệt.",
        );
      }
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      abort.current = null;
      setBusy(false);
    }
  }
  return (
    <section className="food-panel">
      <h2>Dữ liệu và quyền riêng tư</h2>
      <p>
        Xuất hồ sơ, nhật ký, phản hồi và cuộc trò chuyện của chính bạn. Tệp
        không chứa mật khẩu, token, nội dung nội bộ hoặc ảnh/đánh giá Google của
        quán.
      </p>
      {error && !mode && <UserNotice tone="error">{error}</UserNotice>}
      {notice && (
        <UserNotice tone="success" onDismiss={() => setNotice("")}>
          {notice}
        </UserNotice>
      )}
      {data ? (
        <>
          <p>
            Mặc định: cuộc trò chuyện và lượt gợi ý{" "}
            {data.retention.conversationsDays} ngày; hành vi{" "}
            {data.retention.actionsDays} ngày; nhật ký vận hành{" "}
            {data.retention.auditDays} ngày được ẩn danh khi xóa tài khoản. Tệp
            xuất truyền trực tiếp, không lưu bản sao tải xuống trên server.
          </p>
          {!data.deletionAvailable && (
            <UserNotice tone="warning">
              Xử lý xóa và dọn dữ liệu tự động chưa được bật. Bạn vẫn có thể
              xuất dữ liệu hoặc liên hệ đơn vị vận hành để yêu cầu xóa.
            </UserNotice>
          )}
          <div className="food-actions">
            <button disabled={busy} onClick={() => open("export")}>
              Xuất dữ liệu cá nhân
            </button>
            <button
              disabled={busy || !data.deletionAvailable}
              onClick={() => open("delete")}
            >
              Yêu cầu xóa tài khoản
            </button>
          </div>
        </>
      ) : (
        <p role="status">
          {error
            ? "Chưa kiểm tra được chức năng dữ liệu."
            : "Đang kiểm tra chức năng dữ liệu…"}
        </p>
      )}
      <button disabled={busy} onClick={load}>
        Kiểm tra lại chức năng dữ liệu
      </button>
      {mode && (
        <dialog
          ref={dialog}
          className="food-confirm-dialog"
          aria-labelledby="account-data-title"
          onCancel={(event) => {
            if (busy) event.preventDefault();
            else {
              setMode(null);
              setPassword("");
            }
          }}
        >
          <form onSubmit={submit}>
            <h2 id="account-data-title">
              {mode === "delete"
                ? "Xác nhận xóa tài khoản"
                : "Xác nhận xuất dữ liệu"}
            </h2>
            <p>
              {mode === "delete"
                ? "Sau xác nhận, tài khoản ngừng hoạt động và mọi thiết bị bị đăng xuất ngay. Hồ sơ, lịch sử, phản hồi, hội thoại và liên kết email sẽ được xử lý xóa. Nhật ký vận hành và báo cáo được ẩn danh. Yêu cầu không thể hủy trong app."
                : "Tệp .jsonl chứa thông tin cá nhân, có thể gồm vị trí và khẩu vị của bạn. Chỉ lưu vào thiết bị bạn tin cậy."}
            </p>
            <fieldset disabled={busy}>
              <label>
                Mật khẩu hiện tại để xác nhận
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  maxLength={255}
                  required
                />
              </label>
              {mode === "delete" && (
                <>
                  <label>
                    Nhập XÓA TÀI KHOẢN để xác nhận
                    <input
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      maxLength={30}
                      autoComplete="off"
                      required
                    />
                  </label>
                  <label className="food-check">
                    <input
                      type="checkbox"
                      checked={understood}
                      onChange={(e) => setUnderstood(e.target.checked)}
                      required
                    />
                    Tôi hiểu tài khoản và dữ liệu riêng sẽ được xử lý xóa, và
                    mọi thiết bị sẽ bị đăng xuất.
                  </label>
                </>
              )}
            </fieldset>
            {error && <UserNotice tone="error">{error}</UserNotice>}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode(null);
                setPassword("");
              }}
            >
              Hủy thao tác
            </button>
            <button
              className="primary"
              disabled={
                busy ||
                !password ||
                (mode === "delete" &&
                  (!understood || confirmation !== "XÓA TÀI KHOẢN"))
              }
            >
              {busy
                ? "Đang xử lý…"
                : mode === "delete"
                  ? "Xác nhận yêu cầu xóa"
                  : "Xác nhận tải dữ liệu"}
            </button>
          </form>
        </dialog>
      )}
    </section>
  );
}
