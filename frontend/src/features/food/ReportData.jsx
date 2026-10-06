import { useEffect, useId, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
export const reportReasons = {
  WRONG_PRICE: "Giá không đúng",
  UNAVAILABLE: "Món hoặc quán không còn phục vụ",
  WRONG_ADDRESS: "Địa chỉ không đúng",
  INGREDIENTS: "Thông tin nguyên liệu cần kiểm tra",
  MEDIA: "Ảnh hoặc thông tin hiển thị không đúng",
  OTHER: "Thông tin khác",
};
export const reportStatuses = {
  OPEN: "Đã gửi, chờ kiểm tra",
  IN_REVIEW: "Đang kiểm tra",
  RESOLVED: "Đã xử lý",
  DISMISSED: "Đã xem xét, không thay đổi dữ liệu",
};
export default function ReportData({ target, title }) {
  const heading = useId(),
    dialog = useRef(null),
    button = useRef(null),
    key = useRef(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [reason, setReason] = useState("OTHER"),
    [note, setNote] = useState(""),
    [sent, setSent] = useState(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  function close() {
    dialog.current?.close();
    setOpen(false);
    button.current?.focus();
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const input = { target, reason, note: note.trim() },
      signature = JSON.stringify(input);
    if (key.current?.signature !== signature)
      key.current = { signature, value: crypto.randomUUID() };
    try {
      const { data } = await apiRequest("/users/me/data-reports", {
        method: "POST",
        body: JSON.stringify({ ...input, idempotencyKey: key.current.value }),
      });
      setSent(data);
      key.current = null;
      setNote("");
      close();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        ref={button}
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        Báo thông tin sai
      </button>
      {sent && (
        <p role="status">
          Đã gửi báo cáo để quản trị kiểm tra. Xem trạng thái trong Nhật ký của
          bạn.
        </p>
      )}
      <dialog
        className="food-wheel-dialog"
        ref={dialog}
        aria-labelledby={heading}
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) close();
        }}
      >
        <h2 id={heading}>Báo thông tin về {title}</h2>
        <p>
          Báo cáo liên kết với nguồn dữ liệu và tài khoản của bạn. Không gửi mật
          khẩu hoặc khóa API.
        </p>
        <form onSubmit={submit}>
          <label>
            Thông tin cần kiểm tra
            <select
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            >
              {Object.entries(reportReasons).map(([code, label]) => (
                <option value={code} key={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mô tả thông tin sai
            <textarea
              autoFocus
              required
              minLength={1}
              maxLength={2000}
              value={note}
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="food-error">
              {error}
            </p>
          )}
          <button type="button" disabled={busy} onClick={close}>
            Đóng báo cáo
          </button>
          <button type="submit" disabled={busy || !note.trim()}>
            {busy ? "Đang gửi báo cáo…" : "Gửi báo cáo"}
          </button>
        </form>
      </dialog>
    </>
  );
}
