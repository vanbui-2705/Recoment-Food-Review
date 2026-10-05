import { useEffect, useState } from "react";
import {
  apiRequest,
  fetchCatalogs,
  fetchProfile,
  profileToPayload,
  saveOnboarding,
} from "../../profileApi";
import { meals } from "./foodUtils";

export default function Onboarding({ onSaved }) {
  const [form, setForm] = useState(null);
  const [catalogs, setCatalogs] = useState(null);
  const [preferences, setPreferences] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetchProfile(),
      fetchCatalogs(),
      apiRequest("/users/me/dish-preferences"),
    ])
      .then(([p, c, likes]) => {
        if (active) {
          setForm(profileToPayload(p.data.profile));
          setCatalogs(c);
          setPreferences(likes.data.items);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const change = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const locate = () => {
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ GPS. Hãy nhập tọa độ.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm((f) => ({
          ...f,
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        }));
        setBusy(false);
      },
      () => {
        setError("Không lấy được GPS. Bạn có thể nhập tọa độ từ Google Maps.");
        setBusy(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saveOnboarding(form);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (field, item, values) =>
    change(
      field,
      form[field].some((r) => r.code === item.code)
        ? form[field].filter((r) => r.code !== item.code)
        : [...form[field], { code: item.code, ...values }],
    );
  return (
    <>
      <p className="food-eyebrow">CÁ NHÂN HÓA</p>
      <h1>Khẩu vị của tôi</h1>
      <p>
        Điều chỉnh bất cứ lúc nào. Dị ứng và chế độ ăn bắt buộc luôn được ưu
        tiên.
      </p>
      {error && (
        <p role="alert" className="food-error">
          {error}
        </p>
      )}
      {!form && !error && <p role="status">Đang tải hồ sơ…</p>}
      {form && catalogs && (
        <form onSubmit={save}>
          <section className="food-section">
            <h2>Vị trí & khoảng cách</h2>
            <label>
              Khu vực
              <input
                value={form.areaLabel || ""}
                maxLength={200}
                placeholder="Ví dụ: Quận 1, TP.HCM"
                onChange={(e) => change("areaLabel", e.target.value)}
              />
            </label>
            <button type="button" disabled={busy} onClick={locate}>
              Lấy vị trí hiện tại
            </button>
            <div className="food-fields">
              <label>
                Vĩ độ
                <input
                  type="number"
                  min={-90}
                  max={90}
                  step="any"
                  value={form.latitude ?? ""}
                  onChange={(e) =>
                    change(
                      "latitude",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Kinh độ
                <input
                  type="number"
                  min={-180}
                  max={180}
                  step="any"
                  value={form.longitude ?? ""}
                  onChange={(e) =>
                    change(
                      "longitude",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </label>
            </div>
            <p className="food-muted">
              Vị trí chỉ được dùng khi tìm quán. Bạn có thể bỏ trống cả hai tọa
              độ và bổ sung sau.
            </p>
            <label>
              Khoảng cách tối đa (m)
              <input
                type="number"
                min={1}
                max={100000}
                required
                value={form.maxDistanceMeters}
                onChange={(e) =>
                  change("maxDistanceMeters", Number(e.target.value))
                }
              />
            </label>
          </section>
          <section className="food-section">
            <h2>Ngân sách & bữa ăn</h2>
            <div className="food-fields">
              <label>
                Tối thiểu (đ)
                <input
                  type="number"
                  min={0}
                  max={100000000}
                  required
                  value={form.budgetMin}
                  onChange={(e) => change("budgetMin", Number(e.target.value))}
                />
              </label>
              <label>
                Tối đa (đ)
                <input
                  type="number"
                  min={form.budgetMin}
                  max={100000000}
                  required
                  value={form.budgetMax}
                  onChange={(e) => change("budgetMax", Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              Thời điểm ăn
              <select
                value={form.mealPeriod || ""}
                onChange={(e) => change("mealPeriod", e.target.value || null)}
              >
                <option value="">Tất cả bữa</option>
                {meals.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section className="food-section">
            <h2>Bốn vị của bạn</h2>
            {[
              ["spicyLevel", "Cay"],
              ["sweetLevel", "Ngọt"],
              ["sourLevel", "Chua"],
              ["saltyLevel", "Mặn"],
            ].map(([id, name]) => (
              <label key={id}>
                {name}: {form[id]}/100
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form[id]}
                  onChange={(e) => change(id, Number(e.target.value))}
                />
              </label>
            ))}
          </section>
          <section className="food-section">
            <h2>Ẩm thực yêu thích</h2>
            <div className="food-options">
              {catalogs.cuisines.map((c) => (
                <label key={c.code}>
                  <input
                    type="checkbox"
                    checked={form.cuisinePreferences.some(
                      (r) => r.code === c.code,
                    )}
                    onChange={() =>
                      toggle("cuisinePreferences", c, { preferenceScore: 100 })
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </section>
          <section className="food-section">
            <h2>Dị ứng</h2>
            <p>
              Không xem dữ liệu thiếu là an toàn. Khi chưa xác minh được món tại
              quán, app sẽ báo thiếu dữ liệu thay vì gợi ý an toàn.
            </p>
            {catalogs.allergens.map((c) => {
              const selection = form.allergies.find((r) => r.code === c.code);
              return (
                <div className="food-allergy" key={c.code}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!selection}
                      onChange={() =>
                        toggle("allergies", c, {
                          severity: "UNKNOWN",
                          notes: null,
                        })
                      }
                    />
                    {c.name}
                  </label>
                  {selection && (
                    <>
                      <label>
                        Mức độ
                        <select
                          value={selection.severity}
                          onChange={(e) =>
                            change(
                              "allergies",
                              form.allergies.map((r) =>
                                r.code === c.code
                                  ? { ...r, severity: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        >
                          {[
                            ["UNKNOWN", "Chưa rõ"],
                            ["MILD", "Nhẹ"],
                            ["MODERATE", "Vừa"],
                            ["SEVERE", "Nặng"],
                          ].map(([id, name]) => (
                            <option key={id} value={id}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Ghi chú
                        <input
                          maxLength={500}
                          value={selection.notes || ""}
                          onChange={(e) =>
                            change(
                              "allergies",
                              form.allergies.map((r) =>
                                r.code === c.code
                                  ? { ...r, notes: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
              );
            })}
          </section>
          <section className="food-section">
            <h2>Chế độ ăn</h2>
            <p>
              Đánh dấu bắt buộc nếu món phải đáp ứng chế độ này. Lựa chọn ưu
              tiên chỉ được lưu trong hồ sơ.
            </p>
            {catalogs.dietaryRestrictions.map((c) => {
              const selection = form.dietaryRestrictions.find(
                (r) => r.code === c.code,
              );
              return (
                <div className="food-allergy" key={c.code}>
                  <label className="food-check">
                    <input
                      type="checkbox"
                      checked={!!selection}
                      onChange={() =>
                        toggle("dietaryRestrictions", c, { isMandatory: true })
                      }
                    />
                    {c.name}
                  </label>
                  {selection && (
                    <label className="food-check">
                      <input
                        type="checkbox"
                        checked={selection.isMandatory}
                        onChange={(e) =>
                          change(
                            "dietaryRestrictions",
                            form.dietaryRestrictions.map((r) =>
                              r.code === c.code
                                ? { ...r, isMandatory: e.target.checked }
                                : r,
                            ),
                          )
                        }
                      />
                      Bắt buộc đáp ứng {c.name}
                    </label>
                  )}
                </div>
              );
            })}
          </section>
          <section className="food-section">
            <h2>Món yêu thích / không thích</h2>
            <p>
              Chọn thích hoặc không thích từ chi tiết món. Món không thích được
              loại khỏi gợi ý cho đến khi bạn xóa lựa chọn.
            </p>
            {preferences.map((p) => (
              <div className="food-catalog-row" key={p.dishId}>
                <span>
                  {p.dish.name} ·{" "}
                  {p.preference === "LIKED" ? "Thích" : "Không thích"}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await apiRequest(
                        `/users/me/dishes/${p.dishId}/preference`,
                        {
                          method: "PUT",
                          body: JSON.stringify({ preference: null }),
                        },
                      );
                      setPreferences((all) =>
                        all.filter((a) => a.dishId !== p.dishId),
                      );
                    } catch (e) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Xóa lựa chọn
                </button>
              </div>
            ))}
          </section>
          <button className="food-primary food-save" disabled={busy}>
            {busy ? "Đang xử lý…" : "Lưu & xem gợi ý hôm nay"}
          </button>
        </form>
      )}
    </>
  );
}
