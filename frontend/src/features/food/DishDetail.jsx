import { useState } from "react";
import { apiRequest } from "../../profileApi";
import { date, money } from "./foodUtils";

export default function DishDetail({ dish, notice, onBack }) {
  const [places, setPlaces] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const find = async () => {
    setBusy(true);
    setError("");
    try {
      setPlaces((await apiRequest(`/dishes/${dish.id}/restaurants`)).data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const preference = async (value) => {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/users/me/dishes/${dish.id}/preference`, {
        method: "PUT",
        body: JSON.stringify({ preference: value }),
      });
      notice(
        value === "LIKED"
          ? "Đã lưu món thích."
          : value === "DISLIKED"
            ? "Đã loại khỏi gợi ý."
            : "Đã xóa lựa chọn thích/không thích.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button onClick={onBack}>← Gợi ý hôm nay</button>
      <p className="food-eyebrow">{dish.cuisine.name}</p>
      <h1>{dish.name}</h1>
      <p>{dish.description}</p>
      <section className="food-section">
        <h2>Kiến thức món ăn</h2>
        <p>
          Tên gọi khác:{" "}
          {dish.aliases.map((a) => a.alias).join(", ") || "Chưa cập nhật"}
        </p>
        <p>
          Nguyên liệu:{" "}
          {dish.ingredients.map((i) => i.ingredient.name).join(", ") ||
            "Chưa có dữ liệu"}
        </p>
        <p>
          Dị nguyên đã biết:{" "}
          {dish.allergens
            .map(
              (a) =>
                `${a.allergen.name}${a.presence === "MAY_CONTAIN" ? " (có thể chứa)" : ""}`,
            )
            .join(", ") ||
            "Chưa có dữ liệu; không đồng nghĩa không có dị nguyên"}
        </p>
        <p>
          Xác minh:{" "}
          {
            {
              VERIFIED: "Đã xác minh công thức",
              REVIEWED: "Đã rà soát",
              UNVERIFIED: "Chưa xác minh",
            }[dish.verificationStatus]
          }
        </p>
        <p>Nguồn: {dish.evidenceSource || "Chưa có nguồn xác minh"}</p>
        <p>
          Giá công thức tham khảo: {money(dish.priceMin)}–{money(dish.priceMax)}
        </p>
        <p className="food-muted">
          Thành phần, giá và cách chế biến thực tế tùy quán. Hãy xác nhận dị
          ứng, chế độ ăn và nhiễm chéo trước khi ăn.
        </p>
        <div className="food-actions">
          <button disabled={busy} onClick={() => preference("LIKED")}>
            Thích món này
          </button>
          <button disabled={busy} onClick={() => preference("DISLIKED")}>
            Không thích
          </button>
          <button disabled={busy} onClick={() => preference(null)}>
            Xóa lựa chọn
          </button>
        </div>
      </section>
      <section className="food-section">
        <h2>Tìm quán gần bạn</h2>
        <p>
          Tìm trực tiếp qua Google Maps theo món và vị trí đã lưu. Kết quả chưa
          xác nhận quán có bán món, giá hoặc an toàn dị ứng.
        </p>
        <button className="food-primary" disabled={busy} onClick={find}>
          {busy ? "Đang xử lý…" : "Tìm quán trên Google Maps"}
        </button>
        {error && (
          <p role="alert" className="food-error">
            {error}
          </p>
        )}
        {places && (
          <>
            <p>Google Maps · Cập nhật {date(places.updatedAt)}</p>
            {!places.items.length && (
              <p>Không tìm thấy quán trong bán kính đã chọn.</p>
            )}
            {places.items.map((p) => (
              <article className="food-place" key={p.placeId}>
                <h3>{p.name}</h3>
                <p>{p.address}</p>
                <p>
                  {p.distanceMeters} m ·{" "}
                  {p.rating == null
                    ? "Chưa có rating"
                    : `${p.rating}/5 (${p.ratingCount ?? 0} đánh giá)`}{" "}
                  ·{" "}
                  {p.openNow === null
                    ? "Chưa rõ giờ mở cửa"
                    : p.openNow
                      ? "Đang mở"
                      : "Đang đóng"}
                </p>
                <a href={p.mapsUrl} target="_blank" rel="noreferrer">
                  Xem quán & chỉ đường trên Google Maps ↗
                </a>
                {p.attributions.map((a, i) => (
                  <p key={i}>
                    {a.providerUri?.startsWith("https://") ? (
                      <a href={a.providerUri} target="_blank" rel="noreferrer">
                        {a.provider}
                      </a>
                    ) : (
                      a.provider
                    )}
                  </p>
                ))}
              </article>
            ))}
          </>
        )}
      </section>
    </>
  );
}
