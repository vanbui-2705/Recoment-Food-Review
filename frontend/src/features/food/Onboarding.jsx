import { useEffect, useState } from "react";
import { apiRequest } from "../../profileApi";

export default function Onboarding({ onSaved }) {
  const [description, setDescription] = useState("");
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError("");
    apiRequest("/users/me/food-knowledge")
      .then((response) => {
        if (!active) return;
        const note = response.data.knowledge;
        setDescription(note?.description || "");
        setRevision(note?.revision || 0);
        setLoaded(true);
        setConflict(false);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest("/users/me/food-knowledge", {
        method: "PUT",
        body: JSON.stringify({
          description: description.trim(),
          expectedRevision: revision,
        }),
      });
      setRevision(response.data.knowledge.revision);
      onSaved();
    } catch (err) {
      setError(err.message);
      setConflict(err.code === "FOOD_KNOWLEDGE_CONFLICT");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p className="food-eyebrow">CÁ NHÂN HÓA</p>
      <h1>Khẩu vị của tôi</h1>
      <p>
        Kể theo cách của bạn: thích ăn gì, không thích gì và những điều cần lưu
        ý khi chọn món.
      </p>
      {error && (
        <p role="alert" className="food-error">
          {error}
        </p>
      )}
      {!loaded && !error && <p role="status">Đang tải mô tả của bạn…</p>}
      {!loaded && error && (
        <button onClick={() => setReload((value) => value + 1)}>
          Thử tải lại
        </button>
      )}
      {loaded && (
        <form onSubmit={save} className="food-taste-description">
          <label htmlFor="taste-description">Mô tả khẩu vị của bạn</label>
          <textarea
            id="taste-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={8}
            maxLength={6000}
            required
            disabled={busy}
            aria-describedby="taste-description-help"
            placeholder="Ví dụ: Tôi thích món Việt, ăn ít cay và không quá ngọt. Không thích hành sống. Tôi dị ứng đậu phộng. Thường ăn khoảng 50–80 nghìn, ưu tiên quán gần nhà."
          />
          <p className="food-muted" id="taste-description-help">
            Mô tả được lưu riêng trong tài khoản của bạn. Bạn có thể sửa bất cứ
            lúc nào.
          </p>
          <small>
            {description.length.toLocaleString("vi-VN")} / 6.000 ký tự
          </small>
          {conflict && (
            <p>
              Bản bạn đang nhập vẫn được giữ.{" "}
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Tải lại sẽ thay nội dung đang nhập bằng bản đã lưu. Tiếp tục?",
                    )
                  )
                    setReload((value) => value + 1);
                }}
              >
                Tải lại bản đã lưu
              </button>
            </p>
          )}
          <button
            className="food-primary food-save"
            disabled={busy || conflict || !description.trim()}
          >
            {busy ? "Đang lưu…" : "Lưu mô tả khẩu vị"}
          </button>
        </form>
      )}
    </>
  );
}
