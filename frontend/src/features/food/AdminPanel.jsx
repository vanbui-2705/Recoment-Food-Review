import { useState } from "react";
import AdminMenu from "./AdminMenu";
import AdminReports from "./AdminReports";
export default function AdminPanel() {
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
      {tab === "menu" ? <AdminMenu /> : <AdminReports />}
    </>
  );
}
