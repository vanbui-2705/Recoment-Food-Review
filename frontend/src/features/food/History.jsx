import { useEffect, useState } from "react";
import { apiRequest } from "../../profileApi";
import { date } from "./foodUtils";

export default function History() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiRequest("/users/me/food-history")
      .then((r) => {
        if (active) setItems(r.data.items);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <p className="food-eyebrow">NHẬT KÝ CỦA BẠN</p>
      <h1>Đã chọn & đã ăn</h1>
      <p>Mỗi lần chọn hoặc ăn đặt lại thời gian chờ 96 giờ cho món đó.</p>
      {error && (
        <p role="alert" className="food-error">
          {error}
        </p>
      )}
      {!items && !error && <p role="status">Đang tải nhật ký…</p>}
      {items?.length === 0 && (
        <p>Chưa có lịch sử. Chọn món hôm nay hoặc ghi món đã ăn hôm qua.</p>
      )}
      {items?.map((i) => {
        const eligible = new Date(
          new Date(i.createdAt).getTime() + 96 * 3600000,
        );
        return (
          <article className="food-place" key={i.id}>
            <h2>{i.dish.name}</h2>
            <p>
              {i.interactionType === "CHOSEN" ? "Đã chọn" : "Đã ăn"} ·{" "}
              {date(i.createdAt)}
            </p>
            <p>
              {eligible > new Date()
                ? `Có thể gợi ý lại từ ${date(eligible)}`
                : "Đã hết thời gian chờ"}{" "}
              (nếu không có lần chọn/ăn mới hơn)
            </p>
          </article>
        );
      })}
    </>
  );
}
