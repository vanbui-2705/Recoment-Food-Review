import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import UserNotice from "./UserNotice";

export default function AdminAccounts({ audit = false, onSignedOut }) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reviewError, setReviewError] = useState("");
  const [selected, setSelected] = useState(null),
    [reasonCode, setReasonCode] = useState("SECURITY"),
    [busy, setBusy] = useState(false),
    [stale, setStale] = useState(false);
  const dialog = useRef(null),
    focusBack = useRef(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    apiRequest(
      `/admin/${audit ? "audit" : "users"}?page=${page}&limit=20${!audit && query ? `&q=${encodeURIComponent(query)}` : ""}`,
    )
      .then((result) => {
        if (alive) setData(result.data);
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          if ([401, 403].includes(e.status)) setData(null);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [audit, page, query, revision]);
  useEffect(() => {
    if (selected) {
      focusBack.current = document.activeElement;
      dialog.current?.showModal();
    } else focusBack.current?.focus();
  }, [Boolean(selected)]);
  async function reloadSelected() {
    setBusy(true);
    setReviewError("");
    try {
      const result = await apiRequest(`/admin/users/${selected.id}`);
      setSelected((old) => ({ ...result.data, nextStatus: old.nextStatus }));
      setStale(false);
    } catch (e) {
      setReviewError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function moderate(event) {
    event.preventDefault();
    setBusy(true);
    setReviewError("");
    setNotice("");
    try {
      await apiRequest(`/admin/users/${selected.id}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status: selected.nextStatus,
          expectedUpdatedAt: selected.updatedAt,
          reasonCode,
        }),
      });
      if (
        selected.id === data.currentUserId &&
        selected.nextStatus === "DISABLED"
      )
        onSignedOut?.(
          "Tài khoản hiện tại đã được khóa. Hãy liên hệ quản trị viên khác để được hỗ trợ.",
        );
      setSelected(null);
      setRevision((v) => v + 1);
      setNotice("Đã xác nhận trạng thái tài khoản và thu hồi các phiên cũ.");
    } catch (e) {
      setReviewError(e.message);
      if (e.code === "USER_STATUS_CHANGED") setStale(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="food-admin">
      <p className="food-eyebrow">
        QUẢN TRỊ / {audit ? "NHẬT KÝ" : "TÀI KHOẢN"}
      </p>
      <h1>{audit ? "Nhật ký quản trị" : "Quản lý người dùng"}</h1>
      <p>
        {audit
          ? "Các thay đổi được ghi cùng giao dịch và bảo vệ khỏi sửa hoặc xóa trong thời hạn lưu trữ."
          : "Khóa tài khoản thu hồi quyền truy cập và mọi phiên đăng nhập. Mở lại không khôi phục token cũ; người dùng phải đăng nhập lại."}
      </p>
      {error && <UserNotice tone="error">{error}</UserNotice>}
      {notice && (
        <UserNotice tone="success" onDismiss={() => setNotice("")}>
          {notice}
        </UserNotice>
      )}
      {!audit && (
        <form
          className="food-search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setPage(1);
          }}
        >
          <label>
            Tìm tên hoặc email
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={100}
            />
          </label>
          <button disabled={loading || busy}>Tìm tài khoản</button>
        </form>
      )}
      <button
        disabled={loading || busy}
        onClick={() => setRevision((v) => v + 1)}
      >
        Tải lại danh sách
      </button>
      {loading && (
        <p role="status">Đang tải {audit ? "nhật ký" : "tài khoản"}…</p>
      )}
      {data && (
        <>
          <p>
            {data.total} {audit ? "sự kiện" : "tài khoản"} · Trang {page}
          </p>
          {data.items.length === 0 && <p>Không có kết quả ở trang này.</p>}
          <div className="food-admin-account-list">
            {data.items.map((item) => (
              <article className="food-panel" key={item.id}>
                {audit ? (
                  <>
                    <h2>{item.action}</h2>
                    <p>
                      Người thao tác:{" "}
                      {item.actorId ||
                        (item.metadata?.automation ? "Hệ thống" : "Đã ẩn danh")}
                    </p>
                    <p>Đối tượng: {item.targetId || "Đã ẩn danh"}</p>
                    <small>
                      {new Date(item.createdAt).toLocaleString("vi-VN")}
                    </small>
                    <pre>{JSON.stringify(item.metadata, null, 2)}</pre>
                  </>
                ) : (
                  <>
                    <h2>{item.displayName}</h2>
                    <p>{item.email}</p>
                    <p>
                      {item.role === "ADMIN" ? "Quản trị viên" : "Người dùng"} ·{" "}
                      {item.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"}
                    </p>
                    <button
                      disabled={loading || busy || !!item.deletionJob}
                      onClick={() => {
                        setSelected({
                          ...item,
                          nextStatus:
                            item.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                        });
                        setReasonCode(
                          item.status === "ACTIVE"
                            ? "SECURITY"
                            : "REVIEW_COMPLETE",
                        );
                        setReviewError("");
                        setStale(false);
                      }}
                    >
                      {item.deletionJob
                        ? "Đang xử lý xóa dữ liệu"
                        : item.status === "ACTIVE"
                          ? "Khóa tài khoản"
                          : "Mở lại tài khoản"}
                    </button>
                  </>
                )}
              </article>
            ))}
          </div>
          <div className="food-actions">
            <button
              disabled={loading || page <= 1}
              onClick={() => setPage((v) => v - 1)}
            >
              Trang trước
            </button>
            <button
              disabled={loading || page * data.limit >= data.total}
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
          aria-labelledby="moderation-title"
          onCancel={(event) => {
            if (busy) event.preventDefault();
            else setSelected(null);
          }}
        >
          <form onSubmit={moderate}>
            <h2 id="moderation-title">
              {selected.nextStatus === "DISABLED"
                ? "Khóa tài khoản?"
                : "Mở lại tài khoản?"}
            </h2>
            <p>
              {selected.displayName} · {selected.email}
            </p>
            <p>
              Trạng thái hiện tại:{" "}
              {selected.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"}.
            </p>
            <p>
              {selected.nextStatus === "DISABLED"
                ? "Tất cả thiết bị của tài khoản này sẽ bị đăng xuất ngay."
                : "Người dùng phải đăng nhập lại; các phiên cũ vẫn bị thu hồi."}{" "}
              Quản trị viên hoạt động cuối cùng được bảo vệ.
            </p>
            <label>
              Lý do xử lý
              <select
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                disabled={busy}
              >
                <option value="SECURITY">Bảo vệ tài khoản</option>
                <option value="ABUSE">Lạm dụng hệ thống</option>
                <option value="USER_REQUEST">Yêu cầu của người dùng</option>
                <option value="REVIEW_COMPLETE">Đã hoàn tất xem xét</option>
              </select>
            </label>
            {reviewError && <UserNotice tone="error">{reviewError}</UserNotice>}
            {stale && (
              <button type="button" disabled={busy} onClick={reloadSelected}>
                Tải lại trạng thái trước khi xác nhận
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Hủy xử lý
            </button>
            <button className="primary" disabled={busy || stale}>
              {busy ? "Đang xử lý…" : "Xác nhận thay đổi"}
            </button>
          </form>
        </dialog>
      )}
    </section>
  );
}
