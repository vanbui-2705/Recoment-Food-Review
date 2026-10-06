import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import { money, date } from "./foodUtils";
import PlacePhoto from "./PlacePhoto";
import UserNotice from "./UserNotice";
import { sourceNames } from "./Discovery";

export function restaurantTarget() {
  const [screen, kind, source, rawId] = window.location.hash
    .slice(1)
    .split("/");
  if (screen !== "restaurant") return null;
  try {
    if (kind === "local" && /^[a-f0-9-]{36}$/i.test(source || ""))
      return { kind, id: source };
    const id = decodeURIComponent(rawId || "");
    if (
      kind === "place" &&
      ["google", "goong", "foursquare", "geoapify"].includes(source) &&
      /^[A-Za-z0-9:_-]{1,255}$/.test(id)
    )
      return { kind, source, id };
  } catch {
    /* Invalid deep link falls back to discovery. */
  }
  return null;
}
export default function RestaurantDetail({
  target,
  onBack,
  notice,
  onFindRecipes,
}) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const [reload, setReload] = useState(0),
    [cursor, setCursor] = useState(null);
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(new Map());
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    const params = new URLSearchParams({ limit: "20" });
    if (cursor) params.set("cursor", cursor);
    const path =
      target.kind === "local"
        ? `/restaurants/${target.id}`
        : `/restaurants/places/${target.source}/${encodeURIComponent(target.id)}`;
    apiRequest(`${path}?${params}`)
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [target.kind, target.source, target.id, cursor, reload]);
  useEffect(() => {
    setCursor(null);
    setBudget("");
  }, [target.kind, target.source, target.id]);
  const choose = async (offer) => {
    setBusy(true);
    setError("");
    try {
      if (!pending.current.has(offer.id))
        pending.current.set(offer.id, crypto.randomUUID());
      await apiRequest(`/users/me/dishes/${offer.dishId}/interactions`, {
        method: "POST",
        body: JSON.stringify({
          type: "CHOSEN",
          idempotencyKey: pending.current.get(offer.id),
        }),
      });
      pending.current.delete(offer.id);
      window.dispatchEvent(
        new CustomEvent("food-choice-saved", {
          detail: { dishId: offer.dishId },
        }),
      );
      notice(
        "Đã ghi nhận lựa chọn. Món này nghỉ gợi ý trong 4 ngày; bạn chưa đặt đơn tại quán.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const restaurant = data?.restaurant;
  return (
    <>
      <button onClick={onBack}>← Quay lại danh sách</button>
      {error && (
        <UserNotice tone="error" title="Chưa tải được thông tin">
          {error}{" "}
          <button onClick={() => setReload((n) => n + 1)}>Thử lại</button>
        </UserNotice>
      )}
      {!data && !error && (
        <p role="status">Đang tải thông tin quán và thực đơn…</p>
      )}
      {restaurant && (
        <>
          <p className="food-eyebrow">
            QUÁN ĂN · {sourceNames[restaurant.source] || restaurant.source}
          </p>
          <h1>{restaurant.name}</h1>
          <PlacePhoto photo={restaurant.photo} name={restaurant.name} />
          <p>{restaurant.address || "Nguồn chưa cung cấp địa chỉ"}</p>
          <p>
            {restaurant.rating === null
              ? "Chưa có đánh giá quán"
              : `${restaurant.rating}/5 · ${restaurant.ratingCount ?? 0} đánh giá quán`}
          </p>
          <p>
            {restaurant.openNow === true
              ? "Đang mở cửa"
              : restaurant.openNow === false
                ? "Đang đóng cửa"
                : "Chưa xác nhận giờ mở cửa"}
          </p>
          {restaurant.businessStatus &&
            ["TEMPORARILY_CLOSED", "PERMANENTLY_CLOSED"].includes(
              restaurant.businessStatus,
            ) && (
              <UserNotice tone="warning">
                Nguồn cho biết quán đang đóng cửa. Hãy liên hệ quán trước khi
                tới.
              </UserNotice>
            )}
          {restaurant.openingHours?.map((day) => (
            <p key={day} className="food-muted">
              {day}
            </p>
          ))}
          <div className="food-actions">
            {restaurant.mapsUrl && (
              <a href={restaurant.mapsUrl} target="_blank" rel="noreferrer">
                Chỉ đường ↗
              </a>
            )}
            {restaurant.phone && (
              <a href={`tel:${restaurant.phone.replace(/[^+0-9]/g, "")}`}>
                Gọi quán: {restaurant.phone}
              </a>
            )}
            {restaurant.websiteUrl && (
              <a href={restaurant.websiteUrl} target="_blank" rel="noreferrer">
                Website quán ↗
              </a>
            )}
          </div>
          <small>
            Ảnh và đánh giá trên đây là của quán. Cập nhật{" "}
            {date(restaurant.updatedAt)}
          </small>
          {restaurant.attributions?.map((a, i) => (
            <p key={i} className="food-muted">
              {a.providerUri ? (
                <a href={a.providerUri} target="_blank" rel="noreferrer">
                  {a.provider}
                </a>
              ) : (
                a.provider
              )}
            </p>
          ))}
          <section className="food-section">
            <h2>Thực đơn tại quán</h2>
            <UserNotice tone="warning">
              Giá, tình trạng bán và nguyên liệu có thể thay đổi. Kiểm tra với
              quán trước khi tới; lựa chọn trên app không tạo đơn hàng.
            </UserNotice>
            {!data.menu.items.length && (
              <UserNotice title="Chưa có thực đơn được xác nhận">
                Nguồn địa điểm chưa cung cấp từng món và giá bán tại quán. Bạn
                có thể gọi quán hoặc xem website, app không tự tạo thực đơn.
              </UserNotice>
            )}
            {!!data.menu.items.length && (
              <label>
                Đánh dấu món trong ngân sách mỗi người (đ)
                <input
                  type="number"
                  min="0"
                  max="100000000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Ví dụ: 50000"
                />
              </label>
            )}
            <div className="food-grid">
              {data.menu.items.map((offer) => (
                <article className="food-card" key={offer.id}>
                  <h3>{offer.title}</h3>
                  {offer.optionLabel && <p>{offer.optionLabel}</p>}
                  <strong>
                    {offer.price === null
                      ? "Giá chưa được xác nhận lại"
                      : money(offer.price)}
                  </strong>
                  {budget !== "" && offer.price !== null && (
                    <p>
                      {offer.price <= Number(budget)
                        ? "Trong ngân sách của bạn"
                        : "Vượt ngân sách của bạn"}
                    </p>
                  )}
                  {!offer.fresh && (
                    <UserNotice tone="warning">
                      Giá đã hết hạn xác minh. Hãy hỏi quán về giá hiện tại.
                    </UserNotice>
                  )}
                  {!offer.isAvailable && (
                    <p>Tạm ngừng bán theo nguồn thực đơn.</p>
                  )}
                  {offer.safety === "CONSTRAINTS_CONFIRMED" ? (
                    <p>
                      Có bằng chứng còn hạn cho ràng buộc ăn uống đã lưu. Hãy
                      xác nhận lại với quán.
                    </p>
                  ) : (
                    <p className="food-muted">
                      Chưa xác minh đầy đủ nguyên liệu/dị ứng cho bạn.
                    </p>
                  )}
                  <p>
                    <a href={offer.sourceUrl} target="_blank" rel="noreferrer">
                      Nguồn: {offer.source} ↗
                    </a>
                  </p>
                  <small>
                    Xác minh {date(offer.observedAt)} · Hết hạn{" "}
                    {date(offer.expiresAt)}
                  </small>
                  <div className="food-actions">
                    {offer.dishId && offer.fresh && offer.isAvailable && (
                      <button disabled={busy} onClick={() => choose(offer)}>
                        Ghi nhận chọn món
                      </button>
                    )}
                    <button onClick={() => onFindRecipes(offer.title)}>
                      Tìm cách nấu
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {data.menu.nextCursor && (
              <button onClick={() => setCursor(data.menu.nextCursor)}>
                Trang thực đơn tiếp theo
              </button>
            )}
            {cursor && (
              <button onClick={() => setCursor(null)}>Về trang đầu</button>
            )}
          </section>
        </>
      )}
    </>
  );
}
