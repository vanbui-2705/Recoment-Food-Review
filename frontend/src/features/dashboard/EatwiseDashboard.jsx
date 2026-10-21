import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACCESS_TOKEN_KEY,
  apiRequest,
  getAccessToken,
  profileToPayload,
  replaceProfile,
} from "../../profileApi.js";
import DiscoveryPage from "../../pages/DiscoveryPage.jsx";
import ChatPage from "../../pages/ChatPage.jsx";
import MapPage from "../../pages/MapPage.jsx";
import ProfilePage from "../../pages/ProfilePage.jsx";
import HistoryPage from "../../pages/HistoryPage.jsx";
import LoginPage from "../../pages/LoginPage.jsx";
import AdminAccountsPage from "../../pages/AdminAccountsPage.jsx";
import CartDrawer from "../ordering/CartDrawer.jsx";
import DishCustomizerModal from "../ordering/DishCustomizerModal.jsx";
import RestaurantStorefrontModal from "../ordering/RestaurantStorefrontModal.jsx";
import CheckoutModal from "../ordering/CheckoutModal.jsx";
import OrderTrackingModal from "../ordering/OrderTrackingModal.jsx";

const screens = ["today", "chat", "map", "profile", "history", "admin-users"];
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
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationError, setLocationError] = useState("");
  const [chatPrompt, setChatPrompt] = useState("");
  const autoLocationAttempted = useRef(false);

  // Ordering State
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("eatwise_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [selectedStorefrontRestaurant, setSelectedStorefrontRestaurant] = useState(null);
  const [dishToCustomize, setDishToCustomize] = useState(null);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState(() => {
    try {
      const saved = localStorage.getItem("eatwise_active_order");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("eatwise_cart", JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  useEffect(() => {
    try {
      if (activeTrackingOrder) {
        localStorage.setItem("eatwise_active_order", JSON.stringify(activeTrackingOrder));
      } else {
        localStorage.removeItem("eatwise_active_order");
      }
    } catch {
      // ignore
    }
  }, [activeTrackingOrder]);

  const handleAddToCart = (item) => {
    setCart((prev) => {
      const firstRes = prev[0]?.restaurantName;
      if (firstRes && firstRes !== item.restaurantName) {
        return [item];
      }
      const existingIdx = prev.findIndex(
        (p) =>
          p.dishId === item.dishId &&
          p.customizations?.size === item.customizations?.size &&
          p.customizations?.sugar === item.customizations?.sugar &&
          p.customizations?.ice === item.customizations?.ice &&
          p.customizations?.spice === item.customizations?.spice
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].quantity += item.quantity;
        return copy;
      }
      return [...prev, item];
    });
    setDishToCustomize(null);
    setNotice(`Đã thêm “${item.name}” vào giỏ hàng!`);
    setTimeout(() => setNotice(""), 3500);
  };

  const handleUpdateQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleOpenStorefront = (restaurant, dish) => {
    setSelectedStorefrontRestaurant(restaurant);
    if (dish) {
      // opened from specific dish
    }
  };

  const handleOrderDish = (dish, restaurant) => {
    setDishToCustomize({
      dish,
      restaurant: restaurant || {
        name: dish.restaurantName || "Quán Ăn Chọn Lọc",
        id: dish.id,
      },
    });
  };

  const handleOrderSuccess = (createdOrder) => {
    setCart([]);
    setIsCheckoutOpen(false);
    setActiveTrackingOrder(createdOrder);
    setIsTrackingOpen(true);
    setNotice(`Đặt đơn thành công! Mã đơn #${createdOrder.id}`);
  };

  const totalCartAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalCartCount = cart.reduce((count, item) => count + item.quantity, 0);

  const money = (val) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(val || 0);

  useEffect(() => {
    const sync = () => setScreen(readScreen());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    const expired = () => {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      sessionStorage.removeItem("food_refresh_token");
      setSignedIn(false);
      setUser(null);
      setProfile(null);
      setProfileLoaded(false);
      setCurrentLocation(null);
      setLocationStatus("idle");
      setLocationError("");
      autoLocationAttempted.current = false;
      setNotice("Phiên đăng nhập đã hết hạn.");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    window.addEventListener("food-session-expired", expired);
    return () => window.removeEventListener("food-session-expired", expired);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    setProfileLoaded(false);
    apiRequest("/users/me")
      .then((response) => setUser(response.data.user))
      .catch(() => {});
    apiRequest("/users/me/profile")
      .then((response) => setProfile(response.data.profile))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoaded(true));
  }, [signedIn]);

  const navigate = (next) => {
    window.location.hash = next;
    setScreen(next);
  };

  const logout = async () => {
    const refreshToken = sessionStorage.getItem("food_refresh_token") || "";
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem("food_refresh_token");
    setSignedIn(false);
    setUser(null);
    setProfile(null);
    setProfileLoaded(false);
    setCurrentLocation(null);
    setLocationStatus("idle");
    setLocationError("");
    autoLocationAttempted.current = false;
    setNotice("Đã đăng xuất tài khoản.");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Local logout is still valid
    }
  };

  const useCurrentLocation = () => {
    if (locationStatus === "loading") return;
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationError("Trình duyệt này không hỗ trợ định vị.");
      return;
    }

    setLocationStatus("loading");
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLocation = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        setCurrentLocation(nextLocation);
        setLocationStatus("success");
        if (profile) {
          replaceProfile(profileToPayload(profile, nextLocation))
            .then((response) => setProfile(response.data.profile))
            .catch(() => {
              // Live GPS remains usable for this session even if profile persistence fails.
            });
        }
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Bạn chưa cấp quyền truy cập vị trí."
            : error.code === error.TIMEOUT
              ? "Không lấy được vị trí kịp thời. Vui lòng thử lại."
              : "Không thể xác định vị trí hiện tại.";
        setLocationStatus("error");
        setLocationError(message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    if (!signedIn || !profileLoaded || autoLocationAttempted.current) return;
    autoLocationAttempted.current = true;
    useCurrentLocation();
  }, [signedIn, profileLoaded]);

  const effectiveNavItems = useMemo(() => {
    if (user?.role === "ADMIN") {
      return [
        ...navItems,
        { id: "admin-users", icon: "manage_accounts", label: "Quản trị User", badge: "Admin" },
      ];
    }
    return navItems;
  }, [user?.role]);

  const activeTitle = effectiveNavItems.find((item) => item.id === screen)?.label || "Khám phá";

  if (!signedIn) {
    return (
      <LoginPage
        notice={notice}
        onAuthenticated={() => {
          setNotice("");
          setSignedIn(true);
        }}
      />
    );
  }

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
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locationStatus === "loading"}
          title="Dùng vị trí hiện tại"
          className="mx-4 rounded-xl border border-[#e6e2ff] bg-[#f6f4ff] p-3 text-left disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#6c63ff] shadow-sm">
              <span className="material-symbols-outlined text-xl">location_on</span>
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-gray-400">Vị trí hiện tại</p>
              <p className="truncate text-xs font-bold">
                {currentLocation
                  ? `GPS ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                  : profile?.areaLabel || "Vị trí chưa lưu"}
              </p>
            </div>
            <span className="material-symbols-outlined ml-auto text-base text-gray-400">expand_more</span>
          </div>
        </button>

        {/* Navigation Items */}
        <nav className="mt-5 flex-1 space-y-1 px-3">
          {effectiveNavItems.map((item) => {
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
        <header className={`${screen === "today" ? "hidden lg:flex" : "flex"} h-[64px] shrink-0 items-center justify-between border-b border-[#eeeeF4] bg-white px-4 lg:px-6 z-20`}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden"><Logo compact /></div>
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-base font-black text-gray-900 tracking-tight truncate">{activeTitle}</p>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-black text-orange-600 bg-orange-50 border border-orange-200/60 px-2.5 py-0.5 rounded-full shrink-0">
                ✨ Không biết ăn gì có EatWise
              </span>
            </div>
          </div>

          {/* Search Prompt */}
          <form className="mx-4 hidden max-w-md flex-1 md:block" onSubmit={(e) => { e.preventDefault(); navigate("chat"); }}>
            <label className="flex h-9 items-center gap-2 rounded-full bg-[#f6f6fa] px-4 text-gray-400 cursor-pointer border border-transparent focus-within:border-orange-300 focus-within:bg-white transition">
              <span className="material-symbols-outlined text-lg">search</span>
              <input
                value={chatPrompt}
                onChange={(event) => setChatPrompt(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs text-gray-700 outline-none"
                placeholder="Hỏi EatWise AI: Tìm món thanh đạm, gần nhất..."
              />
              <span className="rounded-full bg-[#ebe8ff] px-2 py-0.5 text-[8px] font-extrabold text-[#6558f5]">AI Prompt</span>
            </label>
          </form>

          {/* User Info & Weather */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden items-center gap-1.5 text-[11px] font-bold text-gray-500 xl:flex bg-gray-50 px-2.5 py-1 rounded-xl border border-gray-100">
              <span className="material-symbols-outlined text-base text-[#ffb000]">partly_cloudy_day</span> Hà Nội 24°C
            </span>
            <div className="max-w-[130px] sm:max-w-[240px] text-right cursor-pointer" onClick={() => navigate("profile")} title={user?.email || ""}>
              <div className="flex items-center justify-end gap-1">
                <strong className="truncate text-xs sm:text-sm font-black text-gray-800">
                  {user?.displayName || "Người dùng"}
                </strong>
                {user?.role === "ADMIN" ? (
                  <span className="text-purple-600 font-extrabold text-[9px] bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded shrink-0">Admin</span>
                ) : (
                  <span className="text-[#ff7b00] font-extrabold text-[9px] bg-orange-50 border border-orange-200 px-1.5 py-0.2 rounded shrink-0">Gold</span>
                )}
              </div>
              <small className="block truncate text-[10px] text-gray-400 sm:text-xs font-medium">
                {user?.email || "khang.ai@eatwise.vn"}
              </small>
            </div>
            <button
              onClick={logout}
              title="Đăng xuất"
              aria-label="Đăng xuất"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff7b00] text-white shadow-md btn-3d-orange transition hover:bg-[#e86f00]"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
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
          {screen === "today" && (
            <DiscoveryPage
              onNavigate={navigate}
              profile={profile}
              profileLoaded={profileLoaded}
              currentLocation={currentLocation}
              locationStatus={locationStatus}
              locationError={locationError}
              onUseCurrentLocation={useCurrentLocation}
              onOpenStorefront={handleOpenStorefront}
              onOrderDish={handleOrderDish}
              cart={cart}
              onOpenCart={() => setIsCartOpen(true)}
            />
          )}
          {screen === "chat" && (
            <ChatPage
              initialPrompt={chatPrompt}
              onInitialPromptConsumed={() => setChatPrompt("")}
              currentLocation={currentLocation}
              profile={profile}
              user={user}
              onNavigate={navigate}
              onProfileChanged={setProfile}
              onSaved={setNotice}
            />
          )}
          {screen === "map" && (
            <MapPage
              onNavigate={navigate}
              profile={profile}
              profileLoaded={profileLoaded}
              currentLocation={currentLocation}
              locationStatus={locationStatus}
              locationError={locationError}
              onUseCurrentLocation={useCurrentLocation}
              onOpenStorefront={handleOpenStorefront}
            />
          )}
          {screen === "profile" && (
            <ProfilePage
              user={user}
              profile={profile}
              onProfileChanged={setProfile}
              onSaved={setNotice}
              onNavigate={navigate}
            />
          )}
          {screen === "history" && <HistoryPage onNavigate={navigate} />}
          {screen === "admin-users" && user?.role === "ADMIN" && (
            <AdminAccountsPage user={user} onNavigate={navigate} />
          )}
        </main>

        {/* Floating Cart Button */}
        {cart.length > 0 && (
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            aria-label={`Giỏ hàng ${totalCartCount} món, ${money(totalCartAmount)}`}
            className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-3 bg-gradient-to-r from-[#ff7b00] to-orange-500 text-white px-4 py-3 rounded-2xl shadow-xl shadow-orange-500/30 hover:scale-105 active:scale-95 transition btn-3d-orange border border-white/20"
          >
            <div className="relative">
              <span className="material-symbols-outlined text-2xl">shopping_cart</span>
              <span className="absolute -top-1.5 -right-2 bg-white text-orange-600 text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow">
                {totalCartCount}
              </span>
            </div>
            <div className="text-left font-black leading-tight text-xs pr-1">
              <p className="text-[10px] text-orange-100 font-semibold truncate max-w-[120px]">
                {cart[0]?.restaurantName || "Đơn hàng"}
              </p>
              <p>{money(totalCartAmount)}</p>
            </div>
          </button>
        )}

        {/* Floating Active Order Tracker Pill */}
        {activeTrackingOrder &&
          activeTrackingOrder.status !== "cancelled" &&
          activeTrackingOrder.status !== "completed" && (
            <button
              type="button"
              onClick={() => setIsTrackingOpen(true)}
              aria-label={`Theo dõi đơn hàng ${activeTrackingOrder.id}`}
              className="fixed bottom-20 lg:bottom-6 left-4 sm:left-6 z-40 flex items-center gap-2.5 bg-gray-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-gray-700 hover:bg-black active:scale-95 transition"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <div className="text-left text-xs font-bold leading-tight">
                <span className="text-orange-400 font-black">#{activeTrackingOrder.id}</span>
                <span className="text-[11px] text-gray-300 ml-1.5 hidden sm:inline">
                  Đang giao hàng
                </span>
              </div>
            </button>
          )}

        {/* ── ORDERING & CHECKOUT MODALS ── */}
        <CartDrawer
          cart={cart}
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          onCheckout={() => {
            setIsCartOpen(false);
            setIsCheckoutOpen(true);
          }}
        />

        <DishCustomizerModal
          dish={dishToCustomize?.dish}
          restaurant={dishToCustomize?.restaurant}
          isOpen={Boolean(dishToCustomize)}
          onClose={() => setDishToCustomize(null)}
          onAddToCart={handleAddToCart}
        />

        <RestaurantStorefrontModal
          restaurant={selectedStorefrontRestaurant}
          isOpen={Boolean(selectedStorefrontRestaurant)}
          onClose={() => setSelectedStorefrontRestaurant(null)}
          onSelectDish={(dish) => handleOrderDish(dish, selectedStorefrontRestaurant)}
        />

        <CheckoutModal
          cart={cart}
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          onOrderSuccess={handleOrderSuccess}
        />

        <OrderTrackingModal
          order={activeTrackingOrder}
          isOpen={isTrackingOpen}
          onClose={() => setIsTrackingOpen(false)}
          onOrderUpdated={(updated) => setActiveTrackingOrder(updated)}
        />

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t border-gray-100 bg-white/95 px-2 backdrop-blur lg:hidden">
          {effectiveNavItems.map((item) => {
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
