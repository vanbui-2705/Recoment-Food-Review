import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../profileApi";
import UserNotice from "./UserNotice";

const labels = {
  google: "Google Places",
  goong: "Goong",
  foursquare: "Foursquare",
  geoapify: "Geoapify",
  themealdb: "TheMealDB",
  spoonacular: "Spoonacular",
};
const statuses = {
  OK: "Lần gọi gần nhất thành công",
  NOT_CONFIGURED: "Chưa cấu hình",
  NOT_CHECKED: "Chưa có lần gọi gần đây",
  UNAVAILABLE: "Lần gọi gần nhất thất bại",
  QUOTA_EXCEEDED: "Đã chạm giới hạn",
  QUEUED: "Đang chờ",
  RUNNING: "Đang xử lý",
  FAILED: "Cần xử lý lỗi",
  PROCESSING: "Đang gửi",
  SENT: "Provider đã tiếp nhận",
  CANCELLED: "Đã hủy",
  APPLIED: "Đã áp dụng",
  NEEDS_REVIEW: "Chờ xác nhận",
  SUPERSEDED: "Có bản mới hơn",
  SUCCEEDED: "Hoàn tất",
};
const time = (value) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Chưa có";
function Notice({ kind, message, onRetry, onDismiss }) {
  return (
    <UserNotice tone={kind} onDismiss={onDismiss}>
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </UserNotice>
  );
}
export default function AdminOperations() {
  const [data, setData] = useState(null),
    [jobs, setJobs] = useState(null),
    [cursor, setCursor] = useState(null),
    [pages, setPages] = useState([]);
  const [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [jobError, setJobError] = useState("");
  const [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const dialog = useRef(null),
    focusBack = useRef(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setJobError("");
    apiRequest("/admin/operations")
      .then(async (result) => {
        if (!alive) return;
        setData(result.data);
        try {
          const rows = await apiRequest(
            `/admin/operations/account-deletions?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
          );
          if (alive) setJobs(rows.data);
        } catch (e) {
          if (alive) {
            setJobError(e.message);
            setJobs(null);
          }
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setData(null);
          setJobs(null);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [cursor, revision]);
  useEffect(() => {
    if (selected) {
      focusBack.current = document.activeElement;
      dialog.current?.showModal();
    } else focusBack.current?.focus();
  }, [Boolean(selected)]);
  async function retry(event) {
    event.preventDefault();
    setBusy(true);
    setJobError("");
    try {
      await apiRequest(
        `/admin/operations/account-deletions/${selected.id}/retry`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedUpdatedAt: selected.updatedAt,
            confirm: true,
          }),
        },
      );
      setSelected(null);
      setNotice({
        tone: "success",
        message:
          "Đã đưa yêu cầu trở lại hàng đợi. Dữ liệu chưa được xác nhận xóa hoàn tất.",
      });
      setRevision((v) => v + 1);
    } catch (e) {
      setJobError(e.message);
      if (e.status === 409 || e.status === 404) {
        setSelected(null);
        setNotice({
          tone: "warning",
          message:
            "Yêu cầu đã thay đổi hoặc được xử lý. Danh sách đang được tải lại; kiểm tra trạng thái mới trước khi thao tác.",
        });
        setRevision((v) => v + 1);
      }
      if (e.status === 403) {
        setSelected(null);
        setData(null);
        setJobs(null);
        setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="food-page" aria-labelledby="operations-title">
      <header className="food-section-header">
        <div>
          <h1 id="operations-title">Vận hành hệ thống</h1>
          <p>
            Theo dõi kết nối và hàng đợi xử lý. Không gửi yêu cầu kiểm tra API
            trả phí khi mở trang.
          </p>
        </div>
        <button
          disabled={loading || busy}
          onClick={() => setRevision((v) => v + 1)}
        >
          Cập nhật trạng thái
        </button>
      </header>
      {notice && (
        <Notice
          message={notice.message}
          kind={notice.tone}
          onDismiss={() => setNotice("")}
        />
      )}
      {error && (
        <Notice
          message={error}
          kind="error"
          onRetry={() => setRevision((v) => v + 1)}
        />
      )}
      {loading && <p role="status">Đang kiểm tra trạng thái…</p>}
      {data && (
        <>
          <p>
            Cập nhật: {time(data.generatedAt)}. Thành công phản ánh phản hồi
            HTTP gần nhất; chưa xác nhận độ đầy đủ của menu hay giá món.
          </p>
          <div className="food-grid">
            {data.providers.map((source) => (
              <article className="food-card" key={source.source}>
                <h2>{labels[source.source] || source.source}</h2>
                <p>{statuses[source.status] || "Chưa xác định"}</p>
                <p>
                  Quota đang dùng: {source.used}/{source.minuteLimit} yêu
                  cầu/phút, dùng chung mọi server.
                </p>
                <p>
                  Lần gọi: {time(source.lastAttemptAt)}
                  <br />
                  Thành công gần nhất: {time(source.lastSuccessAt)}
                </p>
                <p>
                  Tổng gọi: {source.requests} · Lỗi kết nối: {source.failures} ·
                  Chạm quota: {source.quotaRejections}
                </p>
              </article>
            ))}
          </div>
          <h2>Dịch vụ nền</h2>
          <p>
            Worker:{" "}
            {data.capabilities.workerEnabled ? "Đã bật cấu hình" : "Chưa bật"} ·
            AI:{" "}
            {data.capabilities.aiConfigured ? "Đã cấu hình" : "Chưa cấu hình"} ·
            Email:{" "}
            {data.capabilities.emailConfigured
              ? "Đã cấu hình"
              : "Chưa cấu hình"}
            .
          </p>
          {!data.capabilities.workerEnabled && (
            <Notice
              kind="warning"
              message="Worker chưa bật. Yêu cầu xóa tài khoản chưa thể được tiếp nhận; việc dọn dữ liệu tự động chưa chạy."
            />
          )}
          <div className="food-grid">
            {Object.entries(data.jobs).map(([kind, rows]) => (
              <article className="food-card" key={kind}>
                <h3>
                  {
                    {
                      analysis: "Phân tích khẩu vị",
                      chat: "Hội thoại",
                      email: "Email",
                      deletion: "Xóa tài khoản",
                    }[kind]
                  }
                </h3>
                {rows.length ? (
                  rows.map((row) => (
                    <p key={row.status}>
                      {statuses[row.status] || row.status}: {row._count}
                    </p>
                  ))
                ) : (
                  <p>Chưa có công việc.</p>
                )}
              </article>
            ))}
          </div>
          <h2>Dọn dữ liệu</h2>
          <p>
            Hoàn tất gần nhất: {time(data.retention.lastCompletedAt)} · Lịch
            tiếp: {time(data.retention.nextRunAt)}
          </p>
          {data.retention.lastErrorCode && (
            <Notice
              kind="error"
              message="Lần dọn dữ liệu gần nhất thất bại. Kiểm tra database và log worker trước khi chờ lần chạy lại."
            />
          )}
          <h2>Yêu cầu xóa tài khoản</h2>
          <p>
            Chỉ chạy lại yêu cầu lỗi sau khi đã sửa nguyên nhân. Thao tác được
            ghi vào nhật ký quản trị.
          </p>
          {jobError && (
            <Notice
              kind="error"
              message={jobError}
              onRetry={() => setRevision((v) => v + 1)}
            />
          )}
          {jobs && (
            <>
              {!jobs.items.length && <p>Không có yêu cầu ở trang này.</p>}
              <div className="food-grid">
                {jobs.items.map((job) => (
                  <article className="food-card" key={job.id}>
                    <h3>{statuses[job.status] || job.status}</h3>
                    <p>
                      Mã yêu cầu: <code>{job.id}</code>
                    </p>
                    <p>
                      Tiếp nhận: {time(job.requestedAt)} · Đã thử:{" "}
                      {job.attempts} lần.
                    </p>
                    {job.errorCode && (
                      <p>
                        Không xử lý được yêu cầu. Kiểm tra log theo mã công
                        việc.
                      </p>
                    )}
                    {job.status === "FAILED" && (
                      <button
                        disabled={!data.capabilities.workerEnabled || busy}
                        onClick={() => setSelected(job)}
                      >
                        Xử lý lại yêu cầu xóa
                      </button>
                    )}
                  </article>
                ))}
              </div>
              <nav className="food-actions" aria-label="Trang yêu cầu xóa">
                <button
                  disabled={!pages.length || loading}
                  onClick={() => {
                    setCursor(pages.at(-1));
                    setPages((old) => old.slice(0, -1));
                  }}
                >
                  Trang trước
                </button>
                <button
                  disabled={!jobs.nextCursor || loading}
                  onClick={() => {
                    setPages((old) => [...old, cursor]);
                    setCursor(jobs.nextCursor);
                  }}
                >
                  Trang sau
                </button>
              </nav>
            </>
          )}
        </>
      )}
      {selected && (
        <dialog
          ref={dialog}
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) setSelected(null);
          }}
        >
          <form onSubmit={retry}>
            <h2>Xử lý lại yêu cầu xóa?</h2>
            <p>
              Tài khoản tiếp tục bị khóa. Worker sẽ tiếp tục xóa dữ liệu theo
              yêu cầu đã được chủ tài khoản xác nhận.
            </p>
            <p>
              Mã yêu cầu: <code>{selected.id}</code>
            </p>
            {jobError && <Notice kind="error" message={jobError} />}
            <div className="food-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Hủy
              </button>
              <button type="submit" disabled={busy}>
                {busy ? "Đang tiếp nhận…" : "Xác nhận xử lý lại"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
