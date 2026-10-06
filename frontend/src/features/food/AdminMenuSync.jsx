import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import UserNotice from "./UserNotice";
const states = {
  QUEUED: "Đang chờ",
  RUNNING: "Đang xử lý",
  SUCCEEDED: "Đồng bộ thành công",
  FAILED: "Đồng bộ thất bại",
  CANCELLED: "Đã tạm ngừng",
};
const errors = {
  MENU_SYNC_UNAVAILABLE: "Nguồn chưa phản hồi; giữ nguyên thực đơn cũ.",
  MENU_SYNC_TIMEOUT: "Nguồn phản hồi quá lâu; giữ nguyên thực đơn cũ.",
  MENU_SYNC_INTERRUPTED: "Worker bị gián đoạn; có thể thử lại cùng lượt.",
  MENU_SYNC_PAUSED: "Nguồn hoặc lịch đã tạm ngừng.",
  MENU_SYNC_SNAPSHOT_CHANGED: "Snapshot đã đổi; cần tạo lượt đồng bộ mới.",
  SYNC_INCOMPLETE: "Trang thiếu hoặc có dòng lỗi; cần sửa dữ liệu ở nguồn.",
  SYNC_STALE: "Snapshot cũ hơn dữ liệu đã áp dụng; cần lượt mới.",
};
export default function AdminMenuSync() {
  const [data, setData] = useState(null),
    [suppliers, setSuppliers] = useState([]),
    [jobs, setJobs] = useState(null),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [supplierId, setSupplierId] = useState(""),
    [adapterCode, setAdapterCode] = useState(""),
    [interval, setInterval] = useState(30),
    [enabled, setEnabled] = useState(false),
    [version, setVersion] = useState(null);
  const [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [reviewError, setReviewError] = useState(""),
    [stale, setStale] = useState(false);
  const dialog = useRef(null),
    focusBack = useRef(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setData(null);
    setJobs(null);
    Promise.all([
      apiRequest("/admin/menu/schedules"),
      apiRequest("/admin/menu/suppliers"),
      apiRequest(`/admin/menu/sync-jobs?page=${page}&limit=20`),
    ])
      .then(([s, p, j]) => {
        if (alive) {
          setData(s.data);
          setSuppliers(p.data.items);
          setJobs(j.data);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setSuppliers([]);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, revision]);
  useEffect(() => {
    if (selected) {
      focusBack.current = document.activeElement;
      dialog.current?.showModal();
    } else focusBack.current?.focus();
  }, [Boolean(selected)]);
  function choose(id) {
    setSupplierId(id);
    const row = data?.items.find((item) => item.supplierId === id);
    setAdapterCode(row?.adapterCode || data?.adapters[0]?.code || "");
    setInterval(row?.intervalMinutes ?? 30);
    setEnabled(row?.enabled ?? false);
    setVersion(row?.updatedAt ?? null);
  }
  function open(value) {
    setSelected(value);
    setReviewError("");
    setStale(false);
  }
  async function reloadSelected() {
    setBusy(true);
    setReviewError("");
    try {
      if (selected.mode === "retry") {
        const row = (await apiRequest(`/admin/menu/sync-jobs/${selected.id}`))
          .data;
        if (row.status !== "FAILED" || !row.retryable) {
          setSelected(null);
          setNotice("Lượt đã đổi trạng thái; yêu cầu thử lại chưa được gửi.");
          setRevision((v) => v + 1);
          return;
        }
        setSelected({ ...row, mode: "retry" });
      } else {
        const list = (await apiRequest("/admin/menu/schedules")).data;
        const row = list.items.find((item) => item.supplierId === selected.id);
        setSelected((old) => ({
          ...old,
          current: row,
          body: { ...old.body, expectedUpdatedAt: row?.updatedAt ?? null },
        }));
        setVersion(row?.updatedAt ?? null);
      }
      setStale(false);
    } catch (e) {
      setReviewError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setReviewError("");
    setNotice("");
    try {
      const path =
        selected.mode === "retry"
          ? `/admin/menu/sync-jobs/${selected.id}/retry`
          : `/admin/menu/schedules/${selected.id}${selected.mode === "run" ? "/run" : ""}`;
      await apiRequest(path, {
        method: selected.mode === "config" ? "PUT" : "POST",
        body: JSON.stringify(
          selected.mode === "retry"
            ? { confirm: true, expectedUpdatedAt: selected.updatedAt }
            : selected.mode === "run"
              ? { confirm: true, idempotencyKey: selected.key }
              : selected.body,
        ),
      });
      setSelected(null);
      setRevision((v) => v + 1);
      setNotice(
        selected.mode === "config"
          ? "Đã lưu lịch đồng bộ. Dữ liệu được áp dụng khi tải đủ và kiểm tra hợp lệ."
          : "Đã tiếp nhận lượt đồng bộ vào hàng đợi; thực đơn chưa được thay đổi.",
      );
      setSupplierId("");
    } catch (e) {
      setReviewError(e.message);
      if (e.status === 409 && selected.mode !== "run") setStale(true);
    } finally {
      setBusy(false);
    }
  }
  const ready = data?.workerEnabled && data?.adapters.length > 0;
  return (
    <section className="food-admin">
      <p className="food-eyebrow">QUẢN TRỊ / ĐỒNG BỘ</p>
      <h1>Đồng bộ thực đơn</h1>
      <p>
        Chỉ áp dụng snapshot tải đủ và hợp lệ. Khi tải dở, lỗi nguồn hoặc worker
        bị gián đoạn, thực đơn cũ giữ nguyên thời hạn xác minh; giá hết hạn
        không được coi là đã xác nhận.
      </p>
      {error && <UserNotice tone="error">{error}</UserNotice>}
      {notice && (
        <UserNotice tone="info" onDismiss={() => setNotice("")}>
          {notice}
        </UserNotice>
      )}
      <button
        disabled={loading || busy}
        onClick={() => setRevision((v) => v + 1)}
      >
        Tải lại trạng thái đồng bộ
      </button>
      {loading && <p role="status">Đang tải lịch và lượt đồng bộ…</p>}
      {data && (
        <>
          {!ready && (
            <UserNotice tone="warning">
              {!data.adapters.length
                ? "Chưa có adapter thực đơn được kết nối theo hợp đồng nhà cung cấp. API tìm quán không tự cung cấp thực đơn hay giá từng món."
                : "Worker đồng bộ đang tắt. Chưa thể yêu cầu đồng bộ hoặc thử lại."}
            </UserNotice>
          )}
          {!!data.adapters.length && (
            <form
              className="food-search"
              onSubmit={(e) => {
                e.preventDefault();
                open({
                  mode: "config",
                  id: supplierId,
                  current: data.items.find(
                    (item) => item.supplierId === supplierId,
                  ),
                  body: {
                    adapterCode,
                    enabled,
                    intervalMinutes: Number(interval),
                    expectedUpdatedAt: version,
                  },
                });
              }}
            >
              <label>
                Nguồn thực đơn
                <select
                  required
                  value={supplierId}
                  disabled={busy || loading}
                  onChange={(e) => choose(e.target.value)}
                >
                  <option value="">Chọn nguồn đã cấp phép</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.enabled ? "" : " · Tạm ngừng nguồn"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kết nối nguồn
                <select
                  required
                  value={adapterCode}
                  disabled={busy || loading || !!version}
                  onChange={(e) => setAdapterCode(e.target.value)}
                >
                  <option value="">Chọn kết nối</option>
                  {data.adapters.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Chu kỳ (phút)
                <input
                  type="number"
                  required
                  min={5}
                  max={1440}
                  value={interval}
                  disabled={busy || loading}
                  onChange={(e) => setInterval(e.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={busy || loading || !data.workerEnabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Bật lịch tự động
              </label>
              <button disabled={busy || loading || !supplierId}>
                Lưu lịch đồng bộ
              </button>
            </form>
          )}
          <div className="food-admin-account-list">
            {data.items.map((item) => (
              <article className="food-panel" key={item.supplierId}>
                <h2>{item.supplier.name}</h2>
                <p>
                  {item.enabled ? "Lịch đang bật" : "Lịch tạm ngừng"} ·{" "}
                  {item.intervalMinutes} phút/lần
                </p>
                <p>
                  Lần tiếp theo:{" "}
                  {new Date(item.nextRunAt).toLocaleString("vi-VN")}
                </p>
                <button
                  disabled={
                    busy ||
                    loading ||
                    !ready ||
                    !item.enabled ||
                    !item.supplier.enabled
                  }
                  onClick={() =>
                    open({
                      mode: "run",
                      id: item.supplierId,
                      name: item.supplier.name,
                      key: crypto.randomUUID(),
                    })
                  }
                >
                  Đồng bộ ngay
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {jobs && (
        <>
          <h2>Lượt đồng bộ</h2>
          <p>
            {jobs.total} lượt · Trang {page}
          </p>
          {!jobs.items.length && <p>Chưa có lượt đồng bộ ở trang này.</p>}
          <div className="food-admin-account-list">
            {jobs.items.map((job) => (
              <article className="food-panel" key={job.id}>
                <h3>{job.schedule.supplier.name}</h3>
                <p>
                  {states[job.status] || "Cần kiểm tra trạng thái"} ·{" "}
                  {job.attempts} lần xử lý
                </p>
                {job.errorCode && (
                  <p>
                    {errors[job.errorCode] ||
                      "Dữ liệu chưa được áp dụng. Xem lại nguồn trước khi tạo lượt mới."}
                  </p>
                )}
                <small>{new Date(job.createdAt).toLocaleString("vi-VN")}</small>
                {job.status === "FAILED" && job.retryable && (
                  <button
                    disabled={busy || loading || !ready}
                    onClick={() => open({ ...job, mode: "retry" })}
                  >
                    Thử lại lượt đồng bộ
                  </button>
                )}
              </article>
            ))}
          </div>
          <div className="food-actions">
            <button
              disabled={busy || loading || page <= 1}
              onClick={() => setPage((v) => v - 1)}
            >
              Trang trước
            </button>
            <button
              disabled={busy || loading || page * jobs.limit >= jobs.total}
              onClick={() => setPage((v) => v + 1)}
            >
              Trang tiếp
            </button>
          </div>
        </>
      )}
      {selected && (
        <dialog
          ref={dialog}
          className="food-confirm-dialog"
          aria-labelledby="sync-title"
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setSelected(null);
          }}
        >
          <form onSubmit={save}>
            <h2 id="sync-title">
              {selected.mode === "config"
                ? "Xác nhận lịch đồng bộ"
                : selected.mode === "retry"
                  ? "Thử lại lượt đồng bộ?"
                  : "Đồng bộ nguồn ngay?"}
            </h2>
            <p>
              {selected.name ||
                selected.schedule?.supplier.name ||
                suppliers.find((s) => s.id === selected.id)?.name}
            </p>
            {selected.mode === "config" && (
              <>
                <p>
                  Hiện tại:{" "}
                  {selected.current
                    ? `${selected.current.enabled ? "Bật" : "Tạm ngừng"}, ${selected.current.intervalMinutes} phút/lần`
                    : "Chưa có lịch"}
                  .
                </p>
                <p>
                  Sẽ lưu: {selected.body.enabled ? "Bật" : "Tạm ngừng"},{" "}
                  {selected.body.intervalMinutes} phút/lần.
                </p>
              </>
            )}
            <p>
              Hàng đợi không đồng nghĩa đã cập nhật thực đơn. Snapshot cần đủ
              trang, đúng nguồn và còn mới; món bị kiểm duyệt không tự bật lại.
            </p>
            {reviewError && <UserNotice tone="error">{reviewError}</UserNotice>}
            {stale && (
              <button type="button" disabled={busy} onClick={reloadSelected}>
                Tải trạng thái mới trước khi xác nhận
              </button>
            )}
            <div className="food-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Hủy
              </button>
              <button disabled={busy || stale}>
                {busy ? "Đang tiếp nhận…" : "Xác nhận đồng bộ"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
