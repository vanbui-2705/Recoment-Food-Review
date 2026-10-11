import { useEffect, useState } from "react";
import { ACCESS_TOKEN_KEY, apiRequest, getAccessToken } from "../../profileApi.js";
import DiscoveryPage from "../../pages/DiscoveryPage.jsx";
import ChatPage from "../../pages/ChatPage.jsx";
import MapPage from "../../pages/MapPage.jsx";
import ProfilePage from "../../pages/ProfilePage.jsx";
import HistoryPage from "../../pages/HistoryPage.jsx";

const screens = ["today", "chat", "map", "profile", "history"];
const readScreen = () => {
  const value = window.location.hash.slice(1).split("/")[0];
  return screens.includes(value) ? value : "today";
};

const navItems = [
  { id: "today", icon: "explore", label: "Khám phá" },
  { id: "chat", icon: "smart_toy", label: "Trợ lý AI", badge: "Live" },
  { id: "map", icon: "map", label: "Bản đồ Quán" },
  { id: "profile", icon: "neurology", label: "Hồ sơ Vị giác" },
  { id: "history", icon: "receipt_long", label: "Lịch sử" },
];

export default function EatwiseDashboard() {
  const [signedIn, setSignedIn] = useState(Boolean(getAccessToken()));
  const [screen, setScreen] = useState(readScreen);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [notice, setNotice] = useState("");
  const [usingLocation, setUsingLocation] = useState(false);

  useEffect(() => {
    const sync = () => setScreen(readScreen());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    const expired = () => {
      setSignedIn(false);
      setUser(null);
      setNotice("Phiên đăng nhập đã hết hạn.");
    };
    window.addEventListener("food-session-expired", expired);
    return () => window.removeEventListener("food-session-expired", expired);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    apiRequest("/users/me", { suppressSessionExpiry: true })
      .then((response) => setUser(response.data.user))
      .catch(() => {});
    apiRequest("/users/me/profile", { suppressSessionExpiry: true })
      .then((response) => setProfile(response.data.profile))
      .catch(() => setProfile(null));
  }, [signedIn]);

  const navigate = (next) => {
    window.location.hash = next;
    setScreen(next);
  };

  const logout = async () => {
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: sessionStorage.getItem("food_refresh_token") || "" }),
      });
    } catch {
      // Local logout is still valid
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem("food_refresh_token");
    setSignedIn(false);
    setUser(null);
    setProfile(null);
    setNotice("Đã đăng xuất tài khoản.");
  };

  const activeTitle = navItems.find((item) => item.id === screen)?.label || "Khám phá";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f7f7fb] text-[#24242b]">
      
      {/* Left Sidebar */}
      <aside className="hidden h-full w-[232px] shrink-0 flex-col border-r border-[#ececf3] bg-white lg:flex">
        <button onClick={() => navigate("today")} className="flex h-[78px] items-center gap-2.5 px-5 text-left">
          <Logo />
          <span>
            <strong className="block text-base font-extrabold tracking-tight">EatWise <span className="text-[#ff7b00]">AI</span></strong>
            <small className="text-[9px] font-semibold text-gray-400">Autonomous Dining</small>
          </span>
        </button>

        {/* Location Widget */}
        <div className="mx-4 rounded-xl border border-[#e6e2ff] bg-[#f6f4ff] p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#6c63ff] shadow-sm">
              <span className="material-symbols-outlined text-xl">location_on</span>
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-gray-400">Vị trí hiện tại</p>
              <p className="truncate text-xs font-bold">Cầu Giấy, Hà Nội</p>
            </div>
            <span className="material-symbols-outlined ml-auto text-base text-gray-400">expand_more</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-5 flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${active ? "bg-[#fff1e7] text-[#ff7b00]" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}
              >
                <span className={`material-symbols-outlined text-xl ${active ? "fill-current" : ""}`}>{item.icon}</span>
                {item.label}
                {item.badge && <span className="ml-auto rounded-full bg-[#6558f5] px-2 py-0.5 text-[8px] font-extrabold text-white">{item.badge}</span>}
              </button>
            );
          })}
        </nav>

        {/* Allergen Filters in Sidebar */}
        <div className="m-4 rounded-xl border border-[#eeeaf9] bg-[#faf9ff] p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600">
            <span className="material-symbols-outlined text-sm text-[#ff7b00]">shield</span>
            BỘ LỌC KIÊNG KHEM
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[9px] font-bold text-red-600">
              Không hải sản
            </span>
            <span className="rounded-full bg-orange-50 border border-orange-100 px-2 py-0.5 text-[9px] font-bold text-[#ff7b00]">
              Không hành
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-[#eeeeF4] bg-white px-4 lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden"><Logo compact /></div>
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold tracking-tight lg:hidden">{activeTitle}</p>
            </div>
          </div>

          {/* Search Prompt */}
          <form className="mx-5 hidden max-w-xl flex-1 lg:block" onSubmit={(e) => { e.preventDefault(); navigate("chat"); }}>
            <label className="flex h-9 items-center gap-2 rounded-full bg-[#f6f6fa] px-4 text-gray-400 cursor-pointer">
              <span className="material-symbols-outlined text-lg">search</span>
              <input className="min-w-0 flex-1 bg-transparent text-xs text-gray-700 outline-none" placeholder="Hỏi EatWise AI: Tìm món thanh đạm, ít dầu mỡ, gần nhất..." />
              <span className="rounded-full bg-[#ebe8ff] px-2 py-1 text-[8px] font-bold text-[#6558f5]">AI Prompt</span>
            </label>
          </form>

          {/* User Info & Weather */}
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[11px] font-bold text-gray-500 xl:flex">
              <span className="material-symbols-outlined text-base text-[#ffb000]">partly_cloudy_day</span> Hà Nội 24°C
            </span>
            <div className="max-w-[120px] sm:max-w-[190px] text-right cursor-pointer" onClick={() => navigate("profile")}>
              <strong className="block truncate text-[11px] sm:text-sm">
                {user?.displayName || "Nguyễn Tuấn Khang"} <span className="text-[#ff7b00] font-bold text-[10px]">Gold</span>
              </strong>
              <small className="block truncate text-[9px] text-gray-400 sm:text-xs">
                {user?.email || "khang.ai@eatwise.vn"}
              </small>
            </div>
            <button
              onClick={logout}
              title="Đăng xuất"
              aria-label="Đăng xuất"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ff7b00] text-white shadow-sm transition hover:bg-[#e86f00]"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </header>

        {notice && (
          <div role="status" className="mx-4 mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 lg:mx-8 shadow-sm">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} className="ml-3 text-base">×</button>
          </div>
        )}

        {/* Dynamic Route Content */}
        <main className="min-h-0 flex-1 overflow-hidden pb-16 lg:pb-0">
          {screen === "today" && <DiscoveryPage onNavigate={navigate} />}
          {screen === "chat" && <ChatPage />}
          {screen === "map" && <MapPage onNavigate={navigate} />}
          {screen === "profile" && <ProfilePage onSaved={setNotice} />}
          {screen === "history" && <HistoryPage onNavigate={navigate} />}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t border-gray-100 bg-white/95 px-2 backdrop-blur lg:hidden">
          {navItems.map((item) => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${active ? "text-[#ff7b00]" : "text-gray-400"}`}
              >
                <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

    </div>
  );
}

function Logo({ compact = false }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff7b00] text-white shadow-sm">
      <span className="material-symbols-outlined text-[22px]">restaurant</span>
    </span>
  );
}
