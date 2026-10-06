import "./user-notice.css";

export default function UserNotice({
  tone = "info",
  title,
  children,
  onDismiss,
}) {
  return (
    <div
      className={`food-user-notice food-user-notice--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="food-user-notice-mark" aria-hidden="true">
        {tone === "success"
          ? "✓"
          : tone === "warning" || tone === "error"
            ? "!"
            : "i"}
      </span>
      <div className="food-user-notice-content">
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          className="food-user-notice-close"
          aria-label="Đóng thông báo"
          onClick={onDismiss}
        >
          ×
        </button>
      )}
    </div>
  );
}
