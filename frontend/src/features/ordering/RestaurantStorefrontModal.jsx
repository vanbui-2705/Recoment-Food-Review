import { useMemo, useState } from "react";
import { getRestaurantMenu, resolveDishImage } from "../../menuData.js";

export default function RestaurantStorefrontModal({
  restaurant,
  isOpen,
  onClose,
  onSelectDish,
}) {
  if (!isOpen || !restaurant) return null;

  const [activeCategory, setActiveCategory] = useState("all");

  const menuItems = useMemo(() => {
    return getRestaurantMenu(restaurant);
  }, [restaurant]);

  const filteredItems = useMemo(() => {
    if (activeCategory === "all") return menuItems;
    return menuItems.filter((m) => m.category === activeCategory);
  }, [menuItems, activeCategory]);

  const money = (val) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(val || 0);

  const bannerImg = resolveDishImage(restaurant.name, restaurant.id || "res_banner");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-2xl max-h-[92vh] bg-[#f8f9fc] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeInScale border border-gray-100">
        
        {/* Banner & Storefront Header */}
        <div className="relative h-44 sm:h-52 w-full bg-stone-900 shrink-0">
          <img
            src={bannerImg}
            alt={restaurant.name}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition"
          >
            ✕
          </button>

          {/* Restaurant info overlay */}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider">
                Đang mở cửa
              </span>
              <span className="px-2 py-0.5 rounded bg-white/20 backdrop-blur text-yellow-300 text-[10px] font-bold flex items-center gap-1">
                ★ {restaurant.rating || "4.8"} (500+ đánh giá)
              </span>
              <span className="px-2 py-0.5 rounded bg-white/20 backdrop-blur text-white text-[10px] font-bold">
                🛵 Giao dự kiến: 15-25 phút
              </span>
            </div>

            <h1 className="text-lg sm:text-2xl font-black text-white leading-tight">
              {restaurant.name}
            </h1>
            <p className="text-xs text-gray-300 truncate mt-0.5">
              📍 {restaurant.address || "Quận 1, Thành phố Hồ Chí Minh"}
            </p>
          </div>
        </div>

        {/* 3rd Party Delivery Shortcut Bar */}
        <div className="bg-white px-4 py-2.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-extrabold text-gray-700 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-[#ff7b00]">storefront</span>
            <span>Thực đơn chính thức của quán</span>
          </span>

          <div className="flex items-center gap-2">
            <a
              href={`https://shopeefood.vn/ho-chi-minh/danh-sach-dia-diem?q=${encodeURIComponent(restaurant.name)}`}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#ee4d2d] border border-orange-200 text-[11px] font-bold transition flex items-center gap-1"
              title="Mở gian hàng quán trên ShopeeFood"
            >
              <span>🛵 ShopeeFood</span>
            </a>
            <a
              href={`https://food.grab.com/vn/vi/restaurants?search=${encodeURIComponent(restaurant.name)}`}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition flex items-center gap-1"
              title="Mở gian hàng quán trên GrabFood"
            >
              <span>🟢 GrabFood</span>
            </a>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="bg-white px-4 py-2 border-b border-gray-100 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          {[
            { id: "all", label: `Tất cả (${menuItems.length})` },
            { id: "Món chính", label: "🍜 Món chính" },
            { id: "Món ăn kèm", label: "🥢 Món ăn kèm & Topping" },
            { id: "Đồ uống", label: "🥤 Đồ uống & Tráng miệng" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activeCategory === cat.id
                  ? "bg-[#ff7b00] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Menu Items List */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectDish(item, restaurant)}
              className="p-3 bg-white rounded-2xl border border-gray-100 hover:border-orange-200 hover:shadow-md transition cursor-pointer flex gap-3.5 items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-xs sm:text-sm text-gray-900 truncate">
                    {item.name}
                  </h3>
                  {item.isBestSeller && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[9px] font-black uppercase shrink-0">
                      Bán chạy
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                  {item.description}
                </p>

                <div className="flex items-center gap-2 mt-2">
                  <strong className="text-xs sm:text-sm font-black text-[#ff7b00]">
                    {money(item.price)}
                  </strong>
                </div>
              </div>

              {/* Photo & Add button */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectDish(item, restaurant);
                  }}
                  className="absolute bottom-1 right-1 px-2 py-1 bg-[#ff7b00] text-white rounded-lg text-[10px] font-black shadow-md flex items-center gap-0.5 hover:bg-[#e66a00] transition active:scale-95"
                >
                  <span>+</span>
                  <span>Thêm</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-white border-t border-gray-100 text-center text-[11px] text-gray-500 font-medium">
          💡 Chọn món để tùy chỉnh Size, Đá/Đường, Topping và Đặt giao tận nơi.
        </div>

      </div>
    </div>
  );
}
