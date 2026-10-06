import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import UserNotice from "./UserNotice";

const kinds = {
  dishes: "Món ăn",
  restaurants: "Quán ăn",
  offers: "Món từ nhà cung cấp",
  cuisines: "Ẩm thực",
  ingredients: "Nguyên liệu",
};
export default function AdminContent() {
  const [kind, setKind] = useState("dishes"),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [active, setActive] = useState("");
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [reviewError, setReviewError] = useState(""),
    [stale, setStale] = useState(false);
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [code, setCode] = useState(""),
    [reason, setReason] = useState("DATA_REVIEW");
  const dialog = useRef(null),
    focusBack = useRef(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setData(null);
    setError("");
    apiRequest(
      `/admin/content/${kind}?page=${page}&limit=20${query ? `&q=${encodeURIComponent(query)}` : ""}${active ? `&active=${active}` : ""}`,
    )
      .then((result) => {
        if (alive) setData(result.data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [kind, page, query, active, revision]);
  useEffect(() => {
    if (selected) {
      focusBack.current = document.activeElement;
      dialog.current?.showModal();
    } else focusBack.current?.focus();
  }, [Boolean(selected)]);
  function open(item, mode) {
    setSelected({ ...item, mode });
    setName(item.name || "");
    setDescription(item.description || "");
    setCode("");
    setReason("DATA_REVIEW");
    setReviewError("");
    setStale(false);
  }
  async function refreshSelected() {
    setBusy(true);
    setReviewError("");
    try {
      const result = await apiRequest(`/admin/content/${kind}/${selected.id}`);
      setSelected((old) => ({ ...result.data, mode: old.mode }));
      setName(result.data.name);
      setDescription(result.data.description || "");
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
    const mode = selected.mode;
    try {
      await apiRequest(
        `/admin/content/${kind}${mode === "create" ? "" : `/${selected.id}/${mode}`}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          body: JSON.stringify(
            mode === "status"
              ? {
                  confirm: true,
                  isActive: !selected.isActive,
                  expectedUpdatedAt: selected.updatedAt,
                  reasonCode: reason,
                }
              : {
                  name: name.trim(),
                  ...(kind !== "restaurants" ? { description } : {}),
                  ...(mode === "create"
                    ? { code }
                    : { expectedUpdatedAt: selected.updatedAt }),
                },
          ),
        },
      );
      setSelected(null);
      setRevision((v) => v + 1);
      setNotice(
        mode === "status"
          ? "Đã cập nhật trạng thái. Lịch sử và thời gian chờ lặp món được giữ nguyên."
          : "Đã lưu thông tin danh mục.",
      );
    } catch (e) {
      setReviewError(e.message);
      if (e.status === 409 && mode !== "create") setStale(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="food-admin">
      <p className="food-eyebrow">QUẢN TRỊ / DỮ LIỆU</p>
      <h1>Danh mục và quán</h1>
      <p>
        Món bán, giá và địa chỉ được lấy từ nhà cung cấp. Danh mục kiến thức
        giúp nhận diện món và khẩu vị. Tạm ngừng sẽ loại dữ liệu khỏi gợi ý, giữ
        lại lịch sử đã ăn.
      </p>
      {error && <UserNotice tone="error">{error}</UserNotice>}
      {notice && (
        <UserNotice tone="success" onDismiss={() => setNotice("")}>
          {notice}
        </UserNotice>
      )}
      <form
        className="food-search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
          setPage(1);
        }}
      >
        <label>
          Loại dữ liệu
          <select
            value={kind}
            disabled={busy}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
              setSearch("");
              setQuery("");
              setNotice("");
            }}
          >
            {Object.entries(kinds).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trạng thái
          <select
            value={active}
            disabled={busy}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            <option value="true">Đang bật</option>
            <option value="false">Tạm ngừng</option>
          </select>
        </label>
        <label>
          Tìm theo tên
          <input
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button disabled={busy || loading}>Tìm dữ liệu</button>
      </form>
      <div className="food-actions">
        <button
          disabled={busy || loading}
          onClick={() => setRevision((v) => v + 1)}
        >
          Tải lại danh sách
        </button>
        {["cuisines", "ingredients"].includes(kind) && (
          <button
            disabled={busy || loading || !data}
            onClick={() => open({}, "create")}
          >
            Thêm {kinds[kind].toLowerCase()}
          </button>
        )}
      </div>
      {loading && <p role="status">Đang tải danh mục…</p>}
      {data && (
        <>
          <p>
            {data.total} kết quả · Trang {page}
          </p>
          {!data.items.length && (
            <p>
              Không có dữ liệu phù hợp. Thử đổi tên tìm kiếm hoặc trạng thái.
            </p>
          )}
          <div className="food-admin-account-list">
            {data.items.map((item) => (
              <article className="food-panel" key={item.id}>
                <h2>{item.name}</h2>
                <p>{item.isActive ? "Đang bật" : "Tạm ngừng"}</p>
                {item.address && <p>{item.address}</p>}
                {item.description && <p>{item.description}</p>}
                {kind === "offers" && (
                  <p>
                    {new Intl.NumberFormat("vi-VN", {
                      style: "currency",
                      currency: item.currency || "VND",
                    }).format(item.price)}{" "}
                    ·{" "}
                    {item.sourceActive
                      ? "Nguồn còn cung cấp"
                      : "Nguồn đã ngừng cung cấp"}{" "}
                    · Hết hạn {new Date(item.expiresAt).toLocaleString("vi-VN")}
                  </p>
                )}
                <div className="food-actions">
                  <button
                    disabled={busy || loading}
                    onClick={() => open(item, "status")}
                  >
                    {item.isActive ? "Tạm ngừng gợi ý" : "Bật lại gợi ý"}
                  </button>
                  {kind !== "offers" && (
                    <button
                      disabled={busy || loading}
                      onClick={() => open(item, "label")}
                    >
                      Sửa thông tin
                    </button>
                  )}
                </div>
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
              disabled={busy || loading || page * data.limit >= data.total}
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
          aria-labelledby="content-title"
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setSelected(null);
          }}
        >
          <form onSubmit={save}>
            <h2 id="content-title">
              {selected.mode === "status"
                ? selected.isActive
                  ? "Tạm ngừng gợi ý?"
                  : "Bật lại gợi ý?"
                : selected.mode === "create"
                  ? "Thêm danh mục"
                  : "Sửa thông tin"}
            </h2>
            {selected.mode === "status" ? (
              <>
                <p>{selected.name}</p>
                <p>
                  Lịch sử và thời gian chờ 96 giờ được giữ nguyên. Bật lại vẫn
                  cần đáp ứng điều kiện giá, vị trí, độ mới và an toàn trước khi
                  được gợi ý.
                </p>
                <label>
                  Lý do
                  <select
                    value={reason}
                    disabled={busy}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    <option value="DATA_REVIEW">Rà soát dữ liệu</option>
                    <option value="DUPLICATE">Dữ liệu trùng</option>
                    <option value="SOURCE_REVIEW">
                      Rà soát nguồn cung cấp
                    </option>
                  </select>
                </label>
              </>
            ) : (
              <>
                {selected.mode === "create" && (
                  <label>
                    Mã danh mục
                    <input
                      required
                      pattern="[A-Z][A-Z0-9_]{1,49}"
                      maxLength={50}
                      value={code}
                      disabled={busy}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                    />
                    <small>
                      Chữ in hoa, chữ số và dấu gạch dưới; mã được giữ cố định.
                    </small>
                  </label>
                )}
                <label>
                  Tên
                  <input
                    required
                    minLength={2}
                    maxLength={
                      kind === "cuisines"
                        ? 100
                        : kind === "restaurants"
                          ? 200
                          : 150
                    }
                    value={name}
                    disabled={busy}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                {kind !== "restaurants" && (
                  <label>
                    Mô tả
                    <textarea
                      maxLength={3000}
                      value={description}
                      disabled={busy}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                )}
              </>
            )}
            {reviewError && <UserNotice tone="error">{reviewError}</UserNotice>}
            {stale && (
              <>
                <p>
                  Dữ liệu đã thay đổi. Tải phiên bản mới và xem lại trước khi
                  xác nhận.
                </p>
                <button type="button" disabled={busy} onClick={refreshSelected}>
                  Tải lại dữ liệu đang sửa
                </button>
              </>
            )}
            <div className="food-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Hủy
              </button>
              <button className="primary" disabled={busy || stale}>
                {busy ? "Đang lưu…" : "Xác nhận lưu"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
