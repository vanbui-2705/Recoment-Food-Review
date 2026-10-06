import { useState } from "react";
import AdminMenu from "./AdminMenu";
import AdminReports from "./AdminReports";
import AdminAccounts from "./AdminAccounts";
import AdminOperations from "./AdminOperations";
export default function AdminPanel({ onSignedOut }) {
  const [tab, setTab] = useState("menu");
  return (
    <>
      <nav aria-label="Chức năng quản trị" className="food-actions">
        <button
          type="button"
          aria-current={tab === "menu" ? "page" : undefined}
          onClick={() => setTab("menu")}
        >
          Thực đơn và bằng chứng
        </button>
        <button
          type="button"
          aria-current={tab === "reports" ? "page" : undefined}
          onClick={() => setTab("reports")}
        >
          Báo cáo dữ liệu
        </button>
      </nav>
      <nav aria-label="Quản lý truy cập" className="food-actions">
        <button
          onClick={() => setTab("operations")}
          aria-current={tab === "operations" ? "page" : undefined}
        >
          Vận hành và API
        </button>
        <button
          onClick={() => setTab("users")}
          aria-current={tab === "users" ? "page" : undefined}
        >
          Người dùng
        </button>
        <button
          onClick={() => setTab("audit")}
          aria-current={tab === "audit" ? "page" : undefined}
        >
          Nhật ký quản trị
        </button>
      </nav>
      {tab === "menu" ? (
        <AdminMenu />
      ) : tab === "reports" ? (
        <AdminReports />
      ) : tab === "operations" ? (
        <AdminOperations />
      ) : (
        <AdminAccounts
          key={tab}
          audit={tab === "audit"}
          onSignedOut={onSignedOut}
        />
      )}
    </>
  );
}
