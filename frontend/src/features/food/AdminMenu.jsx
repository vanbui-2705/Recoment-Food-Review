import { useEffect, useState } from "react";
import { apiRequest } from "../../profileApi";
import UserNotice from "./UserNotice";
import { money, date } from "./foodUtils";
import "./admin-menu.css";

const send = (path, body, method = "POST") =>
  apiRequest(path, { method, body: JSON.stringify(body) });
const stateNames = {
  STAGING: "Đang chuẩn bị",
  COMMITTED: "Đã áp dụng",
  FAILED: "Đã dừng",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REVOKED: "Đã thu hồi",
};
const kindNames = {
  ALLERGEN: "Thành phần gây dị ứng",
  CROSS_CONTACT: "Lây nhiễm chéo",
  DIET: "Chế độ ăn",
};

function EvidenceReview({ evidence, act, disabled }) {
  const [reason, setReason] = useState("");
  return (
    <div className="admin-evidence">
      <strong>
        {kindNames[evidence.kind]} · {evidence.code}
      </strong>
      <p>
        {evidence.claim === "UNKNOWN"
          ? "Chưa xác định"
          : evidence.claim === "PRESENT"
            ? "Có / đáp ứng"
            : "Không có / không đáp ứng"}{" "}
        · {stateNames[evidence.status]}
      </p>
      <blockquote>{evidence.excerpt}</blockquote>
      <p>
        <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">
          Bằng chứng nguồn
        </a>{" "}
        · Hết hạn {date(evidence.expiresAt)}
      </p>
      {evidence.status !== "REVOKED" && (
        <form onSubmit={(event) => event.preventDefault()}>
          <label>
            Lý do duyệt hoặc thu hồi
            <input
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="food-actions">
            {evidence.status === "PENDING" && (
              <button
                disabled={
                  disabled ||
                  !reason.trim() ||
                  Date.parse(evidence.expiresAt) <= Date.now()
                }
                onClick={() =>
                  act(
                    `/admin/menu/evidence/${evidence.id}/review`,
                    {
                      status: "APPROVED",
                      expectedStatus: evidence.status,
                      reason,
                    },
                    "Đã duyệt bằng chứng.",
                  )
                }
              >
                Duyệt bằng chứng
              </button>
            )}
            <button
              disabled={disabled || !reason.trim()}
              onClick={() =>
                act(
                  `/admin/menu/evidence/${evidence.id}/review`,
                  {
                    status: "REVOKED",
                    expectedStatus: evidence.status,
                    reason,
                  },
                  "Đã thu hồi bằng chứng.",
                )
              }
            >
              Thu hồi
            </button>
          </div>
        </form>
      )}
      {evidence.reviews?.length > 0 && (
        <details>
          <summary>Lịch sử xét duyệt ({evidence.reviews.length})</summary>
          {evidence.reviews.map((review) => (
            <p key={review.id}>
              {date(review.createdAt)} · {stateNames[review.status]} ·{" "}
              {review.reason}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}

function OfferReview({ offer, act, disabled, catalogs }) {
  const [query, setQuery] = useState(""),
    [matches, setMatches] = useState([]),
    [searchError, setSearchError] = useState("");
  const [dishId, setDishId] = useState(offer.dishId || "");
  const [kind, setKind] = useState("ALLERGEN");
  const codes = kind === "DIET" ? catalogs.diets : catalogs.allergens;
  useEffect(() => {
    setDishId(offer.dishId || "");
  }, [offer.dishId]);
  const choices = [
    ...(offer.dish ? [offer.dish] : []),
    ...matches.filter((dish) => dish.id !== offer.dishId),
  ];
  return (
    <article className="admin-offer food-panel">
      <h3>
        {offer.title}
        {offer.optionLabel ? ` · ${offer.optionLabel}` : ""}
      </h3>
      <p>
        {offer.identity.restaurant.name} · {offer.identity.supplier.name} ·{" "}
        {money(offer.price)} ·{" "}
        {offer.isAvailable && offer.active ? "Có bán" : "Ngừng bán"}
      </p>
      <p>
        Hết hạn {date(offer.expiresAt)} ·{" "}
        <a href={offer.sourceUrl} target="_blank" rel="noopener noreferrer">
          Nguồn thực đơn
        </a>
      </p>
      <form
        className="admin-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setSearchError("");
          try {
            const response = await apiRequest(
              `/dishes?q=${encodeURIComponent(query.trim())}&limit=20`,
            );
            setMatches(response.data.items);
          } catch (error) {
            setSearchError(error.message);
          }
        }}
      >
        <label>
          Tìm món chuẩn
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={200}
            placeholder="Tên món trong ngân hàng kiến thức"
          />
        </label>
        <button disabled={disabled || !query.trim()}>Tìm tên món</button>
      </form>
      {searchError && <UserNotice tone="error">{searchError}</UserNotice>}
      <label>
        Liên kết món chuẩn
        <select
          value={dishId}
          onChange={(event) => setDishId(event.target.value)}
        >
          <option value="">Chưa xác minh</option>
          {choices.map((dish) => (
            <option value={dish.id} key={dish.id}>
              {dish.name}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={disabled || dishId === (offer.dishId || "")}
        onClick={() =>
          act(
            `/admin/menu/offers/${offer.id}/mapping`,
            { dishId: dishId || null, expectedUpdatedAt: offer.updatedAt },
            "Đã cập nhật liên kết món chuẩn.",
            "PUT",
          )
        }
      >
        Lưu liên kết
      </button>
      <details>
        <summary>
          Bằng chứng dị ứng và chế độ ăn ({offer.evidence.length})
        </summary>
        <UserNotice tone="warning">
          Chỉ ghi nhận tài liệu cụ thể cho món và lựa chọn này. Không suy ra
          “không có dị ứng” từ tên món hoặc từ việc thiếu thông tin.
        </UserNotice>
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            act(
              `/admin/menu/offers/${offer.id}/evidence`,
              {
                kind,
                code: form.get("code"),
                claim: form.get("claim"),
                sourceUrl: form.get("sourceUrl"),
                excerpt: form.get("excerpt"),
                observedAt: new Date(form.get("observedAt")).toISOString(),
                expiresAt: new Date(form.get("expiresAt")).toISOString(),
              },
              "Đã gửi bằng chứng để xét duyệt; chưa dùng để xác nhận ràng buộc.",
            );
          }}
        >
          <label>
            Loại bằng chứng
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              {Object.entries(kindNames).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mã ràng buộc
            <select name="code" required key={kind}>
              {codes.map((item) => (
                <option value={item.code} key={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kết luận nguồn
            <select name="claim">
              <option value="UNKNOWN">Chưa xác định</option>
              <option value="PRESENT">
                {kind === "DIET"
                  ? "Đáp ứng chế độ ăn"
                  : "Có thành phần / có nguy cơ"}
              </option>
              <option value="ABSENT">
                {kind === "DIET" ? "Không đáp ứng" : "Xác nhận không có"}
              </option>
            </select>
          </label>
          <label>
            URL tài liệu nguồn
            <input
              name="sourceUrl"
              type="url"
              required
              maxLength={2000}
              placeholder="https://… (không chứa API key)"
            />
          </label>
          <label>
            Trích đoạn nguồn
            <textarea name="excerpt" required maxLength={2000} />
          </label>
          <label>
            Thời điểm xác minh
            <input name="observedAt" type="datetime-local" required />
          </label>
          <label>
            Thời điểm hết hạn
            <input name="expiresAt" type="datetime-local" required />
          </label>
          <button disabled={disabled || !codes.length}>Gửi bằng chứng</button>
        </form>
        {offer.evidence.map((evidence) => (
          <EvidenceReview
            key={evidence.id}
            evidence={evidence}
            act={act}
            disabled={disabled}
          />
        ))}
      </details>
    </article>
  );
}

export default function AdminMenu() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [reload, setReload] = useState(0),
    [page, setPage] = useState(1),
    [working, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const busy = working || refreshing;
  const [supplierId, setSupplierId] = useState(""),
    [batch, setBatch] = useState(""),
    [preview, setPreview] = useState(null),
    [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    let active = true;
    setError("");
    setRefreshing(true);
    Promise.all([
      apiRequest("/admin/menu/suppliers"),
      apiRequest("/admin/menu/sync-runs?limit=20"),
      apiRequest(`/admin/menu/offers?page=${page}&limit=20`),
      apiRequest("/catalogs/allergens"),
      apiRequest("/catalogs/dietary-restrictions"),
    ])
      .then(([suppliers, runs, offers, allergens, diets]) => {
        if (active)
          setData({
            suppliers: suppliers.data.items,
            runs: runs.data.items,
            offers: offers.data.items,
            catalogs: {
              allergens: allergens.data.items,
              diets: diets.data.items,
            },
          });
      })
      .catch((failure) => {
        if (active) {
          setError(failure.message);
          if ([401, 403].includes(failure.status)) setData(null);
        }
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [reload, page]);
  async function act(path, body, success, method = "POST") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await send(path, body, method);
      setMessage(success);
      setReload((value) => value + 1);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  function parseBatch() {
    const value = JSON.parse(batch);
    if (
      !value.snapshotId ||
      !["COMPLETE", "DELTA"].includes(value.mode) ||
      !Number.isFinite(Date.parse(value.observedAt)) ||
      !Array.isArray(value.pages) ||
      !value.pages.length ||
      value.pages.length > 10 ||
      value.pages.some((rows) => !Array.isArray(rows) || rows.length > 100)
    )
      throw new Error(
        "JSON cần snapshotId, mode COMPLETE/DELTA, observedAt và 1–10 pages; mỗi trang tối đa 100 món.",
      );
    return value;
  }
  return (
    <section className="food-page admin-menu">
      <header className="food-page-heading">
        <p className="food-eyebrow">Quản trị dữ liệu</p>
        <h1>Thực đơn và bằng chứng</h1>
        <p>
          Kiểm tra nguồn, xem trước thay đổi rồi mới áp dụng. Quyền quản trị
          được kiểm tra trên máy chủ.
        </p>
      </header>
      {error && (
        <UserNotice tone="error" title="Chưa hoàn tất thao tác">
          {error}{" "}
          <button
            disabled={busy}
            onClick={() => setReload((value) => value + 1)}
          >
            Tải lại dữ liệu
          </button>
        </UserNotice>
      )}
      {message && (
        <UserNotice tone="success" onDismiss={() => setMessage("")}>
          {message}
        </UserNotice>
      )}
      {!data && !error && <p role="status">Đang tải dữ liệu quản trị…</p>}
      {data && refreshing && (
        <p role="status">Đang cập nhật dữ liệu quản trị…</p>
      )}
      {data && (
        <>
          <details className="food-panel">
            <summary>Đăng ký nguồn đã được cấp quyền</summary>
            <p>
              Luồng người dùng lấy dữ liệu từ nhà cung cấp. Biểu mẫu này dành
              cho quản trị kết nối nguồn và nạp dữ liệu đúng hợp đồng; không
              phải nhập món thủ công cho người dùng.
            </p>
            <form
              className="admin-form"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                act(
                  "/admin/menu/suppliers",
                  {
                    code: form.get("code"),
                    name: form.get("name"),
                    documentationUrl: form.get("documentationUrl"),
                    authorizationReference: form.get("authorizationReference"),
                    maxEvidenceAgeHours: Number(form.get("ttl")),
                    enabled: true,
                  },
                  "Đã đăng ký nguồn. Đồng bộ tự động cần adapter theo hợp đồng nhà cung cấp.",
                  "PUT",
                );
              }}
            >
              <label>
                Mã nguồn
                <input
                  name="code"
                  pattern="[a-z0-9_-]{1,80}"
                  required
                  maxLength={80}
                />
              </label>
              <label>
                Tên nhà cung cấp
                <input name="name" required maxLength={200} />
              </label>
              <label>
                URL tài liệu API
                <input
                  name="documentationUrl"
                  type="url"
                  required
                  maxLength={2000}
                />
              </label>
              <label>
                Tham chiếu quyền sử dụng
                <input
                  name="authorizationReference"
                  required
                  maxLength={500}
                  placeholder="Mã hợp đồng / văn bản cho phép"
                />
              </label>
              <label>
                Độ tuổi dữ liệu tối đa (giờ)
                <input
                  name="ttl"
                  type="number"
                  min="1"
                  max="168"
                  defaultValue="24"
                  required
                />
              </label>
              <label className="admin-checkbox">
                <input type="checkbox" required /> Tôi đã kiểm tra quyền dùng và
                lưu dữ liệu của nguồn.
              </label>
              <button disabled={busy}>Đăng ký nguồn</button>
            </form>
          </details>
          {data.suppliers.length > 0 && (
            <div className="food-panel">
              <h2>Nguồn dữ liệu</h2>
              {data.suppliers.map((supplier) => (
                <p key={supplier.id}>
                  {supplier.name} · {supplier.enabled ? "Đang bật" : "Đã tắt"} ·{" "}
                  {supplier.maxEvidenceAgeHours} giờ{" "}
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(
                        "/admin/menu/suppliers",
                        {
                          code: supplier.code,
                          name: supplier.name,
                          documentationUrl: supplier.documentationUrl,
                          authorizationReference:
                            supplier.authorizationReference,
                          maxEvidenceAgeHours: supplier.maxEvidenceAgeHours,
                          enabled: !supplier.enabled,
                        },
                        supplier.enabled
                          ? "Đã tắt nguồn; món từ nguồn này không còn được gợi ý."
                          : "Đã bật nguồn.",
                        "PUT",
                      )
                    }
                  >
                    {supplier.enabled ? "Tắt nguồn" : "Bật nguồn"}
                  </button>
                </p>
              ))}
            </div>
          )}
          <div className="food-panel">
            <h2>Kiểm tra và áp dụng snapshot</h2>
            <label>
              Nguồn được cấp quyền
              <select
                value={supplierId}
                onChange={(event) => {
                  setSupplierId(event.target.value);
                  setPreview(null);
                  setConfirmed(false);
                }}
              >
                <option value="">Chọn nguồn</option>
                {data.suppliers
                  .filter((supplier) => supplier.enabled)
                  .map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Tệp JSON từ adapter nhà cung cấp
              <input
                type="file"
                accept="application/json,.json"
                disabled={busy}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1000000) {
                    setError(
                      "Tệp vượt quá 1 MB. Hãy chia snapshot theo hợp đồng phân trang.",
                    );
                    return;
                  }
                  setBatch(await file.text());
                  setPreview(null);
                  setConfirmed(false);
                }}
              />
            </label>
            <label>
              Nội dung snapshot
              <textarea
                rows={7}
                value={batch}
                maxLength={1000000}
                onChange={(event) => {
                  setBatch(event.target.value);
                  setPreview(null);
                  setConfirmed(false);
                }}
                placeholder={
                  '{"snapshotId":"…","mode":"DELTA","observedAt":"…","pages":[[]]}'
                }
              />
            </label>
            <button
              disabled={busy || !supplierId || !batch.trim()}
              onClick={async () => {
                setBusy(true);
                setError("");
                setPreview(null);
                setConfirmed(false);
                try {
                  const input = parseBatch();
                  const rows = [];
                  for (let index = 0; index < input.pages.length; index++) {
                    const response = await send("/admin/menu/preview", {
                      supplierId,
                      items: input.pages[index],
                    });
                    rows.push(
                      ...response.data.items.map((row) => ({
                        ...row,
                        page: index,
                      })),
                    );
                  }
                  setPreview(rows);
                } catch (failure) {
                  setError(failure.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Xem trước, chưa ghi dữ liệu
            </button>
            {preview && (
              <>
                <UserNotice
                  tone={preview.some((row) => !row.valid) ? "warning" : "info"}
                >
                  {preview.filter((row) => row.valid).length}/{preview.length}{" "}
                  dòng hợp lệ. Liên kết chưa xác minh sẽ chờ duyệt. Snapshot
                  COMPLETE phải chứa toàn bộ nguồn; món vắng mặt sẽ bị đánh dấu
                  ngừng bán sau khi áp dụng.
                </UserNotice>
                <div className="admin-preview" tabIndex={0}>
                  <table>
                    <thead>
                      <tr>
                        <th>Trang</th>
                        <th>Món</th>
                        <th>Giá</th>
                        <th>Kiểm tra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, index) => (
                        <tr key={index}>
                          <td>{row.page + 1}</td>
                          <td>{row.title || "Dòng không hợp lệ"}</td>
                          <td>
                            {row.price === undefined ? "—" : money(row.price)}
                          </td>
                          <td>
                            {row.valid
                              ? row.dishId
                                ? "Đã tìm thấy món chuẩn"
                                : "Cần duyệt liên kết"
                              : row.code || row.errorCode}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />{" "}
                  Tôi đã kiểm tra phạm vi snapshot, nguồn và dữ liệu xem trước.
                </label>
                <button
                  disabled={
                    busy || !confirmed || preview.some((row) => !row.valid)
                  }
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    setMessage("");
                    try {
                      const input = parseBatch();
                      const start = await send("/admin/menu/sync-runs", {
                        supplierId,
                        snapshotId: input.snapshotId,
                        mode: input.mode,
                        expectedPages: input.pages.length,
                        observedAt: input.observedAt,
                      });
                      const run = start.data.run;
                      for (let index = 0; index < input.pages.length; index++)
                        await send(`/admin/menu/sync-runs/${run.id}/pages`, {
                          page: index,
                          items: input.pages[index],
                        });
                      await send(`/admin/menu/sync-runs/${run.id}/commit`, {});
                      setMessage(
                        "Đã áp dụng snapshot. Nhập lại cùng snapshot không tạo món trùng.",
                      );
                      setPreview(null);
                      setConfirmed(false);
                      setReload((value) => value + 1);
                    } catch (failure) {
                      setError(
                        `${failure.message} Có thể thử lại bằng đúng tệp và snapshotId hiện tại; thực đơn cũ chỉ thay đổi khi toàn bộ snapshot áp dụng thành công.`,
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Đang áp dụng…" : "Áp dụng snapshot"}
                </button>
              </>
            )}
          </div>
          <div className="food-panel">
            <h2>20 lần đồng bộ gần nhất</h2>
            {data.runs.length === 0 ? (
              <p>Chưa có lần đồng bộ.</p>
            ) : (
              data.runs.map((run) => (
                <div className="admin-run" key={run.id}>
                  <strong>
                    {run.supplier.name} · {run.snapshotId}
                  </strong>
                  <p>
                    {stateNames[run.status]} · {run._count.pages}/
                    {run.expectedPages} trang · {run._count.quarantine} dòng
                    cách ly · {date(run.createdAt)}
                  </p>
                  {run.status === "STAGING" && (
                    <>
                      <p>
                        Thử lại bằng cùng snapshotId và tệp ban đầu. Khi dừng,
                        không thể áp dụng snapshot này nữa.
                      </p>
                      <button
                        disabled={busy}
                        onClick={() =>
                          act(
                            `/admin/menu/sync-runs/${run.id}/abandon`,
                            {},
                            "Đã dừng snapshot; thực đơn đang áp dụng được giữ nguyên.",
                          )
                        }
                      >
                        Dừng snapshot
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
          <h2>Món tại quán · Trang {page}</h2>
          {!data.offers.length && (
            <UserNotice>
              Chưa có món tại trang này. Đăng ký nguồn và áp dụng snapshot hợp
              lệ trước.
            </UserNotice>
          )}
          {data.offers.map((offer) => (
            <OfferReview
              key={offer.id}
              offer={offer}
              act={act}
              disabled={busy}
              catalogs={data.catalogs}
            />
          ))}
          <div className="food-actions">
            <button
              disabled={busy || page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Trang trước
            </button>
            <button
              disabled={busy || data.offers.length < 20}
              onClick={() => setPage((value) => value + 1)}
            >
              Trang sau
            </button>
          </div>
        </>
      )}
    </section>
  );
}
