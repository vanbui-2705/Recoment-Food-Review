import { useEffect, useState } from "react";
import { apiRequest } from "../../profileApi";
import { date } from "./foodUtils";
import { reportReasons, reportStatuses } from "./ReportData";
export default function ReportHistory() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiRequest(`/users/me/data-reports?page=${page}&limit=10`)
      .then((result) => {
        if (active) setData(result.data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, revision]);
  return (
    <section className="food-section" aria-label="Báo cáo dữ liệu của bạn">
      <h2>Báo cáo thông tin sai</h2>
      <p>
        Theo dõi những thông tin bạn đã gửi để kiểm tra. Trạng thái xử lý không
        thay đổi ràng buộc ăn uống của bạn.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={() => setRevision((value) => value + 1)}
      >
        Cập nhật trạng thái báo cáo
      </button>
      {loading && <p role="status">Đang tải báo cáo…</p>}
      {error && (
        <p role="alert" className="food-error">
          {error}
        </p>
      )}
      {!loading && !error && !data?.items.length && (
        <p>Bạn chưa gửi báo cáo nào.</p>
      )}
      {!loading &&
        !error &&
        data?.items.map((item) => (
          <article className="food-place" key={item.id}>
            <h3>{reportReasons[item.reason]}</h3>
            <p>
              {reportStatuses[item.status]} · {date(item.updatedAt)}
            </p>
            <p>{item.note}</p>
            <small>
              Nguồn: {item.targetSource || "Thực đơn được cấp quyền"} · Mã{" "}
              {item.targetId}
            </small>
          </article>
        ))}
      {data && (
        <div className="food-actions">
          <button
            type="button"
            disabled={loading || page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Trang báo cáo trước
          </button>
          <span>Trang {page}</span>
          <button
            type="button"
            disabled={loading || page * data.limit >= data.total}
            onClick={() => setPage((value) => value + 1)}
          >
            Trang báo cáo tiếp
          </button>
        </div>
      )}
    </section>
  );
}
