import { useEffect, useState } from "react";
import {
  fetchAdminUsers,
  fetchAdminUserStats,
  updateAdminUserStatus,
  fetchAdminAudit,
} from "../adminApi.js";

export default function AdminAccountsPage({ user, onNavigate = () => {} }) {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    disabled: 0,
    admins: 0,
    users: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Modal confirmation for lock/unlock
  const [modifyingUser, setModifyingUser] = useState(null);
  const [updating, setUpdating] = useState(false);

  // Audit Log view
  const [showAudit, setShowAudit] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const data = await fetchAdminUserStats();
      setStats(data);
    } catch {
      // Fallback
    } finally {
      setLoadingStats(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    setActionError("");
    try {
      const params = { page, limit };
      if (search.trim()) params.q = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;
      const data = await fetchAdminUsers(params);
      setUsers(data.items || []);
      setTotalUsers(data.total || 0);
    } catch {
      setActionError("Không thể tải danh sách tài khoản.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadAudit = async () => {
    setLoadingAudit(true);
    try {
      const data = await fetchAdminAudit({ limit: 30 });
      setAuditLogs(data.items || []);
    } catch {
      // Ignore
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleToggleStatus = async () => {
    if (!modifyingUser || updating) return;
    setUpdating(true);
    setActionError("");
    setActionSuccess("");
    const nextStatus = modifyingUser.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      await updateAdminUserStatus(
        modifyingUser.id,
        nextStatus,
        modifyingUser.updatedAt,
      );
      setActionSuccess(
        `Đã ${nextStatus === "ACTIVE" ? "mở khóa" : "khóa"} tài khoản ${modifyingUser.email} thành công!`,
      );
      setModifyingUser(null);
      loadUsers();
      loadStats();
    } catch (err) {
      setActionError(
        err?.message || "Không thể thay đổi trạng thái tài khoản. Vui lòng thử lại.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const totalPages = Math.ceil(totalUsers / limit) || 1;

  return (
    <div className="h-full w-full overflow-y-auto p-3 sm:p-5 lg:p-6 bg-[#f8f9fa]">
      <div className="max-w-6xl mx-auto space-y-5 pb-16">
        
        {/* Top Header */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-black shadow-md">
              <span className="material-symbols-outlined text-[26px]">manage_accounts</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-tight">
                  Quản lý Tài khoản Người dùng
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[10px] font-black uppercase">
                  Admin Panel
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                Theo dõi tổng số đăng ký, trạng thái hoạt động và phân quyền tài khoản
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setShowAudit(true);
                loadAudit();
              }}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">history_toggle_off</span>
              <span>Nhật ký</span>
            </button>
            <button
              onClick={() => {
                loadStats();
                loadUsers();
              }}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-[#ff7b00] hover:bg-[#e66a00] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500">Tổng tài khoản</span>
              <span className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">group</span>
              </span>
            </div>
            <strong className="text-2xl font-black text-gray-900">
              {loadingStats ? "—" : stats.total}
            </strong>
            <span className="text-[10px] text-gray-400 mt-1">Đã đăng ký hệ thống</span>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500">Đang hoạt động</span>
              <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">check_circle</span>
              </span>
            </div>
            <strong className="text-2xl font-black text-emerald-600">
              {loadingStats ? "—" : stats.active}
            </strong>
            <span className="text-[10px] text-emerald-600 font-bold mt-1">
              {stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% tổng số` : "100%"}
            </span>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500">Đang bị khóa</span>
              <span className="w-7 h-7 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">block</span>
              </span>
            </div>
            <strong className="text-2xl font-black text-red-600">
              {loadingStats ? "—" : stats.disabled}
            </strong>
            <span className="text-[10px] text-gray-400 mt-1">Hạn chế quyền</span>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500">Quản trị viên</span>
              <span className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-base">shield_person</span>
              </span>
            </div>
            <strong className="text-2xl font-black text-amber-600">
              {loadingStats ? "—" : stats.admins}
            </strong>
            <span className="text-[10px] text-gray-400 mt-1">Quyền Admin</span>
          </div>
        </div>

        {/* Search, Filter & Status Messages */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex-1 relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo email hoặc tên người dùng..."
                className="w-full h-10 bg-gray-50 rounded-xl pl-9 pr-4 text-xs font-medium text-gray-800 outline-none border border-gray-200 focus:border-violet-500 focus:bg-white transition"
              />
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                search
              </span>
            </form>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
              {[
                { id: "all", label: "Tất cả" },
                { id: "ACTIVE", label: "Hoạt động" },
                { id: "DISABLED", label: "Bị khóa" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setStatusFilter(f.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    statusFilter === f.id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {actionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{actionSuccess}</span>
            </div>
          )}

          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{actionError}</span>
            </div>
          )}

          {/* User List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 pl-2">Người dùng</th>
                  <th className="pb-3">Vai trò</th>
                  <th className="pb-3">Trạng thái</th>
                  <th className="pb-3 hidden sm:table-cell">Ngày đăng ký</th>
                  <th className="pb-3 text-right pr-2">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                      <p className="mt-1 font-bold">Đang tải danh sách tài khoản...</p>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">
                      Không tìm thấy tài khoản nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  users.map((row) => {
                    const isSelf = row.id === user?.id;
                    const isActive = row.status === "ACTIVE";
                    const initial = (row.displayName || row.email || "U").charAt(0).toUpperCase();

                    return (
                      <tr key={row.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 pl-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-600 text-white font-black flex items-center justify-center shrink-0 text-xs shadow-sm">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-gray-900 truncate">
                                  {row.displayName || "Chưa đặt tên"}
                                </span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 text-[9px] font-extrabold rounded">
                                    Bạn
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-gray-400 block truncate">
                                {row.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              row.role === "ADMIN"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {row.role}
                          </span>
                        </td>

                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                              }`}
                            ></span>
                            {isActive ? "Hoạt động" : "Bị khóa"}
                          </span>
                        </td>

                        <td className="py-3 hidden sm:table-cell text-gray-500 text-[11px]">
                          {row.createdAt ? new Date(row.createdAt).toLocaleDateString("vi-VN") : "—"}
                        </td>

                        <td className="py-3 text-right pr-2">
                          <button
                            type="button"
                            onClick={() => setModifyingUser(row)}
                            disabled={isSelf}
                            title={isSelf ? "Không thể tự khóa tài khoản của chính bạn" : ""}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                              isActive
                                ? "bg-red-50 text-red-700 hover:bg-red-100"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                          >
                            {isActive ? "Khóa" : "Mở khóa"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
            <span>
              Hiển thị {users.length} trên tổng {totalUsers} người dùng
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold disabled:opacity-40 transition"
              >
                Trước
              </button>
              <span className="font-bold text-gray-700">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold disabled:opacity-40 transition"
              >
                Sau
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Confirmation Modal */}
      {modifyingUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  modifyingUser.status === "ACTIVE"
                    ? "bg-red-50 text-red-600"
                    : "bg-emerald-50 text-emerald-600"
                }`}
              >
                <span className="material-symbols-outlined text-2xl">
                  {modifyingUser.status === "ACTIVE" ? "lock" : "lock_open"}
                </span>
              </span>
              <div>
                <h3 className="font-extrabold text-base text-gray-900">
                  {modifyingUser.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                </h3>
                <p className="text-xs text-gray-400">{modifyingUser.email}</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              {modifyingUser.status === "ACTIVE"
                ? `Bạn có chắc muốn KHÓA tài khoản "${modifyingUser.displayName || modifyingUser.email}"? Người dùng này sẽ không thể đăng nhập hoặc dùng dịch vụ EatWise AI.`
                : `Bạn có chắc muốn MỞ KHÓA tài khoản "${modifyingUser.displayName || modifyingUser.email}" để người dùng có thể sử dụng lại dịch vụ?`}
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModifyingUser(null)}
                disabled={updating}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={updating}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-sm ${
                  modifyingUser.status === "ACTIVE"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {updating ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showAudit && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-2xl max-h-[85vh] rounded-3xl bg-white p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-base">history</span>
                </span>
                <h3 className="font-extrabold text-sm text-gray-900">
                  Nhật Ký Kiểm Toán Hoạt Động (Audit Logs)
                </h3>
              </div>
              <button
                onClick={() => setShowAudit(false)}
                className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 flex items-center justify-center text-lg"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {loadingAudit ? (
                <p className="py-6 text-center text-xs text-gray-400 font-bold">Đang tải nhật ký...</p>
              ) : auditLogs.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400">Chưa có nhật ký hoạt động nào.</p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-violet-700">{log.action}</span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(log.createdAt).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600">
                      Người thực hiện: <code className="bg-white px-1 py-0.5 rounded font-mono text-[10px]">{log.actorId}</code>
                    </p>
                    {log.metadata && (
                      <pre className="bg-white p-2 rounded-xl text-[10px] text-gray-700 overflow-x-auto border border-gray-100">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 text-right">
              <button
                onClick={() => setShowAudit(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
