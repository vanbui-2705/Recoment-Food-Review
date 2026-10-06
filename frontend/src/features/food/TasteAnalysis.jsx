import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import "./taste-analysis.css";
import UserNotice from "./UserNotice";
import { userErrorMessage } from "../../userMessages";

const labels = {
  QUEUED: "Đang chờ phân tích khẩu vị…",
  RUNNING: "Đang đọc mô tả của bạn…",
  NEEDS_REVIEW: "Kiểm tra thông tin cần lưu ý",
  APPLIED: "Đã cập nhật khẩu vị từ mô tả của bạn.",
  FAILED: "Chưa phân tích được. Mô tả của bạn vẫn được lưu.",
  SUPERSEDED: "Mô tả đã thay đổi. Hãy phân tích bản mới nhất.",
};
const fields = {
  spicyLevel: "Độ cay",
  sweetLevel: "Độ ngọt",
  sourLevel: "Độ chua",
  saltyLevel: "Độ mặn",
  budgetMin: "Ngân sách từ",
  budgetMax: "Ngân sách tối đa",
  maxDistanceMeters: "Khoảng cách (m)",
  areaLabel: "Khu vực",
  mealPeriod: "Bữa ăn",
};
export default function TasteAnalysis({ revision, onApplied, onEdit }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const appliedCallback = useRef(onApplied);
  const notifiedAnalysis = useRef(null);
  useEffect(() => {
    appliedCallback.current = onApplied;
  }, [onApplied]);
  useEffect(() => {
    let active = true;
    let timer;
    const deadline = Date.now() + 120000;
    setData(null);
    setError("");
    setWaiting(false);
    const read = async () => {
      try {
        const response = await apiRequest("/users/me/food-knowledge/analyses");
        if (!active) return;
        setData(response.data);
        const status = response.data.analysis?.status;
        const appliedKey = `${response.data.analysis?.id}:${response.data.analysis?.sourceRevision}`;
        if (status === "APPLIED" && notifiedAnalysis.current !== appliedKey) {
          notifiedAnalysis.current = appliedKey;
          appliedCallback.current?.();
        }
        if (
          response.data.configured &&
          ["QUEUED", "RUNNING"].includes(status) &&
          Date.now() < deadline
        )
          timer = setTimeout(read, 3000);
        else if (
          response.data.configured &&
          ["QUEUED", "RUNNING"].includes(status)
        )
          setWaiting(true);
      } catch (err) {
        if (active) setError(err.message);
      }
    };
    read();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [revision, refresh]);
  const act = async (confirm) => {
    setBusy(true);
    setError("");
    try {
      const job = data.analysis;
      const response = await apiRequest(
        confirm
          ? `/users/me/food-knowledge/analyses/${job.id}/confirm`
          : "/users/me/food-knowledge/analyses",
        {
          method: "POST",
          ...(confirm
            ? { body: JSON.stringify({ sourceRevision: job.sourceRevision }) }
            : {}),
        },
      );
      setData((old) => ({ ...old, analysis: response.data.analysis }));
      if (confirm) onApplied?.();
      else setRefresh((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const job = data?.analysis;
  return (
    <section className="food-analysis" aria-label="Phân tích khẩu vị">
      {error && (
        <p role="alert" className="food-error">
          {error}
        </p>
      )}
      {!data && !error && (
        <p role="status">Đang kiểm tra trạng thái khẩu vị…</p>
      )}
      {data && !data.configured ? (
        <p>
          AI chưa được kết nối. Mô tả vẫn được lưu; bạn có thể tìm món và quán
          quanh đây.
        </p>
      ) : (
        data && (
          <>
            <p role="status">
              {labels[job?.status] || "Bạn có thể phân tích mô tả đã lưu."}
            </p>
            {waiting && (
              <UserNotice
                tone="info"
                title="Phân tích đang mất nhiều thời gian"
              >
                Mô tả vẫn được lưu. Bạn có thể tiếp tục tìm món và bấm cập nhật
                trạng thái sau; không cần gửi lại mô tả.
              </UserNotice>
            )}
            {job?.status === "FAILED" && (
              <UserNotice tone="warning">
                {userErrorMessage(
                  job.errorCode,
                  0,
                  "Phân tích chưa hoàn tất. Hãy thử lại; mô tả vẫn được lưu.",
                )}
              </UserNotice>
            )}
            {job?.status === "NEEDS_REVIEW" && (
              <UserNotice tone="warning" title="Cần kiểm tra ràng buộc ăn uống">
                Kiểm tra tên dị nguyên và chế độ ăn bên dưới trước khi xác nhận.
                Nếu thông tin chưa đúng, hãy sửa mô tả. Việc phân tích khẩu vị
                chưa xác minh món tại quán an toàn.
              </UserNotice>
            )}
            {job?.result && (
              <>
                {job.result.fields?.map((f) => (
                  <p key={f.field}>
                    {fields[f.field]}: {f.value}
                  </p>
                ))}
                {(job.result.allergies || []).map((fact, i) => (
                  <p key={`allergy:${i}`}>
                    Dị ứng: {job.labels?.allergies?.[fact.code] || fact.code} ·
                    “{fact.evidence}”
                  </p>
                ))}
                {(job.result.diets || []).map((fact, i) => (
                  <p key={`diet:${i}`}>
                    Chế độ ăn: {job.labels?.diets?.[fact.code] || fact.code} · “
                    {fact.evidence}”
                  </p>
                ))}
                {job.result.dishes?.map((fact, i) => (
                  <p key={i}>
                    {fact.preference === "LIKED" ? "Thích" : "Không thích"}:{" "}
                    {fact.name}
                  </p>
                ))}
                {job.result.questions?.map((question, i) => (
                  <p key={i}>{question}</p>
                ))}
              </>
            )}
            {job?.status === "NEEDS_REVIEW" && (
              <div className="food-actions">
                {!job.result?.questions?.length && (
                  <button
                    className="food-primary"
                    disabled={busy}
                    onClick={() => act(true)}
                  >
                    Xác nhận thông tin này
                  </button>
                )}
                <button disabled={busy} onClick={onEdit}>
                  Sửa mô tả để làm rõ
                </button>
              </div>
            )}
            {(!job || ["FAILED", "SUPERSEDED"].includes(job.status)) && (
              <button disabled={busy} onClick={() => act(false)}>
                Phân tích lại mô tả
              </button>
            )}
            {["QUEUED", "RUNNING", "APPLIED"].includes(job?.status) && (
              <button
                disabled={busy}
                onClick={() => {
                  if (job.status === "APPLIED") onApplied?.();
                  setRefresh((n) => n + 1);
                }}
              >
                Cập nhật trạng thái
              </button>
            )}
          </>
        )
      )}
      {error && (
        <button disabled={busy} onClick={() => setRefresh((n) => n + 1)}>
          Thử tải trạng thái lại
        </button>
      )}
    </section>
  );
}
