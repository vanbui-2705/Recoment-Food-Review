import { useState } from "react";
import { ACCESS_TOKEN_KEY, apiRequest } from "../profileApi.js";

export default function LoginPage({ notice = "", onAuthenticated = () => {} }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fillQuickLogin = (quickEmail, quickPassword) => {
    setEmail(quickEmail);
    setPassword(quickPassword);
    setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      localStorage.setItem(ACCESS_TOKEN_KEY, response.data.accessToken);
      sessionStorage.setItem("food_refresh_token", response.data.refreshToken);
      onAuthenticated();
    } catch (requestError) {
      setError(requestError.message || "Không thể đăng nhập. Vui lòng kiểm tra lại tài khoản và mật khẩu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (displayName.trim().length < 2) {
      setError("Tên hiển thị phải có ít nhất 2 ký tự.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Register
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        }),
      });

      // 2. Auto-login immediately
      const loginResponse = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      localStorage.setItem(ACCESS_TOKEN_KEY, loginResponse.data.accessToken);
      sessionStorage.setItem("food_refresh_token", loginResponse.data.refreshToken);
      setSuccess("Đăng ký thành công! Đang chuyển hướng vào ứng dụng...");
      setTimeout(() => {
        onAuthenticated();
      }, 500);
    } catch (requestError) {
      setError(requestError.message || "Không thể đăng ký tài khoản. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 80% 20%, #ffe8d6 0%, #fff6ef 35%, #f4f3ff 100%)",
      }}
    >
      {/* 3D Decorative Floating Ambient Spheres */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full opacity-35 blur-3xl"
        style={{ background: "radial-gradient(circle, #ff7b00, transparent)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }}
      />

      <div className="relative w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        {/* ═════════ LEFT COLUMN: 3D HERO BRANDING & SLOGAN ═════════ */}
        <div className="lg:col-span-6 flex flex-col justify-center space-y-6 text-left">
          {/* Logo Badge */}
          <div className="inline-flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-xl btn-3d-orange"
              style={{ background: "linear-gradient(135deg, #ff7b00, #ff9500)" }}
            >
              <span className="material-symbols-outlined text-[28px]">restaurant</span>
            </span>
            <div>
              <span className="block text-2xl font-black tracking-tight text-gray-900 leading-none">
                EatWise <span className="text-[#ff7b00]">AI</span>
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Trợ Lý Ẩm Thực Thông Minh
              </span>
            </div>
          </div>

          {/* Slogan Banner */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-100/80 border border-orange-200 px-3.5 py-1 text-xs font-black text-orange-700 shadow-sm">
              <span className="material-symbols-outlined text-sm text-orange-600">auto_awesome</span>
              <span>Định vị vị giác cá nhân hóa</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-[1.15]">
              Không biết ăn gì?
              <br />
              <span className="bg-gradient-to-r from-[#ff7b00] via-[#ea580c] to-[#7c3aed] bg-clip-text text-transparent">
                Có EatWise lo!
              </span>
            </h1>

            <p className="text-sm sm:text-base text-gray-600 font-medium leading-relaxed max-w-lg">
              Giải quyết nỗi băn khoăn mỗi bữa ăn trong 30 giây. Đề xuất món ngon theo gu, né dị ứng tự động, và tìm quán quanh bạn tức thì.
            </p>
          </div>

          {/* 3D Visual Floating Dish Card */}
          <div
            className="hidden sm:flex items-center gap-4 rounded-3xl bg-white/80 border border-white/80 p-4 shadow-xl backdrop-blur-md transform hover:-translate-y-1 transition duration-300"
            style={{
              boxShadow: "0 20px 40px -15px rgba(255, 123, 0, 0.2)",
            }}
          >
            <div className="h-16 w-16 rounded-2xl overflow-hidden bg-orange-100 shrink-0 shadow-inner flex items-center justify-center text-3xl">
              🍜
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-orange-600">Đề xuất trưa nay</span>
                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold">
                  96% hợp gu
                </span>
              </div>
              <h4 className="text-sm font-black text-gray-900 truncate mt-0.5">Phở Bò Tái Lăn Hà Nội</h4>
              <p className="text-[11px] text-gray-500 font-medium">Ấm bụng, thanh đạm, cách bạn 450m</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600 shrink-0">
              <span className="material-symbols-outlined text-lg">near_me</span>
            </span>
          </div>

          {/* Micro badges */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-500 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-emerald-600">shield</span>
              Chống ngán 96h
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-purple-600">casino</span>
              Vòng quay 3D
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-blue-600">chat</span>
              Trợ lý AI 24/7
            </span>
          </div>
        </div>

        {/* ═════════ RIGHT COLUMN: AUTH CARD (LOGIN / REGISTER) ═════════ */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div
            className="rounded-3xl border border-white/90 bg-white/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative"
            style={{
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 123, 0, 0.08)",
            }}
          >
            {/* Mode Switcher Tabs */}
            <div className="flex p-1 rounded-2xl bg-gray-100/80 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setSuccess("");
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                  mode === "login"
                    ? "bg-white text-gray-900 shadow-md"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                  setSuccess("");
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                  mode === "register"
                    ? "bg-white text-gray-900 shadow-md"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                Đăng ký tài khoản
              </button>
            </div>

            {/* Header Titles */}
            <div className="mb-5">
              <h2 className="text-2xl font-black tracking-tight text-gray-900">
                {mode === "login" ? "Đăng nhập" : "Tạo tài khoản mới"}
              </h2>
              <p className="mt-1 text-xs text-gray-500 font-medium">
                {mode === "login"
                  ? "Chào mừng trở lại! Khám phá bữa ăn tuyệt vời hôm nay."
                  : "Chỉ mất 30 giây để bắt đầu cá nhân hóa bữa ăn của bạn."}
              </p>
            </div>

            {/* Notices & Errors */}
            {(notice || error || success) && (
              <div
                role="alert"
                className={`mb-5 rounded-2xl px-4 py-3 text-xs font-bold flex items-center gap-2 border ${
                  error
                    ? "bg-red-50 text-red-700 border-red-200"
                    : success
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                <span className="material-symbols-outlined text-base shrink-0">
                  {error ? "error" : success ? "check_circle" : "info"}
                </span>
                <span className="flex-1">{error || success || notice}</span>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <label className="block text-xs font-extrabold text-gray-700">
                  Email
                  <div className="relative mt-1.5">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                      mail
                    </span>
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ban@email.com"
                      className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50/60 pl-11 pr-4 text-xs font-bold text-gray-800 outline-none transition focus:border-[#ff7b00] focus:bg-white focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </label>

                <label className="block text-xs font-extrabold text-gray-700">
                  Mật khẩu
                  <div className="relative mt-1.5">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                      lock
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50/60 pl-11 pr-11 text-xs font-bold text-gray-800 outline-none transition focus:border-[#ff7b00] focus:bg-white focus:ring-2 focus:ring-orange-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                    >
                      <span className="material-symbols-outlined text-base">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl font-black text-white shadow-xl btn-3d-orange transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #ff7b00, #ff9500)" }}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg animate-spin">
                        progress_activity
                      </span>
                      Đang đăng nhập...
                    </span>
                  ) : (
                    "Đăng nhập"
                  )}
                </button>

                {/* Quick Test Logins for Developer Convenience */}
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2 text-center">
                    Tài khoản test nhanh (Local / Dev)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => fillQuickLogin("user.test@rec-food.local", "UserTest@2026!")}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-orange-50 hover:border-orange-200 text-gray-700 text-[11px] font-bold transition btn-3d-white"
                    >
                      <span className="material-symbols-outlined text-sm text-orange-500">person</span>
                      <span>User Test</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fillQuickLogin("admin@rec-food.local", "rec-food-local-admin-only")}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-purple-50 hover:border-purple-200 text-gray-700 text-[11px] font-bold transition btn-3d-white"
                    >
                      <span className="material-symbols-outlined text-sm text-purple-600">verified</span>
                      <span>Admin</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* REGISTER FORM */
              <form onSubmit={handleRegister} className="space-y-3.5">
                <label className="block text-xs font-extrabold text-gray-700">
                  Tên hiển thị
                  <div className="relative mt-1">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                      badge
                    </span>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ví dụ: Hoàng Tuấn"
                      className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50/60 pl-11 pr-4 text-xs font-bold text-gray-800 outline-none transition focus:border-[#ff7b00] focus:bg-white"
                    />
                  </div>
                </label>

                <label className="block text-xs font-extrabold text-gray-700">
                  Email
                  <div className="relative mt-1">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                      mail
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ban@email.com"
                      className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50/60 pl-11 pr-4 text-xs font-bold text-gray-800 outline-none transition focus:border-[#ff7b00] focus:bg-white"
                    />
                  </div>
                </label>

                <label className="block text-xs font-extrabold text-gray-700">
                  Mật khẩu
                  <div className="relative mt-1">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                      lock
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tối thiểu 8 ký tự"
                      className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50/60 pl-11 pr-11 text-xs font-bold text-gray-800 outline-none transition focus:border-[#ff7b00] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                    >
                      <span className="material-symbols-outlined text-base">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </label>

                <label className="block text-xs font-extrabold text-gray-700">
                  Xác nhận mật khẩu
                  <div className="relative mt-1">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                      lock_reset
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      className="h-11 w-full rounded-2xl border border-gray-200 bg-gray-50/60 pl-11 pr-4 text-xs font-bold text-gray-800 outline-none transition focus:border-[#ff7b00] focus:bg-white"
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl font-black text-white shadow-xl btn-3d-orange transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #ff7b00, #ff9500)" }}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg animate-spin">
                        progress_activity
                      </span>
                      Đang tạo tài khoản...
                    </span>
                  ) : (
                    "Tạo tài khoản EatWise"
                  )}
                </button>

                <div className="text-center pt-2">
                  <span className="text-xs text-gray-500 font-medium">Đã có tài khoản? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                    className="text-xs font-black text-orange-600 hover:underline"
                  >
                    Đăng nhập ngay
                  </button>
                </div>
              </form>
            )}

            {/* Footer Tagline */}
            <p className="mt-5 text-center text-[11px] font-bold text-gray-400">
              Không biết ăn gì có EatWise · Hương vị chuẩn gu Việt
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
