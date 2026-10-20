import React, { useState } from "react";

export default function MobileDiscoveryView({
  cards = [],
  heroCard,
  loading,
  refreshing,
  learningSummary,
  catalogFallback,
  activeCategory,
  setActiveCategory,
  categories = [],
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  mealPeriod,
  mealPeriodLabels = {},
  profile,
  currentLocation,
  locationStatus,
  locationError,
  onUseCurrentLocation,
  onNavigate,
  handleFindDateVenue,
  handleOpenWheel,
  handleFindRestaurants,
  handleLikeDish,
  handleChooseDish,
  likedDishes = new Set(),
  chosenDishes = new Set(),
  pendingLikes = new Set(),
  pendingSelections = new Set(),
  money = (v) => `${v}đ`,
  distance = (v) => `${v}m`,
  priceTierClasses = {},
  DishImage,
}) {
  const [activeStory, setActiveStory] = useState(null);

  // Filter and sort cards
  const filteredCards = cards.filter((card) => {
    if (activeCategory !== "all" && card.category !== activeCategory) {
      if (activeCategory === "recipe" && card.sourceType !== "RECIPE") return false;
      if (activeCategory !== "recipe" && card.sourceType === "RECIPE") return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (card.title || "").toLowerCase().includes(q);
      const matchDesc = (card.description || "").toLowerCase().includes(q);
      return matchTitle || matchDesc;
    }
    return true;
  });

  const catalogCards = filteredCards.filter((c) => c.sourceType !== "RECIPE" && c.kind !== "RECIPE");
  const secondaryCards = heroCard ? catalogCards.filter((c) => c.id !== heroCard.id) : catalogCards;
  const recipeCards = filteredCards.filter((c) => c.sourceType === "RECIPE" || c.kind === "RECIPE");

  const storyItems = [
    { id: "wheel", label: "Quay món", icon: "casino", color: "from-purple-500 to-indigo-600", action: handleOpenWheel },
    { id: "date", label: "Đi Date", icon: "wine_bar", color: "from-pink-500 to-rose-500", action: handleFindDateVenue },
    { id: "ai", label: "Hỏi AI", icon: "smart_toy", color: "from-orange-500 to-amber-500", action: () => onNavigate("chat") },
    { id: "noodle", label: "Bún & Phở", icon: "ramen_dining", color: "from-emerald-500 to-teal-600", action: () => setActiveCategory("noodle") },
    { id: "rice", label: "Món Cơm", icon: "rice_bowl", color: "from-blue-500 to-cyan-600", action: () => setActiveCategory("rice") },
    { id: "healthy", label: "Healthy", icon: "eco", color: "from-lime-500 to-emerald-600", action: () => setActiveCategory("healthy") },
  ];

  return (
    <div className="flex flex-col min-h-full w-full bg-[#f8f9fd] text-[#1e1e24] pb-24 overflow-x-hidden">
      
      {/* ── MOBILE HEADER (STORY & SEARCH BAR) ── */}
      <header className="shrink-0 sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100/80 px-4 pt-3 pb-2.5 shadow-sm">
        {/* Top Mini Line: Location & GPS */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={onUseCurrentLocation}
            disabled={locationStatus === "loading"}
            aria-label={locationStatus === "loading" ? "Đang định vị" : "Dùng GPS"}
            className="flex items-center gap-1.5 min-w-0 max-w-[240px] text-left active:opacity-70 transition"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#ff7b00]">
              <span className={`material-symbols-outlined text-[15px] ${locationStatus === "loading" ? "animate-spin" : ""}`}>
                {locationStatus === "loading" ? "progress_activity" : "near_me"}
              </span>
            </span>
            <div className="min-w-0">
              <span className="block truncate text-xs font-black text-gray-900 leading-tight">
                {currentLocation
                  ? `GPS ${currentLocation.latitude.toFixed(2)}, ${currentLocation.longitude.toFixed(2)}`
                  : profile?.areaLabel || "Vị trí chưa lưu"}
              </span>
            </div>
            <span className="material-symbols-outlined text-xs text-gray-400">expand_more</span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onNavigate("chat")}
              aria-label="Hỏi Trợ Lý AI"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 text-[11px] font-black active:scale-95 transition"
            >
              <span className="material-symbols-outlined text-sm">smart_toy</span>
              <span>Chat AI</span>
            </button>
            <button
              onClick={() => onNavigate("profile")}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-700 border border-gray-200 active:scale-95 transition"
              title="Hồ sơ vị giác"
            >
              <span className="material-symbols-outlined text-[15px]">person</span>
            </button>
          </div>
        </div>

        {/* Search Bar & Sorter Inline */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              search
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Bạn muốn ăn món gì hôm nay?"
              className="h-9 w-full pl-8 pr-7 rounded-2xl bg-gray-100/90 border border-transparent text-xs font-bold text-gray-800 placeholder-gray-400 outline-none focus:bg-white focus:border-orange-400 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-9 px-2.5 rounded-2xl bg-gray-100/90 border border-transparent text-[11px] font-bold text-gray-700 outline-none active:bg-white focus:bg-white focus:border-orange-400 transition"
          >
            <option value="best_match">✨ Phù hợp</option>
            <option value="price_asc">💵 Giá tốt</option>
            <option value="rating_desc">⭐ Đánh giá</option>
          </select>
        </div>
      </header>

      {/* ── INTEGRATED FOOD CATEGORY & STORY BAR ── */}
      <div className="shrink-0 px-3.5 py-3 overflow-x-auto scrollbar-hide flex items-center gap-3.5 bg-white border-b border-gray-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
        {/* Special Action: Quay món */}
        <button
          onClick={handleOpenWheel}
          aria-label="Ăn gì hôm nay? Quay vòng ngẫu nhiên"
          className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white shadow-md">
            <span className="material-symbols-outlined text-xl">casino</span>
          </div>
          <span className="text-[10px] font-black text-purple-700 whitespace-nowrap">
            Quay món
          </span>
        </button>

        {/* Special Action: Quán Date */}
        <button
          onClick={handleFindDateVenue}
          aria-label="Đi Date"
          className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-md">
            <span className="material-symbols-outlined text-xl">wine_bar</span>
          </div>
          <span className="text-[10px] font-black text-pink-700 whitespace-nowrap">
            Đi Date
          </span>
        </button>

        <div className="h-8 w-[1px] bg-gray-200 shrink-0" />

        {/* Categories */}
        {categories.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl transition-all ${
                  active
                    ? "bg-[#ff7b00] text-white shadow-md scale-105 border-2 border-orange-400"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span>{cat.emoji}</span>
              </div>
              <span
                className={`text-[10px] whitespace-nowrap font-black ${
                  active ? "text-[#ff7b00]" : "text-gray-600"
                }`}
              >
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-3.5 pt-3.5 flex flex-col gap-4">
        {/* Location Alert */}
        {locationStatus === "error" && locationError && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">
            <span className="material-symbols-outlined text-sm shrink-0">warning</span>
            <span>{locationError}</span>
          </div>
        )}

        {/* ── HERO DISH CARD: FOOD MAGAZINE STYLE ── */}
        {heroCard && (
          <section aria-label="Món gợi ý nổi bật">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-black text-orange-600 uppercase tracking-wide">
                <span className="material-symbols-outlined text-sm">local_fire_department</span>
                Gợi ý {mealPeriodLabels[mealPeriod] || "hôm nay"}
              </span>
              <button
                onClick={handleOpenWheel}
                aria-label="Ăn gì hôm nay? Quay vòng ngẫu nhiên"
                className="text-[11px] font-extrabold text-purple-600 flex items-center gap-0.5 active:opacity-70"
              >
                <span>Quay ngẫu nhiên</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-white shadow-md border border-gray-100">
              {/* Dish Image */}
              <div
                className="relative h-56 w-full cursor-pointer overflow-hidden bg-stone-100"
                onClick={() => handleFindRestaurants(heroCard)}
              >
                <DishImage
                  card={heroCard}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  fallbackClassName="h-56"
                  eager
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                {/* Badges on Image */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-emerald-500/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-black text-white shadow-sm flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">thumb_up</span>
                    95% khẩu vị
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLikeDish(heroCard);
                    }}
                    aria-label={`Yêu thích: ${heroCard.title}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition active:scale-90 ${
                      likedDishes.has(heroCard.dishId || heroCard.id)
                        ? "bg-red-500 text-white"
                        : "bg-black/40 text-white hover:bg-black/60"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-base"
                      style={likedDishes.has(heroCard.dishId || heroCard.id) ? { fontVariationSettings: "'FILL' 1" } : {}}
                    >
                      favorite
                    </span>
                  </button>
                </div>

                {/* Content Overlay */}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  {heroCard.priceTier?.label && (
                    <span className="inline-block rounded-md bg-white/20 backdrop-blur-md px-2 py-0.5 text-[9px] font-black tracking-wider uppercase mb-1">
                      {heroCard.priceTier.label}
                    </span>
                  )}
                  <h2
                    className="text-xl font-black leading-tight drop-shadow-sm cursor-pointer"
                    onClick={() => handleFindRestaurants(heroCard)}
                  >
                    {heroCard.title}
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold text-white/80 line-clamp-1">
                    {heroCard.description || "Hương vị hấp dẫn, chế biến chuẩn vị thơm ngon."}
                  </p>
                </div>
              </div>

              {/* Price & Action Row */}
              <div className="flex items-center justify-between p-3.5 bg-white">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block">Ước tính giá</span>
                  <span className="text-lg font-black text-[#ff7b00]">
                    {money(heroCard.price || heroCard.priceMin || 50000)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleFindRestaurants(heroCard)}
                    aria-label={`Xem quán gần bạn cho món ${heroCard.title}`}
                    className="px-4 py-2 rounded-xl text-xs font-black text-white bg-[#ff7b00] shadow-md btn-3d-orange active:scale-95 transition"
                  >
                    Xem quán & chọn món
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── QUICK ACTION MINI BANNER (ĂN GÌ HÔM NAY / DATE) ── */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={handleOpenWheel}
            aria-label="Ăn gì hôm nay? Quay vòng ngẫu nhiên"
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm active:scale-95 transition text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
              <span className="material-symbols-outlined text-lg">casino</span>
            </span>
            <div className="min-w-0">
              <span className="block text-xs font-black leading-tight">Ăn gì hôm nay?</span>
              <span className="block text-[9px] text-purple-200 font-semibold truncate">Quay roulette 3 giây</span>
            </div>
          </button>

          <button
            onClick={handleFindDateVenue}
            aria-label="Tìm quán đi date"
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-sm active:scale-95 transition text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
              <span className="material-symbols-outlined text-lg">wine_bar</span>
            </span>
            <div className="min-w-0">
              <span className="block text-xs font-black leading-tight">Tìm quán đi date</span>
              <span className="block text-[9px] text-pink-200 font-semibold truncate">Không gian lãng mạn</span>
            </div>
          </button>
        </div>

        {/* ── CATALOG DISHES FEED (2-COL MOBILE GRID) ── */}
        <section aria-label="Món hợp gu của bạn">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-1.5">
              <span>Món hợp gu của bạn</span>
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                {secondaryCards.length}
              </span>
            </h3>
            <button
              onClick={onUseCurrentLocation}
              disabled={locationStatus === "loading"}
              className="text-[10px] font-black text-gray-500 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-xs">refresh</span>
              Làm mới gợi ý
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {secondaryCards.map((card) => {
              const isLiked = likedDishes.has(card.dishId || card.id);
              const isChosen = chosenDishes.has(card.dishId || card.id);
              return (
                <div
                  key={card.id}
                  className="flex flex-col overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm active:scale-[0.98] transition cursor-pointer"
                  onClick={() => handleFindRestaurants(card)}
                >
                  {/* Dish Image */}
                  <div className="relative h-28 w-full bg-stone-100">
                    <DishImage
                      card={card}
                      className="h-full w-full object-cover"
                      fallbackClassName="h-28"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLikeDish(card);
                      }}
                      aria-label={`Yêu thích: ${card.title}`}
                      className={`absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition active:scale-90 ${
                        isLiked ? "bg-red-500 text-white" : "bg-black/35 text-white"
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-sm"
                        style={isLiked ? { fontVariationSettings: "'FILL' 1" } : {}}
                      >
                        favorite
                      </span>
                    </button>
                    {card.priceTier?.label && (
                      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 backdrop-blur-md px-1.5 py-0.5 text-[8px] font-extrabold text-white uppercase">
                        {card.priceTier.label}
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-2.5 flex flex-col flex-1 justify-between">
                    <div>
                      <h4 className="text-xs font-black text-gray-900 leading-tight line-clamp-1">
                        {card.title}
                      </h4>
                      <p className="mt-0.5 text-[10px] text-gray-400 line-clamp-1 font-medium">
                        {card.description || "Món ngon chọn lọc"}
                      </p>
                    </div>

                    <div className="mt-2 flex items-center justify-between pt-1 border-t border-gray-50">
                      <span className="text-xs font-black text-[#ff7b00]">
                        {money(card.price || card.priceMin || 45000)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFindRestaurants(card);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-50 text-orange-600 active:bg-orange-500 active:text-white transition"
                        title="Xem quán"
                      >
                        <span className="material-symbols-outlined text-sm">storefront</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── RECIPE INSPIRATION (HORIZONTAL SLIDER) ── */}
        {recipeCards.length > 0 && (
          <section data-recipe-inspiration className="mt-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-violet-600">soup_kitchen</span>
                <span>Cảm hứng nấu ăn</span>
              </h3>
              <span className="text-[10px] font-bold text-gray-400">Tự làm tại nhà</span>
            </div>

            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide py-1">
              {recipeCards.map((recipe) => (
                <div
                  key={recipe.id}
                  onClick={() => handleFindRestaurants(recipe)}
                  className="flex-shrink-0 w-44 rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm active:scale-95 transition cursor-pointer"
                >
                  <div className="relative h-24 w-full bg-stone-100">
                    <DishImage
                      card={recipe}
                      className="h-full w-full object-cover"
                      fallbackClassName="h-24"
                    />
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-violet-600/90 px-1.5 py-0.5 text-[8px] font-black text-white uppercase">
                      Công thức
                    </span>
                  </div>
                  <div className="p-2">
                    <h4 className="text-xs font-black text-gray-900 line-clamp-1">
                      {recipe.title}
                    </h4>
                    <p className="mt-0.5 text-[9px] text-gray-400 font-medium line-clamp-1">
                      {recipe.instructions ? "Có hướng dẫn từng bước" : "Món tự nấu"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Learning Summary Banner */}
        {learningSummary && (
          <div className="rounded-2xl border border-orange-200/80 bg-orange-50/70 p-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm">
              <span className="material-symbols-outlined text-base">psychology</span>
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black text-gray-900">
                {learningSummary.confidence === "ESTABLISHED"
                  ? "EatWise đã thấu hiểu khẩu vị của bạn"
                  : "EatWise đang học khẩu vị riêng của bạn"}
              </p>
              <p className="text-[10px] text-gray-500 font-medium">
                {learningSummary.sampleSize || 0} tín hiệu học máy cá nhân hóa
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
