import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import { date } from "./foodUtils";
import PlacePhoto from "./PlacePhoto";

export const sourceNames = {
  google: "Google Maps",
  goong: "Goong",
  foursquare: "Foursquare",
  geoapify: "Geoapify",
  themealdb: "TheMealDB",
  spoonacular: "Spoonacular",
};
const safeLink = (value) => {
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
};

export function PlaceResults({ data, onRestaurant }) {
  if (!data) return null;
  return (
    <section aria-label="Kết quả tìm quán" aria-live="polite">
      <p className="food-muted">{data.notice}</p>
      {data.status === "NOT_CONFIGURED" ? (
        <p role="status">
          Tìm quán đang được thiết lập. Bạn vẫn có thể xem gợi ý món và ghi lịch
          sử ăn.
        </p>
      ) : data.status === "UNAVAILABLE" ? (
        <p role="status">Các nguồn tìm quán đang bận. Vui lòng thử lại sau.</p>
      ) : !data.items.length ? (
        <p role="status">
          Chưa tìm thấy quán phù hợp trong bán kính đã chọn. Thử tăng khoảng
          cách hoặc đổi từ khóa.
        </p>
      ) : null}
      {data.sources
        ?.filter((s) => !["OK", "NOT_CONFIGURED"].includes(s.status))
        .map((s) => (
          <p key={s.source}>
            {sourceNames[s.source]} tạm thời chưa có kết quả. Các nguồn khác vẫn
            được hiển thị.
          </p>
        ))}
      {data.items.map((p) => (
        <article className="food-place" key={`${p.source}:${p.placeId}`}>
          {p.photo && <PlacePhoto photo={p.photo} name={p.name} />}
          <p className="food-eyebrow">
            {sourceNames[p.source] || "Google Maps"} ·{" "}
            {p.matchType === "NEARBY_RESTAURANT"
              ? "Nhà hàng gần bạn"
              : "Liên quan từ khóa"}
          </p>
          <h3>{p.name}</h3>
          {onRestaurant && (
            <button onClick={() => onRestaurant(p)}>
              Chi tiết quán / thực đơn
            </button>
          )}
          <p>{p.address}</p>
          <p>
            {p.distanceMeters < 1000
              ? `${p.distanceMeters} m`
              : `${(p.distanceMeters / 1000).toFixed(1)} km`}
            {p.rating != null &&
              ` · ${p.rating}/5 (${p.ratingCount ?? 0} đánh giá)`}
            {p.openNow === true
              ? " · Đang mở cửa"
              : p.openNow === false
                ? " · Đang đóng cửa"
                : " · Chưa rõ giờ mở cửa"}
          </p>
          <small>Chưa xác nhận quán bán món này hoặc giá món.</small>
          {safeLink(p.mapsUrl) && (
            <p>
              <a href={safeLink(p.mapsUrl)} target="_blank" rel="noreferrer">
                Xem địa điểm & chỉ đường ↗
              </a>
            </p>
          )}
          {p.attributions?.map((a, i) => (
            <p className="food-muted" key={i}>
              {safeLink(a.providerUri) ? (
                <a
                  href={safeLink(a.providerUri)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {a.provider}
                </a>
              ) : (
                a.provider
              )}
            </p>
          ))}
        </article>
      ))}
      {data.updatedAt && <small>Cập nhật {date(data.updatedAt)}</small>}
    </section>
  );
}

export function RecipeCards({ items, onRecipe }) {
  return (
    <div className="food-grid">
      {items.map((r) => (
        <article className="food-card" key={`${r.source}:${r.id}`}>
          {safeLink(r.image) && (
            <img
              className="food-recipe-image"
              src={r.image}
              alt={r.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.hidden = true;
              }}
            />
          )}
          <p className="food-eyebrow">
            {sourceNames[r.source]}
            {r.cuisine && ` · ${r.cuisine}`}
          </p>
          <h3>{r.title}</h3>
          <p>
            {r.readyInMinutes != null
              ? `${r.readyInMinutes} phút`
              : "Chưa có thời gian nấu"}
            {r.servings != null && ` · ${r.servings} phần ăn`}
          </p>
          <button className="food-primary" onClick={() => onRecipe(r)}>
            Xem cách nấu
          </button>
        </article>
      ))}
    </div>
  );
}

export default function Discovery({
  initialQuery = "",
  initialMode = "restaurants",
  onRecipe,
  navigate,
  onRestaurant,
}) {
  const [mode, setMode] = useState(initialMode);
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState("");
  const [radius, setRadius] = useState("3500");
  const [openNow, setOpenNow] = useState(false);
  const [location, setLocation] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const changeMode = (value) => {
    generation.current++;
    setMode(value);
    setSource("");
    setData(null);
    setError("");
    setBusy(false);
  };
  const locate = () => {
    if (!navigator.geolocation) {
      setError(
        "Trình duyệt không hỗ trợ vị trí. Bạn có thể lưu vị trí trong hồ sơ.",
      );
      return;
    }
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () =>
        setError(
          "Chưa lấy được vị trí. Hãy cho phép truy cập hoặc lưu vị trí trong hồ sơ.",
        ),
      { timeout: 10000, maximumAge: 60000 },
    );
  };
  const search = async (e) => {
    e.preventDefault();
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setData(null);
    const params = new URLSearchParams({ q: query.trim() });
    if (source) params.set("source", source);
    if (mode === "restaurants") {
      params.set("radius", radius);
      params.set("openNow", String(openNow));
      if (location) {
        params.set("latitude", String(location.latitude));
        params.set("longitude", String(location.longitude));
      }
    }
    try {
      const response = await apiRequest(
        `${mode === "restaurants" ? "/discovery/restaurants" : "/recipes"}?${params}`,
      );
      if (current === generation.current) setData(response.data);
    } catch (err) {
      if (current === generation.current) setError(err.message);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  return (
    <>
      <p className="food-eyebrow">THEO MÓN BẠN ĐANG THÈM</p>
      <h1>Tìm món / Nấu ăn</h1>
      <p>
        Tìm quán quanh bạn hoặc khám phá công thức để tự nấu. Bạn có thể tìm lại
        món đã ăn bất cứ lúc nào.
      </p>
      <div className="food-actions" aria-label="Mục đích tìm kiếm">
        <button
          aria-pressed={mode === "restaurants"}
          className={mode === "restaurants" ? "food-primary" : ""}
          onClick={() => changeMode("restaurants")}
        >
          Tìm quán
        </button>
        <button
          aria-pressed={mode === "recipes"}
          className={mode === "recipes" ? "food-primary" : ""}
          onClick={() => changeMode("recipes")}
        >
          Nấu tại nhà
        </button>
      </div>
      <form onSubmit={search} className="food-section">
        <label>
          Món bạn muốn {mode === "restaurants" ? "ăn" : "nấu"}
          <input
            aria-label="Món bạn đang thèm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Phở bò, bún chả, chicken soup…"
            required
            maxLength={150}
          />
        </label>
        <div className="food-fields">
          <label>
            Nguồn tìm kiếm
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Tất cả nguồn đã kết nối</option>
              {(mode === "restaurants"
                ? ["google", "goong", "foursquare", "geoapify"]
                : ["themealdb", "spoonacular"]
              ).map((s) => (
                <option key={s} value={s}>
                  {sourceNames[s]}
                </option>
              ))}
            </select>
          </label>
          {mode === "restaurants" && (
            <label>
              Khoảng cách
              <select
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              >
                {[1000, 3500, 5000, 10000, 25000, 50000].map((r) => (
                  <option key={r} value={r}>
                    {r / 1000} km
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {mode === "restaurants" ? (
          <>
            <p className="food-muted">
              {location
                ? "Đang dùng vị trí hiện tại cho lần tìm này."
                : "Đang dùng vị trí đã lưu trong hồ sơ."}
            </p>
            <div className="food-actions">
              <button type="button" onClick={locate}>
                Dùng vị trí hiện tại
              </button>
              <button type="button" onClick={() => navigate("profile")}>
                Sửa vị trí trong hồ sơ
              </button>
              {location && (
                <button type="button" onClick={() => setLocation(null)}>
                  Dùng vị trí đã lưu
                </button>
              )}
            </div>
            <label className="food-check-option">
              <input
                type="checkbox"
                checked={openNow}
                onChange={(e) => setOpenNow(e.target.checked)}
              />
              Chỉ quán được xác nhận đang mở cửa
            </label>
          </>
        ) : (
          <p className="food-muted">
            Công thức giữ nguyên ngôn ngữ của nguồn. Nếu tên tiếng Việt chưa có
            kết quả, hãy thử tên tiếng Anh.
          </p>
        )}
        <button disabled={busy || !query.trim()} className="food-primary">
          {busy
            ? "Đang tìm…"
            : mode === "restaurants"
              ? "Tìm quán phù hợp"
              : "Tìm công thức"}
        </button>
      </form>
      {error && (
        <p className="food-error" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">Đang tìm từ các nguồn đã kết nối…</p>}
      {mode === "restaurants" && (
        <PlaceResults data={data} onRestaurant={onRestaurant} />
      )}
      {mode === "recipes" && data && (
        <section aria-live="polite">
          <p className="food-muted">{data.notice}</p>
          {data.status === "NOT_CONFIGURED" ? (
            <p role="status">Nguồn công thức đang được thiết lập.</p>
          ) : data.status === "UNAVAILABLE" ? (
            <p role="status">
              Chưa kết nối được nguồn công thức. Vui lòng thử lại.
            </p>
          ) : (
            !data.items.length && (
              <p role="status">
                Chưa tìm thấy công thức. Thử tên món khác hoặc tên tiếng Anh.
              </p>
            )
          )}
          {data.sources
            ?.filter((s) => !["OK", "NOT_CONFIGURED"].includes(s.status))
            .map((s) => (
              <p key={s.source}>
                {sourceNames[s.source]} tạm thời không khả dụng.
              </p>
            ))}
          <RecipeCards items={data.items} onRecipe={onRecipe} />
        </section>
      )}
    </>
  );
}
