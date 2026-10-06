import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import { money } from "./foodUtils";
function randomIndex(length) {
  const ceiling = Math.floor(4294967296 / length) * length;
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= ceiling);
  return value[0] % length;
}
export default function LuckyWheel({
  candidates,
  onFind,
  notice,
  onRestaurant,
}) {
  const [open, setOpen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);
  const dialog = useRef(null);
  const trigger = useRef(null);
  const pending = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    setBusy(false);
    setResult(null);
    setError("");
    return () => clearTimeout(timer.current);
  }, [candidates]);
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [open]);
  const close = () => {
    clearTimeout(timer.current);
    setBusy(false);
    setOpen(false);
    trigger.current?.focus();
  };
  const spin = () => {
    if (!candidates.length || busy) return;
    setResult(null);
    setError("");
    setBusy(true);
    const index = randomIndex(candidates.length);
    const sector = 360 / candidates.length;
    const angle = (360 - (index + 0.5) * sector + 360) % 360;
    setRotation((old) => old + 1440 + ((angle - (old % 360) + 360) % 360));
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 2300;
    timer.current = setTimeout(() => {
      setResult(candidates[index]);
      setBusy(false);
      pending.current = null;
    }, duration);
  };
  const confirm = async () => {
    if (!result?.dishId) return;
    setSaving(true);
    setError("");
    pending.current ||= crypto.randomUUID();
    try {
      await apiRequest(`/users/me/dishes/${result.dishId}/interactions`, {
        method: "POST",
        body: JSON.stringify({
          type: "CHOSEN",
          idempotencyKey: pending.current,
        }),
      });
      pending.current = null;
      close();
      window.dispatchEvent(
        new CustomEvent("food-choice-saved", {
          detail: { dishId: result.dishId },
        }),
      );
      notice("Đã chọn món từ vòng quay. Món này được ẩn trong 4 ngày.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const colors = ["#286246", "#e5ebdd", "#b87c36", "#faf8f2"];
  const gradient = candidates.length
    ? `conic-gradient(${candidates.map((_, index) => `${colors[index % colors.length]} ${(index * 360) / candidates.length}deg ${((index + 1) * 360) / candidates.length}deg`).join(",")})`
    : "#e5ebdd";
  return (
    <>
      <button
        ref={trigger}
        className="food-wheel-trigger"
        aria-label="Mở vòng quay ăn gì"
        onClick={() => setOpen(true)}
      >
        Ăn gì?<span>Quay may mắn</span>
      </button>
      <dialog
        className="food-wheel-dialog"
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        aria-labelledby="wheel-heading"
      >
        <button
          className="food-wheel-close"
          aria-label="Đóng vòng quay"
          disabled={saving}
          onClick={close}
        >
          ×
        </button>
        <p className="food-eyebrow">ĐỂ MAY MẮN CHỌN GIÚP</p>
        <h2 id="wheel-heading">Hôm nay ăn gì?</h2>
        {!candidates.length ? (
          <>
            <p>
              Nhập ngân sách và tìm quanh bạn trước. Vòng quay sẽ chọn từ những
              kết quả đang có.
            </p>
            <button
              className="food-primary"
              onClick={() => {
                close();
                onFind();
              }}
            >
              Tìm món quanh tôi
            </button>
          </>
        ) : (
          <>
            <p>
              {candidates.length} lựa chọn quanh bạn. Quay chỉ gợi ý; món được
              ghi nhận khi bạn bấm chọn.
            </p>
            <div className="food-wheel-wrap">
              <span className="food-wheel-pointer" aria-hidden="true">
                ▼
              </span>
              <div
                className="food-wheel"
                style={{
                  background: gradient,
                  transform: `rotate(${rotation}deg)`,
                }}
                aria-hidden="true"
              >
                {candidates.map((item, i) => (
                  <span
                    key={item.id}
                    style={{
                      transform: `rotate(${((i + 0.5) * 360) / candidates.length}deg) translateY(-90px) rotate(90deg)`,
                      color: i % 4 === 0 ? "white" : "#20372b",
                    }}
                  >
                    {item.title.slice(0, 20)}
                  </span>
                ))}
              </div>
            </div>
            <button
              className="food-primary food-save"
              disabled={busy || saving}
              onClick={spin}
            >
              {busy ? "Đang quay…" : "Quay chọn món"}
            </button>
            {result && (
              <section className="food-wheel-result" aria-live="polite">
                <h3>{result.title}</h3>
                <p>
                  {result.restaurantName} ·{" "}
                  {(result.distanceMeters / 1000).toFixed(1)} km
                </p>
                <p>
                  {result.budgetVerified
                    ? `Giá xác nhận: ${money(result.price)}`
                    : "Quán chưa có giá món xác nhận. Hãy xem thực đơn trước khi quyết định."}
                </p>
                <div className="food-actions">
                  {(result.restaurantId || result.placeId) && (
                    <button
                      onClick={() => {
                        close();
                        onRestaurant(result);
                      }}
                    >
                      Chi tiết quán / thực đơn
                    </button>
                  )}
                  {result.dishId && (
                    <button disabled={saving} onClick={confirm}>
                      {saving ? "Đang lưu…" : "Chọn món này"}
                    </button>
                  )}
                  {result.mapsUrl && (
                    <a href={result.mapsUrl} target="_blank" rel="noreferrer">
                      Xem quán ↗
                    </a>
                  )}
                </div>
              </section>
            )}
            {error && (
              <p role="alert" className="food-error">
                {error}
              </p>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
