import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import { date } from "./foodUtils";
import { reportReasons, reportStatuses } from "./ReportData";
const actions = {
  OPEN: ["IN_REVIEW", "RESOLVED", "DISMISSED"],
  IN_REVIEW: ["OPEN", "RESOLVED", "DISMISSED"],
  RESOLVED: ["OPEN"],
  DISMISSED: ["OPEN"],
};
export default function AdminReports() {
  const [data, setData] = useState(null),
    [status, setStatus] = useState("OPEN"),
    [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState(null);
  const [reason, setReason] = useState(""),
    [nextStatus, setNextStatus] = useState("IN_REVIEW"),
    [reviewError, setReviewError] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiRequest(
      `/admin/data-reports?page=${page}&limit=20${status ? `&status=${status}` : ""}`,
    )
      .then((result) => {
        if (active) setData(result.data);
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          if ([401, 403].includes(err.status)) setData(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, status, revision]);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);
  async function detail(id, keepReason = false) {
    setBusy(true);
    setReviewError("");
    setError("");
    try {
      const result = await apiRequest(`/admin/data-reports/${id}`);
      setSelected(result.data);
      setNextStatus(actions[result.data.status][0]);
      if (!keepReason) setReason("");
    } catch (err) {
      if (keepReason) setReviewError(err.message);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function close() {
    dialog.current?.close();
    setSelected(null);
    setReviewError("");
  }
  async function review(event) {
    event.preventDefault();
    setBusy(true);
    setReviewError("");
    try {
      await apiRequest(`/admin/data-reports/${selected.id}/review`, {
        method: "PUT",
        body: JSON.stringify({
          status: nextStatus,
          reason: reason.trim(),
          expectedUpdatedAt: selected.updatedAt,
        }),
      });
      close();
      setNotice("Đã cập nhật trạng thái và lưu lịch sử xử lý báo cáo.");
      setRevision((value) => value + 1);
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Quản trị báo cáo">
      <h1>Báo cáo thông tin sai</h1>
      <p>
        Kiểm tra dữ liệu tại nguồn trước khi xử lý; báo cáo không tự thay đổi
        giá hoặc bằng chứng an toàn.
      </p>
      <label>
        Trạng thái báo cáo
        <select
          value={status}
          disabled={busy}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          {Object.entries(reportStatuses).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
          <option value="">Tất cả trạng thái</option>
        </select>
      </label>
      <button
        type="button"
        disabled={loading || busy}
        onClick={() => setRevision((value) => value + 1)}
      >
        Tải lại danh sách báo cáo
      </button>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="food-error">
          {error}
        </p>
      )}
      {loading && <p role="status">Đang tải báo cáo quản trị…</p>}
      {!loading && !error && !data?.items.length && (
        <p>Không có báo cáo ở trạng thái này.</p>
      )}
      {!loading &&
        !error &&
        data?.items.map((item) => (
          <article className="food-place" key={item.id}>
            <h2>{reportReasons[item.reason]}</h2>
            <p>
              {reportStatuses[item.status]} · {date(item.createdAt)}
            </p>
            <p>{item.note}</p>
            <small>
              {item.targetKind} · {item.targetSource || "Merchant"} ·{" "}
              {item.targetId}
            </small>
            <p>Tài khoản: {item.userId || "Đã ẩn danh"}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => detail(item.id)}
            >
              Kiểm tra và xử lý báo cáo
            </button>
          </article>
        ))}
      {data && (
        <div className="food-actions">
          <button
            type="button"
            disabled={loading || page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Trang trước
          </button>
          <span>Trang {page}</span>
          <button
            type="button"
            disabled={loading || page * data.limit >= data.total}
            onClick={() => setPage((value) => value + 1)}
          >
            Trang tiếp
          </button>
        </div>
      )}
      <dialog
        className="food-wheel-dialog"
        ref={dialog}
        aria-labelledby="admin-report-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) close();
        }}
      >
        {selected && (
          <>
            <h2 id="admin-report-title">
              Xử lý báo cáo {reportReasons[selected.reason]}
            </h2>
            <p>{selected.note}</p>
            <p>Hiện tại: {reportStatuses[selected.status]}</p>
            <form onSubmit={review}>
              <label>
                Trạng thái mới
                <select
                  value={nextStatus}
                  disabled={busy}
                  onChange={(event) => setNextStatus(event.target.value)}
                >
                  {actions[selected.status].map((code) => (
                    <option key={code} value={code}>
                      {reportStatuses[code]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Lý do xử lý hoặc mở lại
                <textarea
                  required
                  maxLength={1000}
                  value={reason}
                  disabled={busy}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              {reviewError && (
                <p role="alert" className="food-error">
                  {reviewError}
                </p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => detail(selected.id, true)}
              >
                Tải lại báo cáo
              </button>
              <button type="button" disabled={busy} onClick={close}>
                Đóng kiểm tra
              </button>
              <button type="submit" disabled={busy || !reason.trim()}>
                {busy ? "Đang lưu xử lý…" : "Lưu xử lý báo cáo"}
              </button>
            </form>
            <h3>Lịch sử xử lý</h3>
            {!selected.reviews.length && <p>Chưa có lượt xử lý.</p>}
            {selected.reviews.map((item) => (
              <article className="food-place" key={item.id}>
                <p>
                  {reportStatuses[item.fromStatus]} →{" "}
                  {reportStatuses[item.toStatus]} · {date(item.createdAt)}
                </p>
                <p>{item.reason}</p>
              </article>
            ))}
          </>
        )}
      </dialog>
    </section>
  );
}
