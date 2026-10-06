import { useEffect, useState } from "react";
import { apiRequest } from "../../profileApi";
import { RecipeCards } from "./Discovery";
export default function RecipeIdeas({ onRecipe, navigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    apiRequest("/recipes/today")
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  if (
    data?.status === "ONBOARDING_REQUIRED" ||
    data?.status === "INSUFFICIENT_SAFETY_DATA"
  )
    return null;
  return (
    <section className="food-section">
      <h2>Hôm nay nấu gì?</h2>
      <p>
        Ý tưởng từ các nguồn công thức. Món đã chọn hoặc ăn được ẩn trong 4
        ngày.
      </p>
      {error && (
        <p>
          Chưa tải được công thức.{" "}
          <button onClick={() => setRetry((v) => v + 1)}>
            Thử tải lại công thức
          </button>
        </p>
      )}
      {!data && !error && <p role="status">Đang tìm ý tưởng nấu ăn…</p>}
      {data?.status === "NOT_CONFIGURED" && (
        <p>Nguồn công thức đang được thiết lập.</p>
      )}
      {data?.status === "UNAVAILABLE" && (
        <p>
          Nguồn công thức tạm thời không khả dụng.{" "}
          <button onClick={() => setRetry((v) => v + 1)}>Tải lại</button>
        </p>
      )}
      {data?.status === "SUCCESS" && !data.items.length && (
        <p>
          Chưa có ý tưởng mới. Bạn vẫn có thể tìm công thức cho món đang thèm.
        </p>
      )}
      {data?.items.length > 0 && (
        <>
          <p className="food-muted">{data.notice}</p>
          <RecipeCards items={data.items} onRecipe={onRecipe} />
        </>
      )}
      <button onClick={() => navigate("discover")}>
        Tìm món bạn đang thèm / công thức
      </button>
    </section>
  );
}
