import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import { money } from "./foodUtils";
import RecipeIdeas from "./RecipeIdeas";

export default function Today({ navigate, onDish, onRecipe, notice }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const pending = useRef(new Map());
  const load = async () => {
    setError("");
    try {
      setData((await apiRequest("/recommendations/today")).data);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    let active = true;
    apiRequest("/recommendations/today")
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const action = async (dish, type) => {
    setBusy(dish.id);
    setError("");
    try {
      if (type === "DISLIKED" || type === "LIKED")
        await apiRequest(`/users/me/dishes/${dish.id}/preference`, {
          method: "PUT",
          body: JSON.stringify({ preference: type }),
        });
      else {
        const actionId = `${dish.id}:${type}`;
        if (!pending.current.has(actionId))
          pending.current.set(actionId, crypto.randomUUID());
        await apiRequest(`/users/me/dishes/${dish.id}/interactions`, {
          method: "POST",
          body: JSON.stringify({
            type,
            idempotencyKey: pending.current.get(actionId),
          }),
        });
        pending.current.delete(actionId);
      }
      notice(
        type === "DISLIKED"
          ? "Đã loại món bạn không thích."
          : type === "LIKED"
            ? "Đã lưu món yêu thích."
            : "Đã ghi nhận. Món này được ẩn khỏi gợi ý trong 4 ngày.",
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  const search = async (e) => {
    e.preventDefault();
    setSearching(true);
    setError("");
    try {
      setCatalog(
        (await apiRequest(`/dishes?q=${encodeURIComponent(query)}&limit=100`))
          .data.items,
      );
      setSearched(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  };
  return (
    <>
      <p className="food-eyebrow">
        {new Date().toLocaleDateString("vi-VN", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>
      <h1>Gợi ý cho hôm nay</h1>
      <p className="food-muted">
        Đúng khẩu vị của bạn. Món đã chọn hoặc đã ăn sẽ trở lại sau đủ 4 ngày.
      </p>
      {error && (
        <div className="food-error" role="alert">
          {error} <button onClick={load}>Thử lại</button>
        </div>
      )}
      {!data && !error && <p role="status">Đang chọn món phù hợp…</p>}
      {data?.status === "ONBOARDING_REQUIRED" && (
        <section className="food-empty">
          <h2>Cho chúng mình biết khẩu vị của bạn</h2>
          <p>Nhập mô tả về món bạn thích và những điều cần lưu ý.</p>
          <button className="food-primary" onClick={() => navigate("profile")}>
            Thiết lập khẩu vị
          </button>
        </section>
      )}
      {data?.status === "INSUFFICIENT_SAFETY_DATA" && (
        <section className="food-empty">
          <h2>Chưa đủ dữ liệu an toàn để gợi ý</h2>
          <p>
            Hồ sơ có dị ứng. Hãy xác nhận thành phần trực tiếp với quán trước
            khi chọn món.
          </p>
        </section>
      )}
      {data?.status === "PROFILE_PENDING_ANALYSIS" && (
        <section className="food-empty">
          <h2>Đã lưu khẩu vị của bạn</h2>
          <p>
            Mô tả chưa được phân tích thành bộ lọc gợi ý. Bạn vẫn có thể tìm
            quán hoặc công thức cho món đang thèm.
          </p>
          <button className="food-primary" onClick={() => navigate("discover")}>
            Tìm món / Nấu ăn
          </button>
        </section>
      )}
      {data?.status === "NO_MATCH" && (
        <section className="food-empty">
          <h2>Chưa có món phù hợp lúc này</h2>
          <p>
            Các món có thể đang trong thời gian chờ 4 ngày hoặc ngoài ngân
            sách/chế độ ăn. Thử xem lại hồ sơ hoặc tra cứu món; bộ lọc vẫn được
            giữ.
          </p>
          <button onClick={() => navigate("profile")}>Xem hồ sơ</button>
        </section>
      )}
      {data?.excludedRecentCount > 0 && (
        <p className="food-pill">
          Đang nghỉ {data.excludedRecentCount} món đã chọn / đã ăn
        </p>
      )}
      {data?.candidateLimitReached && (
        <p>
          Gợi ý hiện xét tối đa 500 món phù hợp khoảng giá. Dùng tìm kiếm để tra
          cứu thêm.
        </p>
      )}
      <div className="food-grid">
        {data?.items.map((dish) => (
          <article className="food-card" key={dish.id}>
            <p className="food-eyebrow">{dish.cuisine.name}</p>
            <h2>{dish.name}</h2>
            <p>{dish.description}</p>
            <strong>
              {money(dish.priceMin)} – {money(dish.priceMax)}
            </strong>
            <small>Khoảng giá công thức tham khảo · chưa phải giá quán</small>
            <p className="food-reason">{dish.reason}</p>
            <button onClick={() => onDish(dish)}>
              Xem kiến thức & tìm quán
            </button>
            <div className="food-actions">
              <button
                className="food-primary"
                disabled={!!busy}
                onClick={() => action(dish, "CHOSEN")}
              >
                Chọn món hôm nay
              </button>
              <button disabled={!!busy} onClick={() => action(dish, "EATEN")}>
                Đã ăn
              </button>
              <button disabled={!!busy} onClick={() => action(dish, "LIKED")}>
                Thích
              </button>
              <button
                disabled={!!busy}
                onClick={() => action(dish, "DISLIKED")}
              >
                Không thích
              </button>
            </div>
          </article>
        ))}
      </div>
      <RecipeIdeas onRecipe={onRecipe} navigate={navigate} />
      <section className="food-section">
        <h2>Tra cứu & ghi món đã ăn</h2>
        <p>
          Tra cứu không áp dụng bộ lọc gợi ý. Bạn có thể ghi lại món đã ăn hôm
          qua để loại khỏi gợi ý.
        </p>
        <form className="food-search" onSubmit={search}>
          <input
            aria-label="Tên món hoặc tên gọi khác"
            placeholder="Phở bò, bún chả…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            maxLength={150}
          />
          <button disabled={searching}>
            {searching ? "Đang tìm…" : "Tìm món"}
          </button>
        </form>
        {searched && !searching && !catalog.length && (
          <p role="status">
            Chưa tìm thấy món trong ngân hàng kiến thức. Thử tên gọi khác.
          </p>
        )}
        {catalog.map((dish) => (
          <CatalogRow
            key={dish.id}
            dish={dish}
            onDish={onDish}
            onRecorded={load}
            notice={notice}
          />
        ))}
      </section>
    </>
  );
}

function CatalogRow({ dish, onDish, onRecorded, notice }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(null);
  const record = async () => {
    setBusy(true);
    setError("");
    if (!key.current) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0);
      key.current = {
        idempotencyKey: crypto.randomUUID(),
        eatenAt: yesterday.toISOString(),
      };
    }
    try {
      await apiRequest(`/users/me/dishes/${dish.id}/interactions`, {
        method: "POST",
        body: JSON.stringify({ type: "EATEN", ...key.current }),
      });
      key.current = null;
      notice("Đã ghi nhận món ăn hôm qua.");
      await onRecorded();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="food-catalog-row">
      <div>
        <button onClick={() => onDish(dish)}>{dish.name}</button>
        <small>
          {dish.cuisine.name} · {money(dish.priceMin)}–{money(dish.priceMax)}{" "}
          tham khảo
        </small>
        {error && <p role="alert">{error}</p>}
      </div>
      <button disabled={busy} onClick={record}>
        {busy ? "Đang lưu…" : "Đã ăn hôm qua"}
      </button>
    </article>
  );
}
