import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import { date } from "./foodUtils";

export default function History() {
  const [items, setItems] = useState([]),
    [cursor, setCursor] = useState(null);
  const [kind, setKind] = useState(""),
    [type, setType] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(null),
    [deleteError, setDeleteError] = useState("");
  const generation = useRef(0),
    dialog = useRef(null),
    returnFocus = useRef(null);
  const failedCursor = useRef(null);
  async function load(next = null, revision = generation.current) {
    setLoading(true);
    setError("");
    failedCursor.current = next;
    const params = new URLSearchParams({ limit: "20" });
    if (kind) params.set("kind", kind);
    if (type) params.set("type", type);
    if (next) params.set("cursor", next);
    try {
      const { data } = await apiRequest(`/users/me/history?${params}`);
      if (generation.current !== revision) return;
      setItems((old) => (next ? [...old, ...data.items] : data.items));
      setCursor(data.nextCursor);
    } catch (e) {
      if (generation.current === revision) setError(e.message);
    } finally {
      if (generation.current === revision) setLoading(false);
    }
  }
  useEffect(() => {
    const revision = ++generation.current;
    setItems([]);
    setCursor(null);
    load(null, revision);
    return () => {
      generation.current++;
    };
  }, [kind, type]);
  useEffect(() => {
    if (preview) dialog.current?.showModal();
  }, [preview]);
  async function showPreview(item, button) {
    setBusy(true);
    setError("");
    setDeleteError("");
    returnFocus.current = button;
    try {
      const result = await apiRequest(
        `/users/me/history/${item.kind}/${item.id}/deletion-preview`,
      );
      setPreview(result.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function closePreview() {
    dialog.current?.close();
    setPreview(null);
    setDeleteError("");
    returnFocus.current?.focus();
  }
  async function remove() {
    setBusy(true);
    setDeleteError("");
    try {
      await apiRequest(`/users/me/history/${preview.kind}/${preview.id}`, {
        method: "DELETE",
        body: JSON.stringify({
          confirm: true,
          expectedVersion: preview.expectedVersion,
        }),
      });
      closePreview();
      setNotice("Đã xóa bản ghi và cập nhật thời gian chờ của món.");
      window.dispatchEvent(new Event("food-history-changed"));
      await load();
    } catch (e) {
      setDeleteError(e.message);
      if (e.code === "HISTORY_CHANGED") {
        try {
          const result = await apiRequest(
            `/users/me/history/${preview.kind}/${preview.id}/deletion-preview`,
          );
          setPreview(result.data);
        } catch (refreshError) {
          setDeleteError(refreshError.message);
        }
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="food-eyebrow">NHẬT KÝ CỦA BẠN</p>
      <h1>Đã chọn & đã ăn</h1>
      <p>Mỗi lần chọn hoặc ăn đặt lại thời gian chờ 96 giờ cho món đó.</p>
      <div className="food-filters">
        <label>
          Nguồn món{" "}
          <select
            value={kind}
            disabled={busy}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="DISH">Món tại quán</option>
            <option value="RECIPE">Nấu tại nhà</option>
          </select>
        </label>
        <label>
          Hoạt động{" "}
          <select
            value={type}
            disabled={busy}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Đã chọn và đã ăn</option>
            <option value="CHOSEN">Đã chọn</option>
            <option value="EATEN">Đã ăn</option>
          </select>
        </label>
      </div>
      {notice && (
        <p role="status" className="food-success">
          {notice}
        </p>
      )}
      {error && (
        <div role="alert" className="food-error">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => load(failedCursor.current)}
            disabled={loading}
          >
            Thử tải lại
          </button>
        </div>
      )}
      {loading && <p role="status">Đang tải nhật ký…</p>}
      {!loading && !error && !items.length && (
        <p>
          Chưa có bản ghi phù hợp. Chọn món hôm nay hoặc ghi món đã ăn hôm qua.
        </p>
      )}
      {items.map((item) => (
        <article className="food-place" key={`${item.kind}:${item.id}`}>
          <h2>{item.title}</h2>
          <p>
            {item.kind === "RECIPE" ? "Nấu tại nhà" : "Món tại quán"} ·{" "}
            {item.interactionType === "CHOSEN" ? "Đã chọn" : "Đã ăn"} ·{" "}
            {date(item.createdAt)}
          </p>
          <p>
            {new Date(item.eligibleAgainAt) > new Date()
              ? `Có thể gợi ý lại từ ${date(item.eligibleAgainAt)}`
              : "Đã hết thời gian chờ"}{" "}
            (nếu không có lần chọn/ăn mới hơn)
          </p>
          {item.kind === "RECIPE" && (
            <a
              href={`#recipe/${encodeURIComponent(item.source)}/${encodeURIComponent(item.recipeId)}`}
            >
              Xem cách nấu
            </a>
          )}
          <button
            type="button"
            disabled={busy || loading}
            aria-label={`Xóa bản ghi ${item.title}`}
            onClick={(e) => showPreview(item, e.currentTarget)}
          >
            Xóa bản ghi
          </button>
        </article>
      ))}
      {cursor && !error && (
        <button
          type="button"
          disabled={loading || busy}
          onClick={() => load(cursor)}
        >
          Xem thêm nhật ký
        </button>
      )}
      <dialog
        className="food-wheel-dialog"
        ref={dialog}
        aria-labelledby="history-delete-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) closePreview();
        }}
      >
        {preview && (
          <>
            <h2 id="history-delete-title">Xóa bản ghi {preview.title}?</h2>
            <p>{preview.notice}</p>
            {preview.eligibleAgainAtAfterDeletion && (
              <p>
                Vẫn có thể gợi ý lại từ{" "}
                {date(preview.eligibleAgainAtAfterDeletion)}.
              </p>
            )}
            <p>Thao tác này không thể hoàn tác.</p>
            {deleteError && (
              <p role="alert" className="food-error">
                {deleteError}
              </p>
            )}
            <button
              type="button"
              autoFocus
              disabled={busy}
              onClick={closePreview}
            >
              Giữ bản ghi
            </button>
            <button type="button" disabled={busy} onClick={remove}>
              {busy ? "Đang xóa…" : "Xác nhận xóa"}
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
