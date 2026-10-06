import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import ReportData from "./ReportData";
import FeedbackControls from "./FeedbackControls";
import { sourceNames } from "./Discovery";

export default function RecipeDetail({
  selected,
  onBack,
  onFindRestaurants,
  notice,
}) {
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyRecord, setHistoryRecord] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [step, setStep] = useState(0);
  const [reload, setReload] = useState(0);
  const pending = useRef(new Map());
  useEffect(() => {
    let active = true;
    setRecipe(null);
    setHistoryRecord(null);
    setError("");
    setChecked(new Set());
    setStep(0);
    apiRequest(`/recipes/${selected.source}/${selected.id}`)
      .then((r) => {
        if (active) setRecipe(r.data.recipe);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [selected.source, selected.id, reload]);
  const record = async (type, yesterday = false) => {
    setBusy(true);
    setError("");
    const action = `${type}:${yesterday}`;
    if (!pending.current.has(action)) {
      const payload = { type, idempotencyKey: crypto.randomUUID() };
      if (yesterday) {
        const time = new Date();
        time.setDate(time.getDate() - 1);
        time.setHours(12, 0, 0, 0);
        payload.eatenAt = time.toISOString();
      }
      pending.current.set(action, payload);
    }
    try {
      const recorded = await apiRequest(
        `/recipes/${selected.source}/${selected.id}/interactions`,
        { method: "POST", body: JSON.stringify(pending.current.get(action)) },
      );
      pending.current.delete(action);
      setHistoryRecord(recorded.data);
      window.dispatchEvent(
        new CustomEvent("food-choice-saved", {
          detail: {
            canonicalName: recorded?.data?.canonicalName,
            dishId: recorded?.data?.canonicalDishId,
          },
        }),
      );
      notice(
        "Đã ghi nhận món. Gợi ý sẽ ẩn món này trong 4 ngày kể từ thời điểm đã chọn/ăn.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button onClick={onBack}>← Quay lại</button>
      <p className="food-eyebrow">
        NẤU TẠI NHÀ · {sourceNames[selected.source]}
      </p>
      <h1>{recipe?.title || selected.title}</h1>
      {error && (
        <p role="alert" className="food-error">
          {error}{" "}
          <button onClick={() => setReload((v) => v + 1)}>
            Tải lại cách nấu
          </button>
        </p>
      )}
      {!recipe && !error && (
        <p role="status">Đang lấy nguyên liệu và hướng dẫn…</p>
      )}
      {recipe && (
        <>
          {recipe.image && (
            <img
              className="food-recipe-hero"
              src={recipe.image}
              alt={recipe.title}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.hidden = true;
              }}
            />
          )}
          <p>
            {recipe.readyInMinutes != null &&
              `${recipe.readyInMinutes} phút · `}
            {recipe.servings != null && `${recipe.servings} phần ăn · `}Công
            thức nguyên bản từ {sourceNames[recipe.source]}
          </p>
          <p className="food-muted">
            Hướng dẫn giữ nguyên ngôn ngữ nguồn. Kiểm tra nguyên liệu theo dị
            ứng và chế độ ăn của bạn; công thức này chưa xác minh an toàn tại
            quán.
          </p>
          <section className="food-section">
            <h2>Chuẩn bị nguyên liệu</h2>
            {!recipe.ingredients.length && (
              <p>Nguồn chưa cung cấp danh sách nguyên liệu.</p>
            )}
            {recipe.ingredients.map((ingredient, i) => (
              <label className="food-check-option" key={i}>
                <input
                  type="checkbox"
                  checked={checked.has(i)}
                  onChange={() =>
                    setChecked((old) => {
                      const next = new Set(old);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                />
                <span>{ingredient}</span>
              </label>
            ))}
          </section>
          <section className="food-section">
            <h2>Cách nấu từng bước</h2>
            {!recipe.steps.length ? (
              <p>
                Nguồn chưa cung cấp các bước nấu. Xem công thức gốc bên dưới nếu
                có.
              </p>
            ) : (
              <>
                <p role="status">
                  Bước {step + 1} / {recipe.steps.length}
                </p>
                <p className="food-cooking-step">{recipe.steps[step]}</p>
                <div className="food-actions">
                  <button
                    disabled={step === 0}
                    onClick={() => setStep((v) => v - 1)}
                  >
                    Bước trước
                  </button>
                  <button
                    disabled={step === recipe.steps.length - 1}
                    onClick={() => setStep((v) => v + 1)}
                  >
                    Bước tiếp theo
                  </button>
                </div>
                <details>
                  <summary>Xem tất cả các bước</summary>
                  <ol>
                    {recipe.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </details>
              </>
            )}
            <div className="food-actions">
              {recipe.sourceUrl && (
                <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
                  Công thức gốc ↗
                </a>
              )}
              {recipe.videoUrl && (
                <a href={recipe.videoUrl} target="_blank" rel="noreferrer">
                  Video hướng dẫn ↗
                </a>
              )}
            </div>
          </section>
          {historyRecord?.id && (
            <FeedbackControls
              path={`/users/me/history/RECIPE/${historyRecord.id}/feedback`}
              dishId={historyRecord.canonicalDishId}
              canonicalName={historyRecord.canonicalName}
            />
          )}
          <div className="food-actions">
            <ReportData
              target={{ kind: "RECIPE", source: recipe.source, id: recipe.id }}
              title={recipe.title}
            />
            <button
              className="food-primary"
              disabled={busy}
              onClick={() => record("CHOSEN")}
            >
              Chọn nấu hôm nay
            </button>
            <button disabled={busy} onClick={() => record("EATEN")}>
              Đã ăn món này
            </button>
            <button disabled={busy} onClick={() => record("EATEN", true)}>
              Đã ăn món này hôm qua
            </button>
            <button onClick={() => onFindRestaurants(recipe.title)}>
              Tìm quán cho món này
            </button>
          </div>
        </>
      )}
    </>
  );
}
