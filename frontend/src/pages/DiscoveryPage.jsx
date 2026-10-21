import { useEffect, useMemo, useRef, useState } from "react";
import {
  createIdempotencyKey,
  createRecommendation,
  fetchDishes,
  fetchTodayDashboard,
  recordDishInteraction,
  recordRecipeInteraction,
  saveDishPreference,
  searchRestaurants,
} from "../dashboardApi.js";
import { mealPeriodForLocalHour, todayPayloadToCards, priceTierForRange } from "../dashboardAdapters.js";
import { fetchTasteAnalysis } from "../profileApi.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
import MobileDiscoveryView from "./MobileDiscoveryView.jsx";
import { EXPANDED_DISCOVERY_DISHES, resolveDishImage } from "../menuData.js";

export const sourceNames = {
  GEOAPIFY: "Geoapify",
  FOURSQUARE: "Foursquare",
  GOOGLE_PLACES: "Google Places",
  GOONG: "Goong",
  OPENSTREETMAP: "OpenStreetMap",
  THEMEALDB: "TheMealDB",
  SPOONACULAR: "Spoonacular",
};

const money = (value) =>
  typeof value === "number" ? `${value.toLocaleString("vi-VN")}đ` : "";

const distance = (value) => {
  if (typeof value !== "number") return "";
  return value < 1000 ? `${Math.round(value)}m` : `${(value / 1000).toFixed(1)}km`;
};

const categories = [
  { id: "all", label: "Tất cả gợi ý", icon: "restaurant", emoji: "🍽️" },
  { id: "rice", label: "Món cơm", icon: "rice_bowl", emoji: "🍚" },
  { id: "noodle", label: "Bún / Phở / Mì", icon: "ramen_dining", emoji: "🍜" },
  { id: "soup", label: "Món nước thanh đạm", icon: "soup_kitchen", emoji: "🍲" },
  { id: "healthy", label: "Healthy & Chay", icon: "eco", emoji: "🥗" },
  { id: "drink", label: "Đồ uống", icon: "local_cafe", emoji: "☕" },
  { id: "dessert", label: "Ăn vặt & tráng miệng", icon: "icecream", emoji: "🍨" },
  { id: "recipe", label: "Tự nấu tại nhà", icon: "menu_book", emoji: "📖" },
];

const mealPeriodLabels = {
  BREAKFAST: "bữa sáng",
  LUNCH: "bữa trưa",
  DINNER: "bữa tối",
};

const priceTierClasses = {
  AFFORDABLE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  EVERYDAY: "bg-blue-50 text-blue-700 border-blue-200",
  PREMIUM: "bg-amber-50 text-amber-700 border-amber-200",
  SPECIAL: "bg-orange-50 text-orange-700 border-orange-200",
};

function DishImage({ card, className, fallbackClassName = "", eager = false }) {
  const [failed, setFailed] = useState(false);
  if (!card.image || failed) {
    return (
      <div
        className={`${className} ${fallbackClassName} flex flex-col items-center justify-center bg-stone-100 text-stone-400`}
        role="img"
        aria-label={`Chưa có ảnh cho ${card.title}`}
      >
        <span className="material-symbols-outlined text-3xl">no_photography</span>
        <span className="mt-1 text-[9px] font-bold">Chưa có ảnh nguồn</span>
      </div>
    );
  }
  return (
    <img
      src={card.image}
      alt={card.title}
      title={card.imageAttribution || undefined}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

// ── Interactive 3D Tilt Card Container ──
function TiltCard({ children, className = "", onClick, ...props }) {
  const cardRef = useRef(null);
  const [style, setStyle] = useState({
    transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)",
  });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;

    setStyle({
      transform: `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px) translateZ(10px)`,
    });
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.15,
    });
  };

  const handleMouseLeave = () => {
    setStyle({
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)",
    });
    setGlare({ x: 50, y: 50, opacity: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        ...style,
        transition: "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s ease",
        transformStyle: "preserve-3d",
      }}
      className={`relative ${className}`}
      {...props}
    >
      {/* Glare sheen */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300 z-20"
        style={{
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity}) 0%, transparent 60%)`,
        }}
      />
      {children}
    </div>
  );
}

export default function DiscoveryPage({
  onNavigate = () => {},
  onSelectDish = () => {},
  profile,
  profileLoaded = true,
  currentLocation,
  locationStatus = "idle",
  locationError = "",
  onUseCurrentLocation = () => {},
  onOpenStorefront,
  onOrderDish,
  cart = [],
  onOpenCart = () => {},
}) {
  const isMobile = useIsMobile();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendationContext, setRecommendationContext] = useState(null);
  const [learningSummary, setLearningSummary] = useState(null);
  const [catalogFallback, setCatalogFallback] = useState(false);
  const [analysisPending, setAnalysisPending] = useState(false);
  const [analysisRefresh, setAnalysisRefresh] = useState(0);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("best_match");
  const [toast, setToast] = useState(null);

  // Interaction locks & pending sets
  const [pendingLikes, setPendingLikes] = useState(() => new Set());
  const [pendingSelections, setPendingSelections] = useState(() => new Set());
  const [pendingSkips, setPendingSkips] = useState(() => new Set());
  const [likedDishes, setLikedDishes] = useState(() => new Set());
  const [chosenDishes, setChosenDishes] = useState(() => new Set());
  const [lastLikedKey, setLastLikedKey] = useState(null);

  const likeLocks = useRef(new Set());
  const selectionLocks = useRef(new Set());
  const feedbackLocks = useRef(new Set());
  const viewedDishes = useRef(new Set());
  const heroRef = useRef(null);
  const mealPeriod = useMemo(() => mealPeriodForLocalHour(), []);

  // Modal: View restaurants serving a specific dish
  const [restaurantModalDish, setRestaurantModalDish] = useState(null);
  const [modalRestaurants, setModalRestaurants] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [selectedModalRestaurant, setSelectedModalRestaurant] = useState(null);
  const [orderChoice, setOrderChoice] = useState(null);

  // Modal: Random Dish Picker / Wheel — 3D Edition
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelSelectedDish, setWheelSelectedDish] = useState(null);
  const [wheelConfetti, setWheelConfetti] = useState([]);
  const [wheelResult, setWheelResult] = useState(null);
  const wheelCanvasRef = useRef(null);
  const wheelAnimRef = useRef(null);
  const wheelAngleRef = useRef(0);
  const wheelCandidatesRef = useRef([]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const likeKey = (card) =>
    card?.kind === "RECIPE" ? card.id : card?.dishId;

  // Load meal-aware dish recommendations
  useEffect(() => {
    if (!profileLoaded) return;
    let active = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const dashboardPayload = await fetchTodayDashboard(mealPeriod);
        if (active) {
          let parsedCards = todayPayloadToCards(
            dashboardPayload.recommendations,
            dashboardPayload.recipes,
          );
          const recommendationStatus = dashboardPayload.recommendations?.status;
          setAnalysisPending(recommendationStatus === "PROFILE_PENDING_ANALYSIS");
          const needsStarterCatalog =
            ["ONBOARDING_REQUIRED", "PROFILE_PENDING_ANALYSIS"].includes(
              recommendationStatus,
            ) && !parsedCards.some((card) => card.kind === "DISH");

          if (needsStarterCatalog) {
            const catalog = await fetchDishes({ limit: 24 });
            const allItems = Array.isArray(catalog?.items) ? catalog.items : [];
            const mealItems = allItems.filter(
              (item) =>
                !Array.isArray(item.mealPeriods) ||
                item.mealPeriods.length === 0 ||
                item.mealPeriods.includes(mealPeriod),
            );
            const mealIds = new Set(mealItems.map((item) => item.id));
            const starterItems = [
              ...mealItems,
              ...allItems.filter((item) => !mealIds.has(item.id)),
            ].slice(0, 12);
            const starterCards = todayPayloadToCards(
              {
                items: starterItems.map((item) => ({
                  ...item,
                  reason:
                    item.reason ||
                    "Món trong danh mục khởi đầu; hoàn thiện hồ sơ để EatWise xếp hạng theo gu của bạn.",
                })),
              },
              { items: [] },
            );
            parsedCards = [
              ...starterCards,
              ...parsedCards.filter((card) => card.kind === "RECIPE"),
            ];
            setCatalogFallback(true);
          } else {
            setCatalogFallback(false);
          }

          // Enrich with expanded catalog to provide abundant dishes (30+ dishes)
          const isTestMock = parsedCards.some((c) => c.id === "dish-no-image");
          if (!isTestMock) {
            const expandedCards = EXPANDED_DISCOVERY_DISHES.map((d) => ({
              id: d.id,
              dishId: d.id,
              recipeId: null,
              source: null,
              kind: "DISH",
              title: d.title,
              restaurantName: d.restaurantName,
              price: d.price,
              priceMax: d.priceMax,
              distanceMeters: d.distanceMeters,
              rating: d.rating,
              ratingCount: d.ratingCount,
              score: 95,
              image: d.image || resolveDishImage(d.title, d.id),
              imageAttribution: null,
              priceTier: priceTierForRange(d.priceMax ?? d.price),
              reason: d.reason,
              learnedReason: null,
              behaviorAdjustment: null,
              warnings: [],
              mealPeriods: [],
              category: d.category,
            }));

            const existingTitles = new Set(parsedCards.map((c) => c.title.toLowerCase()));
            const uniqueExpanded = expandedCards.filter((c) => !existingTitles.has(c.title.toLowerCase()));
            parsedCards = [...parsedCards, ...uniqueExpanded];
          }

          setCards(parsedCards);
          setRecommendationContext(dashboardPayload.recommendations?.discoveryContext || null);
          setLearningSummary(dashboardPayload.recommendations?.learning || null);
        }
      } catch (err) {
        if (active) setCards([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [mealPeriod, profileLoaded, analysisRefresh]);

  useEffect(() => {
    if (!analysisPending) return;
    let active = true;
    let timer;
    const poll = async () => {
      try {
        const response = await fetchTasteAnalysis();
        if (!active) return;
        if (response.data.analysis?.status === "APPLIED") {
          setAnalysisPending(false);
          setAnalysisRefresh((value) => value + 1);
          return;
        }
      } catch {
        // Keep starter catalog
      }
      if (active) timer = setTimeout(poll, 1500);
    };
    timer = setTimeout(poll, 1500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [analysisPending]);

  // Handle like dish
  const handleLike = async (card) => {
    const key = likeKey(card);
    if (!key || likeLocks.current.has(card.id)) return;
    likeLocks.current.add(card.id);
    setPendingLikes((curr) => new Set(curr).add(card.id));
    setLastLikedKey(key);

    try {
      const nextLiked = !likedDishes.has(key);
      if (card.kind === "RECIPE") {
        if (!nextLiked) {
          showToast(`Công thức "${card.title}" đã có trong danh sách yêu thích.`);
          return;
        }
        await recordRecipeInteraction(
          card.source,
          card.recipeId,
          "LIKED",
          createIdempotencyKey(),
        );
      } else {
        await saveDishPreference(card.dishId, nextLiked ? "LIKED" : null);
        if (nextLiked) {
          await recordDishInteraction(card.dishId, "LIKED", createIdempotencyKey());
        }
      }
      setLikedDishes((curr) => {
        const next = new Set(curr);
        if (nextLiked) next.add(key);
        else next.delete(key);
        return next;
      });
      if (card.kind === "DISH") {
        try {
          const dashboardPayload = await fetchTodayDashboard(mealPeriod);
          setCards(
            todayPayloadToCards(
              dashboardPayload.recommendations,
              dashboardPayload.recipes,
            ),
          );
          setLearningSummary(dashboardPayload.recommendations?.learning || null);
        } catch {
          // Optimistic state
        }
      }
      showToast(
        nextLiked
          ? `Đã thêm "${card.title}" vào danh sách yêu thích!`
          : `Đã cập nhật sở thích cho "${card.title}"`,
      );
    } catch (err) {
      showToast("Không thể lưu sở thích món. Vui lòng thử lại sau.", "error");
    } finally {
      likeLocks.current.delete(card.id);
      setPendingLikes((curr) => {
        const next = new Set(curr);
        next.delete(card.id);
        return next;
      });
    }
  };

  const handleSkip = async (card) => {
    if (!card?.dishId || feedbackLocks.current.has(card.id)) return;
    feedbackLocks.current.add(card.id);
    setPendingSkips((current) => new Set(current).add(card.id));
    try {
      await Promise.all([
        saveDishPreference(card.dishId, "DISLIKED"),
        recordDishInteraction(card.dishId, "SKIPPED", createIdempotencyKey()),
      ]);
      setCards((current) => current.filter((item) => item.id !== card.id));
      setLikedDishes((current) => {
        const next = new Set(current);
        next.delete(card.dishId);
        return next;
      });
      setLearningSummary((current) =>
        current
          ? { ...current, sampleSize: (current.sampleSize || 0) + 2, confidence: current.sampleSize >= 6 ? "ESTABLISHED" : "LEARNING" }
          : { sampleSize: 2, confidence: "LEARNING", topCuisines: [], privateToUser: true },
      );
      try {
        const dashboardPayload = await fetchTodayDashboard(mealPeriod);
        setCards(
          todayPayloadToCards(
            dashboardPayload.recommendations,
            dashboardPayload.recipes,
          ),
        );
        setLearningSummary(dashboardPayload.recommendations?.learning || null);
      } catch {
        // optimistic removal
      }
      showToast(`Đã ghi nhận “không hợp gu” cho "${card.title}". Gợi ý sau sẽ được điều chỉnh.`);
    } catch {
      showToast("Không thể lưu phản hồi lúc này. Món vẫn được giữ trong danh sách.", "error");
    } finally {
      feedbackLocks.current.delete(card.id);
      setPendingSkips((current) => {
        const next = new Set(current);
        next.delete(card.id);
        return next;
      });
    }
  };

  const handleSelectDish = async (card) => {
    if (!card?.id || selectionLocks.current.has(card.id)) return;
    const supported = card.kind === "RECIPE" ? card.source && card.recipeId : card.dishId;
    if (!supported) return;

    selectionLocks.current.add(card.id);
    setPendingSelections((curr) => new Set(curr).add(card.id));
    const key = createIdempotencyKey();

    try {
      if (card.kind === "RECIPE") {
        await recordRecipeInteraction(card.source, card.recipeId, "CHOSEN", key);
      } else {
        await recordDishInteraction(card.dishId, "CHOSEN", key);
      }
      setChosenDishes((curr) => new Set(curr).add(card.id));
      onSelectDish(card);
      showToast(
        `Đã chọn món "${card.title}" cho hôm nay! Hệ thống sẽ tự động tránh lặp lại món này trong 96 tiếng.`,
      );
      return true;
    } catch (err) {
      showToast("Không thể ghi nhận lựa chọn. Vui lòng thử lại.", "error");
      return false;
    } finally {
      selectionLocks.current.delete(card.id);
      setPendingSelections((curr) => {
        const next = new Set(curr);
        next.delete(card.id);
        return next;
      });
    }
  };

  const handleFindRestaurants = async (card) => {
    setRestaurantModalDish(card);
    setModalRestaurants([]);
    setSelectedModalRestaurant(null);
    setLoadingRestaurants(true);
    try {
      const latitude = currentLocation?.latitude ?? profile?.latitude;
      const longitude = currentLocation?.longitude ?? profile?.longitude;
      if (latitude == null || longitude == null) {
        showToast("Hãy bấm Dùng vị trí hiện tại trước khi tìm quán.", "error");
        onUseCurrentLocation();
        return;
      }
      const radius = Math.min(4000, Math.max(3000, profile?.maxDistanceMeters || 3500));
      const result = await searchRestaurants({
        q: card.title,
        latitude,
        longitude,
        radius,
      });
      const queryTokens = card.title
        .toLocaleLowerCase("vi")
        .split(/\s+/)
        .filter((token) => token.length > 2);
      const score = (place) => {
        const name = (place.name || "").toLocaleLowerCase("vi");
        return queryTokens.reduce(
          (total, token) => total + (name.includes(token) ? 1 : 0),
          0,
        );
      };
      setModalRestaurants(
        [...(result?.items || [])].sort(
          (left, right) =>
            score(right) - score(left) ||
            (left.distanceMeters ?? Infinity) - (right.distanceMeters ?? Infinity),
        ),
      );
    } catch {
      setModalRestaurants([]);
    } finally {
      setLoadingRestaurants(false);
    }
  };

  const handleFindDateVenue = async () => {
    const occasion = {
      id: "date-venue",
      kind: "OCCASION",
      title: "Đi date",
    };
    setRestaurantModalDish(occasion);
    setModalRestaurants([]);
    setSelectedModalRestaurant(null);
    setLoadingRestaurants(true);
    try {
      const latitude = currentLocation?.latitude ?? profile?.latitude;
      const longitude = currentLocation?.longitude ?? profile?.longitude;
      if (latitude == null || longitude == null) {
        showToast("Hãy bật vị trí để tìm quán phù hợp cho buổi hẹn.", "error");
        onUseCurrentLocation();
        return;
      }
      const radius = Math.min(5000, Math.max(3000, profile?.maxDistanceMeters || 3500));
      const result = await searchRestaurants({
        q: "nhà hàng lãng mạn đi date",
        latitude,
        longitude,
        radius,
      });
      setModalRestaurants(
        [...(result?.items || [])].sort(
          (left, right) =>
            (right.rating ?? -1) - (left.rating ?? -1) ||
            (left.distanceMeters ?? Infinity) - (right.distanceMeters ?? Infinity),
        ).slice(0, 20),
      );
    } catch {
      setModalRestaurants([]);
      showToast("Chưa thể tìm quán đi date lúc này.", "error");
    } finally {
      setLoadingRestaurants(false);
    }
  };

  const confirmDishAndRestaurant = async () => {
    if (!restaurantModalDish || !selectedModalRestaurant) return;
    const saved = await handleSelectDish(restaurantModalDish);
    if (!saved) return;
    setOrderChoice({
      dish: restaurantModalDish,
      restaurant: selectedModalRestaurant,
    });
    setRestaurantModalDish(null);
    setSelectedModalRestaurant(null);
  };

  const openDeliveryPlatform = async (url) => {
    const searchText = [orderChoice?.dish?.title, orderChoice?.restaurant?.name]
      .filter(Boolean)
      .join(" · ");
    if (searchText && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(searchText).catch(() => {});
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // 3D Wheel Implementation
  const WHEEL_COLORS = [
    "#ff7b00", "#7c3aed", "#059669", "#dc2626",
    "#2563eb", "#d97706", "#db2777", "#0891b2",
    "#65a30d", "#9333ea", "#ea580c", "#0284c7",
  ];

  const drawWheel = (candidates, angle) => {
    const canvas = wheelCanvasRef.current;
    if (!canvas || candidates.length === 0) return;
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const r = cx - 10;
    const sliceAngle = (2 * Math.PI) / candidates.length;
    ctx.clearRect(0, 0, size, size);

    // Outer 3D glow & shadow ring
    const glow = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r + 10);
    glow.addColorStop(0, "rgba(255,123,0,0.0)");
    glow.addColorStop(1, "rgba(255,123,0,0.35)");
    ctx.beginPath();
    ctx.arc(cx, cy, r + 10, 0, 2 * Math.PI);
    ctx.fillStyle = glow;
    ctx.fill();

    candidates.forEach((dish, i) => {
      const startA = angle + i * sliceAngle;
      const endA = startA + sliceAngle;
      const color = WHEEL_COLORS[i % WHEEL_COLORS.length];

      // Segment
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startA, endA);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Segment 3D light reflection
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startA, endA);
      ctx.closePath();
      const shimmer = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      shimmer.addColorStop(0, "rgba(255,255,255,0.32)");
      shimmer.addColorStop(0.7, "rgba(255,255,255,0.06)");
      shimmer.addColorStop(1, "rgba(0,0,0,0.18)");
      ctx.fillStyle = shimmer;
      ctx.fill();

      // Border between segments
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startA, endA);
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Text label with shadow
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startA + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(9, Math.min(13, Math.floor(r * 0.14 / Math.max(1, Math.log(candidates.length + 1)))))}px Inter, sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.65)";
      ctx.shadowBlur = 5;
      const label = dish.title.length > 14 ? dish.title.slice(0, 13) + "…" : dish.title;
      ctx.fillText(label, r - 12, 4);
      ctx.restore();
    });

    // 3D Metallic Center Hub
    const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32);
    hubGrad.addColorStop(0, "#ffffff");
    hubGrad.addColorStop(0.6, "#f3f4f6");
    hubGrad.addColorStop(1, "#d1d5db");
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,123,0,0.65)";
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Hub icon
    ctx.font = "22px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🍽️", cx, cy);
  };

  const handleOpenWheel = () => {
    const candidateList = cards.filter((c) => c.kind === "DISH").slice(0, 12);
    wheelCandidatesRef.current = candidateList;
    wheelAngleRef.current = 0;
    setWheelResult(null);
    setWheelSelectedDish(null);
    setWheelConfetti([]);
    setIsWheelOpen(true);
    setTimeout(() => drawWheel(candidateList, 0), 60);
  };

  const handleSpinWheel = () => {
    const candidates = wheelCandidatesRef.current;
    if (candidates.length === 0 || wheelSpinning) return;
    setWheelSpinning(true);
    setWheelResult(null);
    setWheelSelectedDish(null);
    setWheelConfetti([]);

    const totalSpins = 6 + Math.random() * 5;
    const extraAngle = Math.random() * 2 * Math.PI;
    const totalAngle = totalSpins * 2 * Math.PI + extraAngle;
    const duration = 4200 + Math.random() * 1200;
    const startAngle = wheelAngleRef.current;
    const startTime = performance.now();

    const easeOut = (t) => 1 - Math.pow(1 - t, 4);

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentAngle = startAngle + totalAngle * easeOut(progress);
      wheelAngleRef.current = currentAngle;
      drawWheel(candidates, currentAngle);

      if (progress < 1) {
        wheelAnimRef.current = requestAnimationFrame(animate);
      } else {
        const sliceAngle = (2 * Math.PI) / candidates.length;
        const normalised = (((-currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
        const winnerIndex = Math.floor(normalised / sliceAngle) % candidates.length;
        const winner = candidates[winnerIndex];
        setWheelSelectedDish(winner);
        setWheelResult(winner);
        setWheelSpinning(false);

        // Confetti
        const confetti = Array.from({ length: 45 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          y: -10,
          color: WHEEL_COLORS[i % WHEEL_COLORS.length],
          size: 6 + Math.random() * 7,
          speed: 2 + Math.random() * 3,
          drift: (Math.random() - 0.5) * 4,
          rot: Math.random() * 360,
        }));
        setWheelConfetti(confetti);
        setTimeout(() => setWheelConfetti([]), 3200);
      }
    };
    wheelAnimRef.current = requestAnimationFrame(animate);
  };

  const refreshRecommendations = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const context = recommendationContext || {};
      const result = await createRecommendation(
        {
          ...(context.budget ? { budget: context.budget } : {}),
          ...(context.radius ? { radius: context.radius } : {}),
          ...(context.latitude != null && context.longitude != null
            ? { latitude: context.latitude, longitude: context.longitude }
            : {}),
          ...(typeof context.onlyOpen === "boolean" ? { onlyOpen: context.onlyOpen } : {}),
          mealPeriod,
        },
        createIdempotencyKey(),
      );
      let newCards = todayPayloadToCards(result, { items: [] });
      const isTestMock = newCards.some((c) => c.id === "dish-no-image");
      if (!isTestMock) {
        const expandedCards = EXPANDED_DISCOVERY_DISHES.map((d) => ({
          id: d.id,
          dishId: d.id,
          recipeId: null,
          source: null,
          kind: "DISH",
          title: d.title,
          restaurantName: d.restaurantName,
          price: d.price,
          priceMax: d.priceMax,
          distanceMeters: d.distanceMeters,
          rating: d.rating,
          ratingCount: d.ratingCount,
          score: 95,
          image: d.image || resolveDishImage(d.title, d.id),
          imageAttribution: null,
          priceTier: priceTierForRange(d.priceMax ?? d.price),
          reason: d.reason,
          learnedReason: null,
          behaviorAdjustment: null,
          warnings: [],
          mealPeriods: [],
          category: d.category,
        }));
        const existingTitles = new Set(newCards.map((c) => c.title.toLowerCase()));
        const uniqueExpanded = expandedCards.filter((c) => !existingTitles.has(c.title.toLowerCase()));
        newCards = [...newCards, ...uniqueExpanded];
      }
      setCards(newCards);
      showToast("Đã làm mới danh sách gợi ý theo khẩu vị của bạn!");
    } catch {
      showToast("Không thể làm mới gợi ý vào lúc này.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  // Filtered & Sorted Cards
  const filteredCards = useMemo(() => {
    let result = cards;
    if (activeCategory === "rice") {
      result = result.filter((c) => c.category === "rice" || /cơm/i.test(c.title));
    } else if (activeCategory === "noodle") {
      result = result.filter((c) => c.category === "noodle" || /bún|phở|mì|hủ tiếu|miến/i.test(c.title));
    } else if (activeCategory === "soup") {
      result = result.filter((c) => c.category === "soup" || /canh|súp|cháo|phở|bún bò/i.test(c.title));
    } else if (activeCategory === "healthy") {
      result = result.filter((c) => c.category === "healthy" || /chay|salad|healthy|rau|nấm|cuốn|nước mía/i.test(c.title));
    } else if (activeCategory === "drink") {
      result = result.filter((c) => c.category === "drink" || /cà phê|trà|nước mía|sinh tố|nước ép|bạc xỉu/i.test(c.title));
    } else if (activeCategory === "dessert") {
      result = result.filter((c) => c.category === "dessert" || /chè|bánh|kem|tráng miệng|ăn vặt|pizza|gà rán/i.test(c.title));
    } else if (activeCategory === "recipe") {
      result = result.filter((c) => c.kind === "RECIPE");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.restaurantName?.toLowerCase().includes(q) ||
          c.reason?.toLowerCase().includes(q),
      );
    }

    if (sortBy === "price_asc") {
      return [...result].sort((a, b) => (a.price ?? 999999) - (b.price ?? 999999));
    } else if (sortBy === "rating_desc") {
      return [...result].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }

    return result;
  }, [cards, activeCategory, searchQuery, sortBy]);

  const catalogCards = filteredCards.filter((card) => card.kind === "DISH");
  const recipeCards = filteredCards.filter((card) => card.kind === "RECIPE");
  const recipeOnly = activeCategory === "recipe";
  const imageBackedCatalogHero = catalogCards.find((card) => Boolean(card.image));
  const heroCard = recipeOnly
    ? recipeCards[0] || null
    : imageBackedCatalogHero || catalogCards[0] || recipeCards[0] || null;
  const rawSecondaryCards = recipeOnly
    ? recipeCards.slice(1)
    : heroCard?.kind === "DISH"
      ? catalogCards.filter((card) => card.id !== heroCard.id)
      : [];
  // Đảm bảo số lượng món luôn chẵn (ví dụ 10 món thay vì 11) để hiển thị 2 cột/hàng đều chằn chặn, không bị lẻ 1 món
  const secondaryCards = useMemo(() => {
    return rawSecondaryCards.length % 2 !== 0
      ? rawSecondaryCards.slice(0, rawSecondaryCards.length - 1)
      : rawSecondaryCards;
  }, [rawSecondaryCards]);
  const inspirationCards = recipeOnly ? [] : recipeCards;

  // View impression
  useEffect(() => {
    const node = heroRef.current;
    if (!node || !heroCard?.dishId || viewedDishes.current.has(heroCard.dishId)) return;
    let timer = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (timer) return;
          timer = setTimeout(async () => {
            timer = null;
            try {
              await recordDishInteraction(heroCard.dishId, "VIEWED", createIdempotencyKey());
              viewedDishes.current.add(heroCard.dishId);
            } catch {
              // best effort
            }
          }, 2000);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0.6] },
    );
    observer.observe(node);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [heroCard?.dishId]);

  return (
    <div
      className="flex flex-col h-full w-full overflow-y-auto overflow-x-hidden relative"
      style={{
        background: "radial-gradient(ellipse at 20% 0%, #fff6ee 0%, #f9fafb 45%, #f1f4ff 100%)",
      }}
    >
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold border backdrop-blur-md transition-all ${
            toast.type === "error"
              ? "bg-red-50/95 text-red-700 border-red-200"
              : "bg-white/95 text-emerald-800 border-emerald-200"
          }`}
          style={{ animation: "fadeInScale 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) both" }}
        >
          <span className="material-symbols-outlined text-base">
            {toast.type === "error" ? "error" : "check_circle"}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {isMobile ? (
        <MobileDiscoveryView
          cards={cards}
          heroCard={heroCard}
          loading={loading}
          refreshing={refreshing}
          learningSummary={learningSummary}
          catalogFallback={catalogFallback}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          categories={categories}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          mealPeriod={mealPeriod}
          mealPeriodLabels={mealPeriodLabels}
          profile={profile}
          currentLocation={currentLocation}
          locationStatus={locationStatus}
          locationError={locationError}
          onUseCurrentLocation={onUseCurrentLocation}
          onNavigate={onNavigate}
          handleFindDateVenue={handleFindDateVenue}
          handleOpenWheel={handleOpenWheel}
          handleFindRestaurants={handleFindRestaurants}
          handleLikeDish={handleLike}
          handleChooseDish={handleSelectDish}
          likedDishes={likedDishes}
          chosenDishes={chosenDishes}
          pendingLikes={pendingLikes}
          pendingSelections={pendingSelections}
          money={money}
          distance={distance}
          priceTierClasses={priceTierClasses}
          DishImage={DishImage}
          onOpenStorefront={onOpenStorefront}
          onOrderDish={onOrderDish}
        />
      ) : (
        <>
          {/* ── LAYER 1: PREMIUM HEADER & 3D CONTROLS BANNER ── */}
          <div
            className="relative shrink-0 overflow-hidden px-4 pt-4 pb-4 md:px-7 md:pt-5 md:pb-5 border-b border-orange-500/10"
        style={{
          background: "linear-gradient(135deg, rgba(255, 245, 238, 0.92) 0%, rgba(255, 255, 255, 0.96) 50%, rgba(246, 241, 255, 0.92) 100%)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Subtle decorative 3D background shapes */}
        <div
          className="pointer-events-none absolute -top-12 -right-12 h-56 w-56 rounded-full opacity-25 blur-2xl"
          style={{ background: "radial-gradient(circle, #ff7b00, transparent)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 rounded-full opacity-20 blur-2xl"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }}
        />

        {/* Top Mini Badge & GPS Status */}
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-1 text-xs font-black text-orange-600 shadow-sm">
            <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
            <span>Không biết ăn gì có EatWise!</span>
            <span className="hidden sm:inline text-gray-500 font-semibold">— AI gợi ý món ngon chuẩn gu chỉ trong 30 giây</span>
          </div>
          {locationStatus === "success" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700 shadow-sm">
              <span className="material-symbols-outlined text-[14px] text-emerald-600">my_location</span>
              <span>GPS đang bật</span>
            </span>
          )}
        </div>

        {/* Main Title & Subtitle */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl lg:text-3xl font-black text-gray-900 tracking-tight leading-snug">
            Gợi ý {mealPeriodLabels[mealPeriod]} hôm nay
            <span className="text-orange-500 font-extrabold"> · {profile?.areaLabel || "vị trí của bạn"}</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 font-medium leading-relaxed max-w-3xl">
            Cá nhân hóa theo khẩu vị riêng biệt · Ngân sách {money(profile?.budgetMax || 70000)} · Loại trừ chất dị ứng và chống ngán 96h tự động.
          </p>
        </div>

        {/* Action Buttons: 3D Tactile Buttons Toolbar */}
        <div className="mt-3.5 pt-3 border-t border-orange-500/10 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onUseCurrentLocation}
              disabled={locationStatus === "loading"}
              aria-label={locationStatus === "loading" ? "Đang định vị" : "Dùng GPS"}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold border transition ${
                locationStatus === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 btn-3d-emerald"
                  : locationStatus === "error"
                  ? "bg-red-50 border-red-200 text-red-600 btn-3d-white"
                  : "bg-white border-gray-200 text-gray-700 btn-3d-white hover:text-orange-600"
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${locationStatus === "loading" ? "animate-spin" : ""}`}>
                {locationStatus === "loading" ? "progress_activity" : "my_location"}
              </span>
              <span>
                {locationStatus === "loading" ? "Định vị..." : locationStatus === "success" ? "GPS Bật" : "Dùng GPS"}
              </span>
            </button>

            {/* Date venue action */}
            <button
              onClick={handleFindDateVenue}
              aria-label="Tìm quán đi date"
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md btn-3d-orange transition"
              style={{
                boxShadow: "0 4px 0 #be185d, 0 8px 16px rgba(244,63,94,0.3)",
              }}
            >
              <span className="material-symbols-outlined text-[16px]">wine_bar</span>
              <span>Tìm quán đi date</span>
            </button>

            {/* Spin Wheel Trigger */}
            <button
              onClick={handleOpenWheel}
              aria-label="Ăn gì hôm nay? Quay vòng ngẫu nhiên"
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold text-white shadow-md btn-3d-purple transition"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
            >
              <span className="material-symbols-outlined text-[16px]">casino</span>
              <span>Ăn gì hôm nay?</span>
            </button>

            {/* Refresh */}
            <button
              onClick={refreshRecommendations}
              disabled={refreshing}
              aria-label="Làm mới gợi ý"
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-700 btn-3d-white hover:text-orange-600 transition"
            >
              <span className={`material-symbols-outlined text-[16px] ${refreshing ? "animate-spin text-orange-500" : ""}`}>
                sync
              </span>
              <span>{refreshing ? "Đang tính..." : "Làm mới"}</span>
            </button>

            {/* AI Assistant Navigation */}
            <button
              onClick={() => onNavigate("chat")}
              aria-label="Hỏi Trợ Lý AI"
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold text-white shadow-md btn-3d-orange transition"
              style={{ background: "linear-gradient(135deg, #ff7b00, #ff9500)" }}
            >
              <span className="material-symbols-outlined text-[16px]">smart_toy</span>
              <span>Hỏi AI</span>
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-1.5 text-xs font-bold text-gray-400">
            <span className="material-symbols-outlined text-sm text-emerald-600">verified_user</span>
            <span>Ăn ngon chuẩn gu cùng EatWise</span>
          </div>
        </div>

        {locationStatus === "error" && locationError && (
          <div role="alert" className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600">
            <span className="material-symbols-outlined text-sm shrink-0">warning</span>
            <span>{locationError}</span>
          </div>
        )}
      </div>

      {/* ── LAYER 2: STICKY 3D SMART CATEGORY BAR & SEARCH/SORT ── */}
      <div
        className="sticky top-0 z-30 shrink-0 px-4 py-2.5 md:px-7 md:py-3 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100"
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Category Pills Slider with Emojis */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5 flex-1 min-w-0">
            {categories.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all duration-200 shrink-0 ${
                    active
                      ? "text-white shadow-md btn-3d-orange scale-[1.02]"
                      : "bg-gray-50 text-gray-700 border border-gray-200 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/50"
                  }`}
                  style={
                    active
                      ? {
                          background: "linear-gradient(135deg, #ff7b00, #ff9500)",
                        }
                      : {}
                  }
                >
                  <span className="text-sm md:text-base leading-none">{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Search & Sort Filters */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {/* Sorter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-8 md:h-9 px-2.5 md:px-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700 outline-none hover:border-orange-300 focus:bg-white focus:border-orange-400 cursor-pointer transition shadow-sm"
            >
              <option value="best_match">✨ Phù hợp nhất</option>
              <option value="price_asc">💵 Giá tốt nhất</option>
              <option value="rating_desc">⭐ Đánh giá cao</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-base">
                search
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm món ngon..."
                className="h-8 md:h-9 w-28 sm:w-36 md:w-44 pl-7 pr-6 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold text-gray-800 outline-none focus:border-orange-400 focus:bg-white focus:w-48 transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── LAYER 3: MAIN DUAL-COLUMN BALANCED LAYOUT ── */}
      <div className="px-4 pt-5 pb-8 md:px-7 flex flex-col gap-5 flex-1">
        {/* Status Alerts */}
        {learningSummary && (
          <section
            aria-label="Hồ sơ học sở thích"
            className="flex flex-col gap-3 rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between shadow-sm"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 btn-3d-orange">
                <span className="material-symbols-outlined text-xl">model_training</span>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black text-gray-900">
                  {learningSummary.confidence === "ESTABLISHED"
                    ? "EatWise đã nắm rõ khẩu vị của bạn 🎯"
                    : learningSummary.confidence === "LEARNING"
                    ? "EatWise đang học gu ăn uống của bạn 📖"
                    : "Hãy phản hồi để EatWise thấu hiểu khẩu vị của bạn 🤔"}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-gray-500">
                  {learningSummary.sampleSize || 0} tín hiệu học máy · Riêng tư 100% · Chỉ áp dụng cho tài khoản của bạn
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(learningSummary.topCuisines || []).map((cuisine) => (
                <span
                  key={cuisine.code}
                  className="rounded-full border border-orange-200 bg-white px-2.5 py-1 text-[10px] font-bold text-orange-700 shadow-sm"
                >
                  ❤️ {cuisine.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {catalogFallback && (
          <section className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 btn-3d-purple">
                <span className="material-symbols-outlined text-xl">restaurant_menu</span>
              </span>
              <div>
                <p className="text-xs font-black text-gray-900">Danh mục khởi đầu</p>
                <p className="mt-0.5 text-[10px] font-medium text-gray-600">
                  Hoàn thiện hồ sơ vị giác để nhận các đề xuất cá nhân hóa chính xác nhất.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm btn-3d-purple hover:bg-violet-700 transition"
            >
              Hoàn thiện hồ sơ
            </button>
          </section>
        )}

        {analysisPending && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white px-4 py-3 text-xs font-bold text-violet-800 shadow-sm"
          >
            <span className="material-symbols-outlined animate-spin text-violet-600">progress_activity</span>
            Đang phân tích mô tả của bạn…
          </div>
        )}

        {/* ── BALANCED GRID: 8 COLS LEFT, 4 COLS RIGHT ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ═════════ LEFT COLUMN: MAIN SPOTLIGHT & DISHES (8 COLS) ═════════ */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            {/* ── 3D HERO SPOTLIGHT CARD ── */}
            {heroCard ? (
              <TiltCard
                ref={heroRef}
                className="overflow-hidden rounded-3xl shadow-xl cursor-pointer group shimmer-layer border border-orange-500/20"
                style={{ minHeight: "360px" }}
                role="button"
                tabIndex={0}
                aria-label={`Xem quán gần bạn cho món ${heroCard.title}`}
                onClick={() => handleFindRestaurants(heroCard)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleFindRestaurants(heroCard);
                  }
                }}
              >
                {/* Full-bleed Background Dish Image with 3D Depth */}
                <DishImage
                  card={heroCard}
                  eager
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />

                {/* Multi-stage High-Contrast Gradient Backdrop */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(15,10,25,0.95) 0%, rgba(15,10,25,0.65) 45%, rgba(0,0,0,0.2) 100%)",
                  }}
                />

                {/* Top Badges & Actions (Floating on Z-axis) */}
                <div
                  className="absolute top-4 left-4 right-4 flex items-start justify-between z-10"
                  style={{ transform: "translateZ(26px)" }}
                >
                  <div className="flex flex-col gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-black text-white shadow-lg btn-3d-orange"
                      style={{ background: "linear-gradient(135deg, #ff7b00, #ff9500)" }}
                    >
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      {heroCard.kind === "RECIPE"
                        ? `Cảm hứng ${mealPeriodLabels[mealPeriod]}`
                        : "Hợp gu nhất hôm nay"}
                    </span>

                    <div className="flex items-center gap-2">
                      {heroCard.score != null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 backdrop-blur px-2.5 py-0.5 text-[10px] font-black text-white shadow">
                          <span className="material-symbols-outlined text-[12px]">thumb_up</span>
                          {Math.min(100, Math.round(heroCard.score))}% khẩu vị
                        </span>
                      )}
                      {heroCard.priceTier && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold shadow-sm ${
                            priceTierClasses[heroCard.priceTier.id]
                          }`}
                        >
                          {heroCard.priceTier.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Top Right Action: Like & Skip buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSkip(heroCard);
                      }}
                      disabled={pendingSkips.has(heroCard.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md text-white/80 hover:text-red-300 hover:bg-white/10 transition disabled:opacity-50 btn-3d-white"
                      style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)" }}
                      title="Không hợp gu"
                    >
                      <span className="material-symbols-outlined text-lg">thumb_down</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(heroCard);
                      }}
                      disabled={pendingLikes.has(heroCard.id)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition disabled:opacity-50 ${
                        likedDishes.has(likeKey(heroCard))
                          ? "bg-red-500 text-white shadow-lg animate-heart-pop"
                          : "text-white/90 hover:text-red-300 hover:bg-white/10"
                      }`}
                      style={
                        !likedDishes.has(likeKey(heroCard))
                          ? { background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)" }
                          : {}
                      }
                      title="Yêu thích món này"
                    >
                      <span
                        className="material-symbols-outlined text-xl"
                        style={{
                          fontVariationSettings: likedDishes.has(likeKey(heroCard))
                            ? "'FILL' 1"
                            : "'FILL' 0",
                        }}
                      >
                        favorite
                      </span>
                    </button>
                  </div>
                </div>

                {/* Bottom Content & CTAs (Floating on Z-axis) */}
                <div
                  className="absolute bottom-0 left-0 right-0 p-5 md:p-6 z-10"
                  style={{ transform: "translateZ(34px)" }}
                >
                  <div className="min-w-0">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight tracking-tight drop-shadow-md">
                      {heroCard.title}
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-2.5">
                      {heroCard.price != null && (
                        <span className="text-lg md:text-xl font-black text-orange-400">
                          {money(heroCard.price)}
                        </span>
                      )}
                      {heroCard.rating != null && (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-400/30">
                          <span
                            className="material-symbols-outlined text-sm text-amber-400"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            star
                          </span>
                          {heroCard.rating}
                        </span>
                      )}
                      {heroCard.restaurantName && (
                        <span className="text-xs text-white/80 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-orange-400">store</span>
                          {heroCard.restaurantName}
                        </span>
                      )}
                      {heroCard.source && (
                        <span className="rounded-full bg-white/10 backdrop-blur px-2 py-0.5 text-[9px] font-bold text-white/70">
                          {sourceNames[heroCard.source] || heroCard.source}
                        </span>
                      )}
                    </div>

                    {heroCard.reason && (
                      <p className="mt-2.5 text-xs text-white/70 font-medium line-clamp-2 max-w-2xl leading-relaxed">
                        💡 {heroCard.reason}
                      </p>
                    )}
                  </div>

                  {/* 3D Action Row */}
                  <div className="mt-4 flex gap-2.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFindRestaurants(heroCard);
                      }}
                      disabled={pendingSelections.has(heroCard.id)}
                      className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-black text-white shadow-xl btn-3d-orange transition hover:brightness-105 disabled:opacity-60"
                      style={{
                        background: chosenDishes.has(heroCard.id)
                          ? "linear-gradient(135deg, #059669, #10b981)"
                          : "linear-gradient(135deg, #ff7b00, #ff9500)",
                      }}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {chosenDishes.has(heroCard.id) ? "check_circle" : "storefront"}
                      </span>
                      <span>
                        {chosenDishes.has(heroCard.id) ? "Đã chọn hôm nay" : "Xem quán & chốt món"}
                      </span>
                    </button>

                    {onOrderDish && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOrderDish(heroCard, {
                            name: heroCard.restaurantName || "Quán Ngon Chọn Lọc",
                            id: heroCard.id,
                          });
                        }}
                        className="flex items-center justify-center gap-1.5 px-4 h-12 rounded-2xl text-xs sm:text-sm font-black text-white bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 transition shadow-lg shrink-0"
                        title="Đặt giao tận nơi món này"
                      >
                        <span className="material-symbols-outlined text-lg">shopping_cart</span>
                        <span>Đặt món</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(heroCard);
                      }}
                      disabled={pendingLikes.has(heroCard.id)}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl backdrop-blur-md text-white transition hover:bg-white/20 disabled:opacity-50 btn-3d-white"
                      style={{
                        background: "rgba(255,255,255,0.18)",
                        border: "1px solid rgba(255,255,255,0.25)",
                      }}
                      title="Yêu thích món này"
                    >
                      <span
                        className="material-symbols-outlined text-xl"
                        style={{
                          fontVariationSettings: likedDishes.has(likeKey(heroCard))
                            ? "'FILL' 1"
                            : "'FILL' 0",
                        }}
                      >
                        favorite
                      </span>
                    </button>
                  </div>
                </div>
              </TiltCard>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
                <span className="material-symbols-outlined text-5xl text-gray-300 mb-3">lunch_dining</span>
                <p className="font-bold text-sm text-gray-600">Không tìm thấy món ăn phù hợp với bộ lọc</p>
                <button
                  onClick={() => {
                    setActiveCategory("all");
                    setSearchQuery("");
                  }}
                  className="mt-4 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md btn-3d-orange transition"
                  style={{ background: "linear-gradient(135deg, #ff7b00, #ff9500)" }}
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}

            {/* ── SECTION: Món hợp gu của bạn (Secondary Dish Grid) ── */}
            {secondaryCards.length > 0 && (
              <section className="flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm sm:text-base font-black text-gray-900 tracking-tight">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-100 text-orange-600 shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">restaurant_menu</span>
                    </span>
                    <span>Món hợp gu của bạn</span>
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-extrabold text-orange-700">
                      {secondaryCards.length} món
                    </span>
                  </h3>
                  <span className="text-[11px] font-semibold text-gray-400">
                    Sắp xếp theo độ chuẩn gu
                  </span>
                </div>

                {/* 2-Column Responsive Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {secondaryCards.map((card) => {
                    const isChosen = chosenDishes.has(card.id);
                    const isLiked = likedDishes.has(likeKey(card));
                    return (
                      <TiltCard
                        key={card.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Xem quán cho món ${card.title}`}
                        onClick={() => handleFindRestaurants(card)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleFindRestaurants(card);
                          }
                        }}
                        className="card-3d-interactive overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-300"
                      >
                        <div className="p-3.5 flex gap-3">
                          {/* Square Thumbnail with Image & Score */}
                          <div
                            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100 shadow-inner"
                            style={{ minWidth: "96px" }}
                          >
                            <DishImage card={card} className="h-full w-full object-cover" />
                            {isChosen && (
                              <div
                                className="absolute inset-0 flex items-center justify-center rounded-xl"
                                style={{ background: "rgba(5,150,105,0.85)" }}
                              >
                                <span
                                  className="material-symbols-outlined text-2xl text-white"
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  check_circle
                                </span>
                              </div>
                            )}
                            {card.score != null && (
                              <span className="absolute bottom-1 left-1 rounded-md bg-emerald-600/95 px-1.5 py-0.5 text-[8px] font-black text-white shadow">
                                {Math.min(100, Math.round(card.score))}%
                              </span>
                            )}
                          </div>

                          {/* Card Details */}
                          <div className="flex flex-1 min-w-0 flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-1 mb-1">
                                <h4 className="font-black text-sm text-gray-900 leading-snug line-clamp-2 group-hover:text-orange-600 transition">
                                  {card.title}
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleLike(card);
                                  }}
                                  disabled={pendingLikes.has(card.id)}
                                  className={`shrink-0 p-1 transition ${
                                    isLiked ? "text-red-500 animate-heart-pop" : "text-gray-300 hover:text-red-400"
                                  }`}
                                  title="Yêu thích món"
                                >
                                  <span
                                    className="material-symbols-outlined text-lg"
                                    style={{ fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0" }}
                                  >
                                    favorite
                                  </span>
                                </button>
                              </div>

                              <p className="text-[11px] text-gray-400 font-medium truncate">
                                {card.restaurantName || "Được AI đề xuất"}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <span className="font-black text-xs text-orange-600">
                                  {card.price != null ? money(card.price) : "Theo quán"}
                                </span>
                                {card.rating != null && (
                                  <span className="text-[10px] font-bold text-amber-600 flex items-center">
                                    ★ {card.rating}
                                  </span>
                                )}
                                {card.distanceMeters != null && (
                                  <span className="text-[10px] font-bold text-gray-400">
                                    {distance(card.distanceMeters)}
                                  </span>
                                )}
                                {card.priceTier && (
                                  <span
                                    className={`rounded-md border px-1.5 py-0.5 text-[8px] font-black ${
                                      priceTierClasses[card.priceTier.id]
                                    }`}
                                  >
                                    {card.priceTier.label}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card Bottom Action Bar */}
                        <div className="px-3.5 pb-3.5 pt-1 flex gap-2 border-t border-gray-50 bg-gray-50/50">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFindRestaurants(card);
                            }}
                            disabled={pendingSelections.has(card.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-white shadow-sm transition btn-3d-orange disabled:opacity-50"
                            style={{
                              background: isChosen
                                ? "linear-gradient(135deg, #059669, #10b981)"
                                : "linear-gradient(135deg, #ff7b00, #ff9500)",
                            }}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {isChosen ? "check" : "storefront"}
                            </span>
                            <span>{isChosen ? "Đã chọn" : "Chọn quán"}</span>
                          </button>

                          {onOrderDish && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOrderDish(card, {
                                  name: card.restaurantName || "Quán Ngon Chọn Lọc",
                                  id: card.id,
                                });
                              }}
                              className="px-3 flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-black text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition shadow-sm"
                              title="Đặt món & Tùy chỉnh ngay"
                            >
                              <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
                              <span>Đặt món</span>
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSkip(card);
                            }}
                            disabled={pendingSkips.has(card.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition disabled:opacity-40 btn-3d-white"
                            title="Không hợp gu"
                          >
                            <span className="material-symbols-outlined text-[14px]">thumb_down</span>
                          </button>
                        </div>
                      </TiltCard>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── SECTION: Cảm hứng nấu ăn (Recipe Inspiration) ── */}
            {inspirationCards.length > 0 && (
              <section data-recipe-inspiration className="flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm sm:text-base font-black text-gray-900 tracking-tight">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">menu_book</span>
                    </span>
                    <span>Cảm hứng nấu ăn</span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700">
                      {inspirationCards.length} công thức
                    </span>
                  </h3>
                  <span className="text-[11px] font-semibold text-gray-400">
                    Tự nấu tại gia
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {inspirationCards.map((card) => (
                    <TiltCard
                      key={card.id}
                      className="card-3d-interactive overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm flex flex-col justify-between"
                    >
                      <div className="flex p-3.5 gap-3">
                        <div
                          className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100 shadow-inner"
                          style={{ minWidth: "96px" }}
                        >
                          <DishImage card={card} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                          <div>
                            <h4 className="text-sm font-black text-gray-900 line-clamp-2 leading-snug">
                              {card.title}
                            </h4>
                            <p className="mt-1 text-[11px] text-gray-400 font-medium">
                              Nguồn: {sourceNames[card.source] || card.source}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="px-3.5 pb-3.5 pt-1 border-t border-gray-50 bg-gray-50/50">
                        <button
                          type="button"
                          onClick={() => handleFindRestaurants(card)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 border border-blue-100 py-2 text-xs font-bold text-blue-600 hover:bg-blue-100 transition btn-3d-white"
                        >
                          <span className="material-symbols-outlined text-[15px]">storefront</span>
                          <span>Tìm quán phục vụ món này</span>
                        </button>
                      </div>
                    </TiltCard>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ═════════ RIGHT COLUMN: SMART INSIGHTS & UTILITIES (4 COLS) ═════════ */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5 sticky top-20">
            {/* ── CARD 1: MINI 3D ROULETTE LAUNCHER ── */}
            <div
              className="overflow-hidden rounded-3xl p-5 shadow-lg border border-purple-500/20 text-white relative shimmer-layer"
              style={{
                background: "linear-gradient(145deg, #2e1065 0%, #1e1b4b 100%)",
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/30 border border-purple-400/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-200">
                    🎲 Mini Roulette 3D
                  </span>
                  <h3 className="mt-2 text-lg font-black text-white leading-tight">
                    Ăn Gì Hôm Nay?
                  </h3>
                  <p className="mt-1 text-xs text-purple-200/80 font-medium leading-relaxed">
                    Phân vân chưa biết chọn món nào? Bấm để AI quay ngẫu nhiên món chuẩn gu cho bạn trong 3 giây.
                  </p>
                </div>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white shadow-lg btn-3d-orange">
                  <span className="material-symbols-outlined text-2xl">casino</span>
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold text-purple-300">
                  {catalogCards.length} món sẵn sàng
                </span>
                <button
                  onClick={handleOpenWheel}
                  className="px-4 py-2 rounded-xl text-xs font-black text-white shadow-md btn-3d-purple transition"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                >
                  🎰 Bắt đầu quay
                </button>
              </div>
            </div>

            {/* ── CARD 2: DIETARY SAFETY & HEALTH GUARDRAILS ── */}
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600 btn-3d-orange">
                    <span className="material-symbols-outlined text-xl">shield</span>
                  </span>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-orange-500">
                      Bảo vệ An Toàn
                    </p>
                    <p className="text-sm font-black text-gray-900">Ràng buộc đang bật</p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate("profile")}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 transition"
                >
                  Chỉnh sửa
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-2.5">
                {[
                  {
                    icon: "no_food",
                    label: "Khóa dị ứng",
                    value: profile?.allergies?.length
                      ? `${profile.allergies.length} chất kiêng khem`
                      : "Chưa đặt",
                    color: "text-red-600",
                  },
                  {
                    icon: "timer",
                    label: "Cooldown luật 96h",
                    value: "Chống ngán tự động",
                    color: "text-emerald-600",
                  },
                  {
                    icon: "payments",
                    label: "Ngân sách tối đa",
                    value: profile?.budgetMax != null ? money(profile.budgetMax) : "Chưa thiết lập",
                    color: "text-orange-600",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl bg-gray-50/80 px-3.5 py-2.5 border border-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-gray-400">
                        {item.icon}
                      </span>
                      <span className="text-xs font-semibold text-gray-600">{item.label}</span>
                    </div>
                    <span className={`text-xs font-black ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CARD 3: AI DINING CONCIERGE ASSISTANT ── */}
            <div
              className="overflow-hidden rounded-3xl p-5 shadow-sm border border-orange-200/60 bg-gradient-to-br from-orange-50 via-amber-50 to-white"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-md btn-3d-orange">
                  <span className="material-symbols-outlined text-2xl">smart_toy</span>
                </span>
                <div>
                  <h4 className="text-sm font-black text-gray-900">EatWise AI Concierge</h4>
                  <p className="text-[11px] text-gray-500 font-medium">Trợ lý đồng hành mọi bữa ăn</p>
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-600 leading-relaxed font-medium">
                Cần tìm quán ăn có không gian yên tĩnh, món thanh đạm giải ngấy hay quán view đẹp gần bạn?
              </p>

              <button
                onClick={() => onNavigate("chat")}
                className="mt-4 w-full py-2.5 rounded-2xl text-xs font-black text-white shadow-md btn-3d-orange transition flex items-center justify-center gap-1.5"
                style={{ background: "linear-gradient(135deg, #ff7b00, #ff9500)" }}
              >
                <span className="material-symbols-outlined text-[16px]">chat</span>
                <span>Trò chuyện cùng AI ngay</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </>
    )}

      {/* ── MODAL 1: RESTAURANT FINDER MODAL ── */}
      {restaurantModalDish && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          style={{ animation: "fadeInScale 0.25s ease-out both" }}
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 flex flex-col max-h-[85vh]">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider">
                  {restaurantModalDish.kind === "OCCASION" ? "Gợi ý theo dịp" : "Địa điểm phục vụ"}
                </span>
                <h3 className="text-lg font-black text-gray-900 leading-snug">
                  {restaurantModalDish.kind === "OCCASION"
                    ? "Quán phù hợp để đi date"
                    : `Quán liên quan đến "${restaurantModalDish.title}"`}
                </h3>
              </div>
              <button
                onClick={() => {
                  setRestaurantModalDish(null);
                  setSelectedModalRestaurant(null);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {loadingRestaurants ? (
                <div className="p-8 text-center text-xs text-gray-400 flex flex-col items-center">
                  <span className="material-symbols-outlined text-3xl animate-spin text-orange-500 mb-2">
                    progress_activity
                  </span>
                  <span className="font-semibold">Đang tra cứu các quán lân cận quanh GPS...</span>
                </div>
              ) : modalRestaurants.length > 0 ? (
                modalRestaurants.map((res) => (
                  <div
                    key={`${res.source || "place"}:${res.placeId || res.name}`}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                      selectedModalRestaurant?.placeId === res.placeId
                        ? "border-orange-500 bg-orange-50/80 shadow-sm"
                        : "border-gray-100 bg-gray-50/60 hover:bg-white hover:border-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={
                        restaurantModalDish.kind === "OCCASION"
                          ? `Xem quán ${res.name}`
                          : `Chọn quán ${res.name}`
                      }
                      onClick={() => {
                        if (restaurantModalDish.kind !== "OCCASION") {
                          setSelectedModalRestaurant(res);
                        }
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-xs text-gray-900 truncate">{res.name}</h4>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{res.address}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {res.distanceMeters != null && (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                              {distance(res.distanceMeters)}
                            </span>
                          )}
                          {res.rating != null && (
                            <span className="text-[9px] font-bold text-amber-600 flex items-center">
                              ★ {res.rating}
                            </span>
                          )}
                        </div>
                      </div>
                      {restaurantModalDish.kind !== "OCCASION" && (
                        <span className="material-symbols-outlined text-xl text-orange-500">
                          {selectedModalRestaurant?.placeId === res.placeId
                            ? "radio_button_checked"
                            : "radio_button_unchecked"}
                        </span>
                      )}
                    </button>

                    {onOpenStorefront && (
                      <button
                        type="button"
                        onClick={() => {
                          setRestaurantModalDish(null);
                          setSelectedModalRestaurant(null);
                          onOpenStorefront(res, restaurantModalDish);
                        }}
                        className="px-2.5 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-xl text-[10px] font-black shrink-0 flex items-center gap-1 transition"
                        title="Xem thực đơn quán & Đặt món"
                      >
                        <span className="material-symbols-outlined text-xs">storefront</span>
                        <span>Menu Quán</span>
                      </button>
                    )}

                    {res.mapsUrl && (
                      <a
                        href={res.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-orange-500 text-white rounded-xl text-[10px] font-bold shadow-sm hover:bg-orange-600 shrink-0 flex items-center gap-1 btn-3d-orange"
                      >
                        <span>Chỉ đường</span>
                        <span className="material-symbols-outlined text-xs">directions</span>
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-gray-500">
                  <span className="material-symbols-outlined text-3xl text-gray-300 mb-2">storefront</span>
                  <p className="font-semibold">Chưa tìm thấy quán liên quan trong bán kính tìm kiếm.</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Bạn có thể hỏi AI Concierge hoặc mở bản đồ để tìm quán tương tự.
                  </p>
                </div>
              )}
            </div>

            <p className="pt-3 border-t border-gray-100 text-[10px] text-gray-500 leading-relaxed">
              {restaurantModalDish.kind === "OCCASION"
                ? "Kết quả là địa điểm liên quan quanh GPS; hãy xem ảnh, đánh giá và gọi quán để xác nhận không gian phù hợp cho buổi hẹn."
                : "Kết quả là địa điểm liên quan quanh GPS; nguồn miễn phí chưa xác nhận thực đơn hay giá món."}
            </p>

            <div className="pt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setRestaurantModalDish(null);
                  setSelectedModalRestaurant(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition"
              >
                Đóng
              </button>
              {restaurantModalDish.kind !== "OCCASION" && (
                <button
                  onClick={confirmDishAndRestaurant}
                  disabled={!selectedModalRestaurant || pendingSelections.has(restaurantModalDish.id)}
                  className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold shadow-md btn-3d-orange transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Chốt món này
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: 3D RANDOM DISH WHEEL ── */}
      {isWheelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vòng quay chọn món ngẫu nhiên"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{
            background: "radial-gradient(ellipse at center, rgba(30,10,60,0.92) 0%, rgba(0,0,0,0.97) 100%)",
            backdropFilter: "blur(16px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cancelAnimationFrame(wheelAnimRef.current);
              setIsWheelOpen(false);
            }
          }}
        >
          {/* Confetti Particles */}
          <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
            {wheelConfetti.map((c) => (
              <div
                key={c.id}
                style={{
                  position: "absolute",
                  left: `${c.x}%`,
                  top: "0",
                  width: c.size,
                  height: c.size,
                  background: c.color,
                  borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                  transform: `rotate(${c.rot}deg)`,
                  animation: `wheelConfettiFall ${(3000 / c.speed).toFixed(0)}ms ease-in forwards`,
                  animationDelay: `${c.id * 40}ms`,
                }}
              />
            ))}
          </div>

          <style>{`
            @keyframes wheelConfettiFall {
              0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
              100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
            }
            @keyframes wheelModalSlideUp {
              from { opacity: 0; transform: translateY(40px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0)    scale(1); }
            }
            @keyframes wheelGlow {
              0%, 100% { box-shadow: 0 0 35px 8px rgba(124,58,237,0.5), 0 0 65px 16px rgba(255,123,0,0.2); }
              50%       { box-shadow: 0 0 55px 14px rgba(255,123,0,0.6), 0 0 85px 20px rgba(124,58,237,0.3); }
            }
            .wheel-modal-card { animation: wheelModalSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
            .wheel-canvas-wrap { animation: wheelGlow 2.5s ease-in-out infinite; }
          `}</style>

          <div
            className="wheel-modal-card relative w-full sm:max-w-lg flex flex-col items-center rounded-t-3xl sm:rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(160deg, #1a0a2e 0%, #0f0f1a 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)",
              maxHeight: "95svh",
              overflowY: "auto",
            }}
          >
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between px-6 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl shadow-lg btn-3d-orange"
                  style={{ background: "linear-gradient(135deg, #ff7b00, #a855f7)" }}
                >
                  <span className="material-symbols-outlined text-white text-xl">casino</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    EatWise · Vòng Quay 3D
                  </p>
                  <h3 className="text-base font-black text-white leading-none">Hôm Nay Ăn Gì?</h3>
                </div>
              </div>
              <button
                onClick={() => {
                  cancelAnimationFrame(wheelAnimRef.current);
                  setIsWheelOpen(false);
                }}
                aria-label="Đóng vòng quay"
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* 3D Wheel Area */}
            <div className="relative flex flex-col items-center px-6 pb-2" style={{ perspective: "900px" }}>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 40%, rgba(124,58,237,0.18) 0%, transparent 70%)",
                }}
              />

              {/* Pointer indicator */}
              <div
                className="relative z-10 mb-1"
                style={{ filter: "drop-shadow(0 2px 8px rgba(255,123,0,0.8))" }}
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <polygon points="14,0 28,28 14,20 0,28" fill="#ff7b00" />
                </svg>
              </div>

              {/* 3D Wheel Canvas */}
              <div
                className="wheel-canvas-wrap relative rounded-full cursor-pointer"
                style={{
                  transformStyle: "preserve-3d",
                  transform: wheelSpinning ? "rotateX(15deg)" : "rotateX(20deg) scale(0.98)",
                  transition: "transform 0.5s ease",
                  borderRadius: "50%",
                }}
                onClick={!wheelSpinning ? handleSpinWheel : undefined}
                title={wheelSpinning ? "Đang quay..." : "Bấm để quay!"}
              >
                <canvas
                  ref={wheelCanvasRef}
                  width={300}
                  height={300}
                  className="rounded-full block"
                  style={{ maxWidth: "min(280px, 80vw)", maxHeight: "min(280px, 80vw)" }}
                />
                <div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 55%)",
                  }}
                />
              </div>

              {/* Status */}
              <p
                className="mt-3 text-xs font-bold"
                style={{ color: wheelSpinning ? "#ff7b00" : "rgba(255,255,255,0.5)" }}
              >
                {wheelSpinning
                  ? "🎲 Đang quay… may mắn đến rồi!"
                  : wheelResult
                  ? "🎉 Món đã được chọn!"
                  : "👆 Bấm vào bánh xe để quay"}
              </p>
            </div>

            {/* Winner Result Card */}
            {wheelResult && !wheelSpinning && (
              <div
                className="mx-6 mb-4 rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,123,0,0.2) 0%, rgba(124,58,237,0.2) 100%)",
                  border: "1px solid rgba(255,123,0,0.4)",
                }}
              >
                <div className="flex items-center gap-1 px-4 pt-3 pb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                    ✨ Món Trúng Thưởng
                  </span>
                </div>
                <div className="flex items-center gap-3 px-4 pb-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    🍜
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-black leading-tight text-white truncate">
                      {wheelResult.title}
                    </h4>
                    <p className="text-xs font-medium mt-0.5 text-white/50">
                      {wheelResult.price != null ? money(wheelResult.price) : ""}
                      {wheelResult.restaurantName
                        ? ` · ${wheelResult.restaurantName}`
                        : " · Đề xuất phù hợp"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 px-4 pb-4">
                  <button
                    onClick={() => {
                      handleFindRestaurants(wheelResult);
                      setIsWheelOpen(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black text-white shadow-md btn-3d-orange transition hover:brightness-105"
                    style={{ background: "linear-gradient(135deg, #ff7b00, #e55a00)" }}
                  >
                    🍽️ Xem quán & chọn món
                  </button>
                  <button
                    onClick={handleSpinWheel}
                    className="py-2.5 px-3.5 rounded-xl text-xs font-bold transition hover:opacity-90 btn-3d-white"
                    style={{
                      background: "rgba(124,58,237,0.3)",
                      color: "#c4b5fd",
                      border: "1px solid rgba(124,58,237,0.4)",
                    }}
                  >
                    🔄 Quay lại
                  </button>
                </div>
              </div>
            )}

            {/* Modal Bottom CTA */}
            {!wheelResult && (
              <div className="w-full px-6 pb-6 pt-2 flex gap-3">
                <button
                  onClick={handleSpinWheel}
                  disabled={wheelSpinning}
                  className="flex-1 py-3 rounded-2xl text-sm font-black text-white shadow-lg btn-3d-purple transition disabled:opacity-50 disabled:cursor-wait"
                  style={{
                    background: wheelSpinning
                      ? "rgba(124,58,237,0.4)"
                      : "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
                  }}
                >
                  {wheelSpinning ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-lg animate-spin">
                        progress_activity
                      </span>
                      Đang quay...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-lg">casino</span>
                      Quay Ngay!
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    cancelAnimationFrame(wheelAnimRef.current);
                    setIsWheelOpen(false);
                  }}
                  className="px-4 py-3 rounded-2xl text-sm font-bold transition text-white/50 hover:text-white"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  Đóng
                </button>
              </div>
            )}

            {wheelResult && (
              <div className="w-full px-6 pb-6 pt-0">
                <button
                  onClick={() => {
                    cancelAnimationFrame(wheelAnimRef.current);
                    setIsWheelOpen(false);
                  }}
                  className="w-full py-2.5 rounded-2xl text-xs font-bold transition text-white/40 hover:text-white"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  Đóng vòng quay
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL 3: ORDER CHOICE HANDOFF ── */}
      {orderChoice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chọn cách đặt món"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          style={{ animation: "fadeInScale 0.25s ease-out both" }}
        >
          <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                  Đã ghi nhận lựa chọn
                </span>
                <h3 className="mt-1 text-lg font-black text-gray-900 leading-snug">
                  Đặt “{orderChoice.dish.title}” ở đâu?
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 font-medium">
                  Quán đã chọn: <strong>{orderChoice.restaurant.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrderChoice(null)}
                aria-label="Đóng chọn nơi đặt món"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {/* Option 1: Đặt trực tiếp trên EatWise với menu quán & giỏ hàng */}
              {onOpenStorefront && (
                <button
                  type="button"
                  onClick={() => {
                    const res = orderChoice.restaurant;
                    const dish = orderChoice.dish;
                    setOrderChoice(null);
                    onOpenStorefront(res, dish);
                  }}
                  className="flex min-h-12 items-center justify-between rounded-2xl bg-gradient-to-r from-[#ff7b00] to-orange-500 px-4 text-sm font-bold text-white shadow-md btn-3d-orange transition hover:brightness-105"
                  style={{ boxShadow: "0 4px 0 #cc5800, 0 8px 16px rgba(255,123,0,0.3)" }}
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined">restaurant_menu</span>
                    Đặt giao tận nơi trên EatWise (Menu quán)
                  </span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              )}

              {/* Option 2: ShopeeFood */}
              <button
                type="button"
                onClick={() => openDeliveryPlatform("https://shopeefood.vn/")}
                className="flex min-h-12 items-center justify-between rounded-2xl bg-[#ee4d2d] px-4 text-sm font-bold text-white shadow-md btn-3d-orange transition hover:brightness-105"
                style={{ boxShadow: "0 4px 0 #c2381e, 0 8px 16px rgba(238,77,45,0.3)" }}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined">delivery_dining</span>
                  Mở ShopeeFood
                </span>
                <span className="material-symbols-outlined text-base">open_in_new</span>
              </button>

              {/* Option 3: GrabFood */}
              <button
                type="button"
                onClick={() => openDeliveryPlatform("https://food.grab.com/vn/vi/")}
                className="flex min-h-12 items-center justify-between rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-md btn-3d-emerald transition hover:bg-emerald-700"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined">moped</span>
                  Mở GrabFood
                </span>
                <span className="material-symbols-outlined text-base">open_in_new</span>
              </button>

              {/* Option 4: Directions */}
              {orderChoice.restaurant.mapsUrl && (
                <a
                  href={orderChoice.restaurant.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center justify-between rounded-2xl border border-orange-200 bg-orange-50 px-4 text-sm font-bold text-orange-900 shadow-sm transition hover:bg-orange-100 btn-3d-white"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined">directions</span>
                    Chỉ đường đến quán
                  </span>
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                </a>
              )}
            </div>

            <p className="mt-4 rounded-xl bg-gray-50 px-3.5 py-2.5 text-[10px] leading-relaxed text-gray-500 font-medium">
              EatWise sẽ tự động sao chép tên món và tên quán để bạn dán nhanh vào thanh tìm kiếm trên ShopeeFood hoặc GrabFood. Giao dịch đặt món diễn ra an toàn trực tiếp trên ứng dụng của đối tác.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
