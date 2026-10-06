import { useId, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
export default function FeedbackControls({
  path,
  resultId,
  dishId,
  canonicalName,
  initialRating,
  onSaved,
}) {
  const heading = useId(),
    key = useRef(null);
  const [rating, setRating] = useState(
    initialRating == null ? "" : String(initialRating),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function send(type) {
    setBusy(true);
    setError("");
    setNotice("");
    const input = {
      type,
      ...(type === "RATED" ? { rating: Number(rating) } : {}),
      ...(resultId ? { resultId } : {}),
    };
    const signature = JSON.stringify({ path, input });
    if (key.current?.signature !== signature)
      key.current = { signature, value: crypto.randomUUID() };
    try {
      const response = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify({ ...input, idempotencyKey: key.current.value }),
      });
      key.current = null;
      setNotice(
        type === "RATED"
          ? `Đã lưu đánh giá ${rating}/5 sao của bạn trên EatWise.`
          : type === "LIKED"
            ? "Đã lưu phản hồi thích món."
            : "Đã lưu phản hồi bỏ qua món.",
      );
      window.dispatchEvent(
        new CustomEvent("food-feedback-saved", {
          detail: { type, dishId, canonicalName },
        }),
      );
      onSaved?.(type, response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset
      className="food-feedback"
      aria-labelledby={heading}
      disabled={busy}
    >
      <legend id={heading}>Phản hồi của bạn trên EatWise</legend>
      <p>
        Đánh giá món trên app được lưu riêng với đánh giá quán từ Google và chỉ
        ảnh hưởng thứ tự gợi ý.
      </p>
      <label>
        Số sao bạn đánh giá
        <select
          value={rating}
          onChange={(event) => setRating(event.target.value)}
        >
          <option value="">Chọn số sao</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value} / 5 sao
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={busy || !rating}
        onClick={() => send("RATED")}
      >
        Lưu đánh giá món
      </button>
      <button type="button" onClick={() => send("LIKED")}>
        Thích món
      </button>
      <button type="button" onClick={() => send("SKIPPED")}>
        Bỏ qua món
      </button>
      {busy && <p role="status">Đang lưu phản hồi…</p>}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="food-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
