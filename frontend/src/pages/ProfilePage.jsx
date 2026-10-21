import { useEffect, useRef, useState } from "react";
import {
  confirmTasteAnalysis,
  fetchCatalogs,
  fetchFoodKnowledge,
  fetchProfile,
  fetchTasteAnalysis,
  profileToPayload,
  replaceProfile,
  saveFoodKnowledge,
  startTasteAnalysis,
} from "../profileApi.js";
import {
  ALLERGY_UI_CODES,
  allergiesFromProfile,
  mergeAllergiesIntoProfile,
  analyzeTasteLocally,
} from "../dashboardAdapters.js";

export default function ProfilePage({
  user,
  profile,
  onProfileChanged = () => {},
  onSaved = () => {},
  onNavigate = () => {},
}) {
  const [allergies, setAllergies] = useState({
    seafood: false,
    peanuts: false,
    dairy: false,
    gluten: false,
  });

  const [spicyLevel, setSpicyLevel] = useState(30);
  const [sweetLevel, setSweetLevel] = useState(45);
  const [sourLevel, setSourLevel] = useState(30);
  const [saltyLevel, setSaltyLevel] = useState(40);
  const [budgetMin, setBudgetMin] = useState(30000);
  const [budgetMax, setBudgetMax] = useState(70000);
  const [maxDistanceMeters, setMaxDistanceMeters] = useState(3500);

  const [allergenCatalog, setAllergenCatalog] = useState([]);
  const [saving, setSaving] = useState(false);

  // Knowledge Base & AI Taste Description
  const tasteInputRef = useRef(null);
  const [tasteText, setTasteText] = useState("");
  const [savedTasteText, setSavedTasteText] = useState("");
  const [tasteRevision, setTasteRevision] = useState(0);
  const [tasteAnalysis, setTasteAnalysis] = useState(null);
  const [savingTaste, setSavingTaste] = useState(false);
  const [tasteError, setTasteError] = useState("");
  const [tasteConflict, setTasteConflict] = useState(false);
  const [showTasteSaved, setShowTasteSaved] = useState(false);

  // Sync state from profile
  useEffect(() => {
    if (profile) {
      setAllergies(allergiesFromProfile(profile));
      setSpicyLevel(profile.spicyLevel ?? 30);
      setSweetLevel(profile.sweetLevel ?? 45);
      setSourLevel(profile.sourLevel ?? 30);
      setSaltyLevel(profile.saltyLevel ?? 40);
      setBudgetMin(profile.budgetMin ?? 30000);
      setBudgetMax(profile.budgetMax ?? 70000);
      setMaxDistanceMeters(profile.maxDistanceMeters ?? 3500);
    }
  }, [profile]);

  // Load catalogs
  useEffect(() => {
    let active = true;
    fetchCatalogs()
      .then((catalogs) => {
        if (active) setAllergenCatalog(catalogs.allergens || []);
      })
      .catch(() => {
        if (active) setAllergenCatalog([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Load knowledge base
  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchFoodKnowledge(), fetchTasteAnalysis()]).then(
      ([knowledgeResult, analysisResult]) => {
        if (!active) return;
        if (knowledgeResult.status === "fulfilled") {
          const knowledge = knowledgeResult.value.data.knowledge;
          const description = knowledge?.description || "";
          setTasteText(description);
          setSavedTasteText(description);
          setTasteRevision(knowledge?.revision || 0);
        }
        if (analysisResult.status === "fulfilled") {
          setTasteAnalysis(analysisResult.value.data.analysis || null);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  // Poll background AI analysis if running
  useEffect(() => {
    if (!tasteAnalysis || !["QUEUED", "RUNNING"].includes(tasteAnalysis.status)) return;
    const timer = setTimeout(() => {
      fetchTasteAnalysis()
        .then(async (response) => {
          const next = response.data.analysis || null;
          setTasteAnalysis(next);
          if (next?.status === "APPLIED") {
            const refreshed = await fetchProfile();
            onProfileChanged(refreshed.data.profile);
            onSaved("AI đã hoàn tất phân tích và cập nhật Hồ sơ Vị giác của bạn.");
          }
        })
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [tasteAnalysis, onProfileChanged, onSaved]);

  const tasteChanged = tasteText !== savedTasteText;

  // Add quick prompt chip into textarea
  const handleAddChip = (chipText) => {
    setTasteText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chipText;
      if (trimmed.includes(chipText)) return prev;
      return `${trimmed}, ${chipText}`;
    });
  };

  // Save Knowledge Base & auto-update live profile
  const handleSaveTaste = async () => {
    const description = tasteText.trim();
    if (!description) return;
    setSavingTaste(true);
    setTasteError("");
    setTasteConflict(false);
    try {
      const response = await saveFoodKnowledge(description, tasteRevision);
      const knowledge = response.data.knowledge;
      setSavedTasteText(knowledge.description);
      setTasteRevision(knowledge.revision);
      setShowTasteSaved(true);

      // Auto analyze locally and update user profile in PostgreSQL
      const parsed = analyzeTasteLocally(description);
      const currentAllergies = allergiesFromProfile(profile);
      const mergedAllergies = {
        ...currentAllergies,
        ...parsed.allergies,
      };

      const payload = profileToPayload(profile, {
        spicyLevel: parsed.spicyLevel,
        sweetLevel: parsed.sweetLevel,
        sourLevel: parsed.sourLevel,
        saltyLevel: parsed.saltyLevel,
        budgetMin: parsed.budgetMin,
        budgetMax: parsed.budgetMax,
        maxDistanceMeters: parsed.maxDistanceMeters,
        allergies: mergeAllergiesIntoProfile(profile, mergedAllergies),
      });

      const updatedProfileResp = await replaceProfile(payload);
      if (updatedProfileResp?.data?.profile) {
        onProfileChanged(updatedProfileResp.data.profile);
      }

      // Also trigger backend pipeline if configured
      startTasteAnalysis().catch(() => {});
    } catch (err) {
      if (err.status === 409 || err.code === "FOOD_KNOWLEDGE_CONFLICT") {
        setTasteConflict(true);
        setTasteError("Mô tả đã được cập nhật ở nơi khác. Vui lòng làm mới trang.");
      } else {
        setTasteError("Không thể lưu mô tả khẩu vị lúc này.");
      }
    } finally {
      setSavingTaste(false);
    }
  };

  // Quick allergen toggle save
  const handleToggleAllergy = async (key) => {
    const nextAllergies = { ...allergies, [key]: !allergies[key] };
    setAllergies(nextAllergies);
    setSaving(true);
    try {
      const payload = profileToPayload(profile, {
        allergies: mergeAllergiesIntoProfile(profile, nextAllergies),
      });
      const res = await replaceProfile(payload);
      if (res?.data?.profile) {
        onProfileChanged(res.data.profile);
        onSaved("Đã cập nhật thiết lập an toàn thực phẩm.");
      }
    } catch {
      onSaved("Không thể cập nhật thiết lập an toàn lúc này.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmTaste = async () => {
    if (!tasteAnalysis) return;
    try {
      const res = await confirmTasteAnalysis(tasteAnalysis.revision, {
        confirmedFacts: ["ALLERGIES", "DIETS", "CUISINES"],
      });
      setTasteAnalysis(res.data.analysis);
      const refreshed = await fetchProfile();
      onProfileChanged(refreshed.data.profile);
      onSaved("Đã xác nhận dữ liệu phân tích khẩu vị.");
    } catch {
      setTasteError("Không thể xác nhận phân tích khẩu vị lúc này.");
    }
  };

  const money = (val) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(val || 0);

  const displayName = user?.displayName || user?.name || "Thành viên EatWise";
  const email = user?.email || "Chưa thiết lập email";
  const role = user?.role || "USER";
  const shortId = (user?.id || "---").slice(0, 8);

  const getSpicyText = (lvl) => {
    if (lvl === 0) return "Không cay";
    if (lvl <= 30) return "Cay nhẹ";
    if (lvl <= 60) return "Cay vừa";
    return "Siêu cay";
  };

  const getSweetText = (lvl) => {
    if (lvl <= 20) return "Thanh nhạt";
    if (lvl <= 50) return "Vừa phải";
    return "Ngọt đậm miền Nam";
  };

  const getSourText = (lvl) => {
    if (lvl <= 20) return "Không chua";
    if (lvl <= 60) return "Chua thanh";
    return "Chua nồng";
  };

  const getSaltyText = (lvl) => {
    if (lvl <= 30) return "Thanh đạm / Ít muối";
    if (lvl <= 60) return "Hài hòa vừa vặn";
    return "Đậm đà đậm vị";
  };

  return (
    <div className="min-h-full w-full bg-[#f8f9fd] px-3 sm:px-6 lg:px-8 py-5 pb-24 max-w-5xl mx-auto overflow-x-hidden">
      <div className="space-y-6">

        {/* ======================================================== */}
        {/* HEADER: USER CARD                                        */}
        {/* ======================================================== */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#ff7b00] to-amber-400 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-tight">
                  {displayName}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    role === "ADMIN"
                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                      : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {role === "ADMIN" ? "Quản trị viên" : "Người dùng"}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                {email} • ID: #{shortId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="px-4 py-2 bg-orange-50 rounded-2xl text-center border border-orange-100 flex-1 sm:flex-none">
              <span className="block text-[10px] sm:text-xs font-bold text-gray-500">
                Ngân sách bữa ăn
              </span>
              <strong className="text-xs sm:text-sm font-extrabold text-[#ff7b00]">
                {money(budgetMax)}
              </strong>
            </div>
            <div className="px-4 py-2 bg-emerald-50 rounded-2xl text-center border border-emerald-100 flex-1 sm:flex-none">
              <span className="block text-[10px] sm:text-xs font-bold text-gray-500">
                Bán kính quét
              </span>
              <strong className="text-xs sm:text-sm font-extrabold text-emerald-600">
                {maxDistanceMeters ? `${(maxDistanceMeters / 1000).toFixed(1)} km` : "3.5 km"}
              </strong>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* BANNER: AI TỰ ĐỘNG HỌC KHẨU VỊ QUA CHAT                  */}
        {/* ======================================================== */}
        <div className="rounded-3xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-violet-200">
                  Cơ chế học tự động
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                AI Tự Động Phân Tích & Ghi Nhớ Khẩu Vị Qua Chat
              </h2>
              <p className="text-xs leading-relaxed text-violet-100">
                Bạn không cần cấu hình phức tạp. Mỗi khi bạn trò chuyện cùng Trợ lý AI (ví dụ:{" "}
                <em className="text-amber-200 not-italic font-semibold">
                  &ldquo;hôm nay tôi thích ăn phở, ít cay, không ăn ngọt, dị ứng tôm cua...&rdquo;
                </em>
                ), AI sẽ tự động phân tích và lưu trực tiếp vào Bộ Nhớ Khẩu Vị của bạn.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("chat")}
              className="shrink-0 px-4 py-2.5 rounded-2xl bg-white text-violet-800 hover:bg-violet-50 text-xs font-black shadow-md hover:shadow-lg transition flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">chat</span>
              <span>Trò chuyện với AI ngay</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 1: KNOWLEDGE BASE - BỘ NHỚ KHẨU VỊ CỦA BẠN       */}
        {/* ======================================================== */}
        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-[#ff7b00]">
                <span className="material-symbols-outlined text-[22px]">database</span>
              </span>
              <div>
                <h2 className="text-base font-extrabold text-gray-900">
                  Bộ Nhớ Khẩu Vị (Food Knowledge Base)
                </h2>
                <p className="text-xs text-gray-400">
                  Dữ liệu thói quen và sở thích ăn uống mà AI đã ghi nhớ từ các cuộc trò chuyện của bạn
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-violet-50 text-violet-700 text-[10px] font-black rounded-full border border-violet-100 uppercase">
              AI Đồng Bộ Live
            </span>
          </div>

          {/* Quick suggestions chips */}
          <div>
            <span className="text-[11px] font-bold text-gray-500 block mb-2">
              Chạm để thêm nhanh thói quen vào bộ nhớ:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Thanh đạm ít dầu mỡ",
                "Ăn cay vừa",
                "Không ăn cay",
                "Ngọt thanh",
                "Đậm đà kiểu miền Trung",
                "Thích bún, phở, miến",
                "Thích cơm tấm",
                "Dị ứng tôm cua hải sản",
                "Dị ứng đậu phộng/lạc",
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleAddChip(chip)}
                  className="px-2.5 py-1 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-[11px] font-bold border border-gray-200 transition"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Natural language description textarea (Playwright contract) */}
          <label className="block">
            <span className="sr-only">Mô tả khẩu vị của bạn</span>
            <textarea
              ref={tasteInputRef}
              aria-label="Mô tả khẩu vị của bạn"
              value={tasteText}
              onChange={(event) => {
                setTasteText(event.target.value);
                setTasteConflict(false);
                setTasteError("");
              }}
              rows={4}
              maxLength={6000}
              placeholder="Ví dụ: Tôi thích ăn phở tái lăn, bún chả, cơm tấm. Thích ăn thanh đạm ít dầu mỡ, ăn cay vừa, không thích ăn ngọt gắt. Dị ứng tôm cua, ngân sách 50k-70k..."
              className="w-full resize-y rounded-2xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#ff7b00] focus:bg-white focus:ring-4 focus:ring-orange-50"
            />
          </label>

          {/* Status info & Save button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="text-[11px] font-medium text-gray-500">
              {tasteChanged ? (
                <span className="text-amber-700 font-bold">● Bạn có thay đổi mới chưa lưu</span>
              ) : savedTasteText ? (
                <span className="text-emerald-700 font-bold">✓ Đã đồng bộ với Bộ Nhớ AI</span>
              ) : (
                <span>Trò chuyện trong Chat hoặc nhập tại đây để AI ghi nhớ</span>
              )}
              <span className="ml-2 text-gray-400">{tasteText.length}/6000</span>
            </div>

            <button
              type="button"
              onClick={handleSaveTaste}
              disabled={!tasteText.trim() || savingTaste || tasteConflict}
              className="px-4 py-2.5 rounded-xl bg-[#ff7b00] hover:bg-[#e66a00] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40"
            >
              <span className={`material-symbols-outlined text-base ${savingTaste ? "animate-spin" : ""}`}>
                {savingTaste ? "progress_activity" : "save"}
              </span>
              <span>{savingTaste ? "Đang lưu..." : "Lưu mô tả khẩu vị"}</span>
            </button>
          </div>

          {tasteError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
              {tasteError}
            </p>
          )}

          {tasteAnalysis?.status === "NEEDS_REVIEW" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-extrabold text-gray-900">Xác nhận thông tin an toàn</h3>
              <TasteFacts analysis={tasteAnalysis} />
              <button
                type="button"
                onClick={handleConfirmTaste}
                className="mt-3 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm"
              >
                Xác nhận thông tin này
              </button>
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* SECTION 2: CHỈ SỐ VỊ GIÁC AI ĐANG ÁP DỤNG                */}
        {/* ======================================================== */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-orange-50 text-[#ff7b00] flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">tune</span>
              </span>
              <div>
                <h2 className="font-extrabold text-base text-gray-900">
                  Chỉ Số Vị Giác & Ràng Buộc AI Đang Áp Dụng
                </h2>
                <p className="text-xs text-gray-400">
                  Hệ thống gợi ý món ăn và bản đồ quán ăn sẽ lọc theo các chỉ số này
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Đang hiệu lực</span>
            </span>
          </div>

          {/* 4 Taste Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* 1. Spicy */}
            <div className="bg-gray-50/70 rounded-2xl p-4 border border-gray-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-700">🌶️ Độ cay</span>
                <strong className="text-[#ff7b00] font-black">{spicyLevel}%</strong>
              </div>
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, spicyLevel)}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                {getSpicyText(spicyLevel)}
              </p>
            </div>

            {/* 2. Sweet */}
            <div className="bg-gray-50/70 rounded-2xl p-4 border border-gray-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-700">🍯 Độ ngọt</span>
                <strong className="text-amber-600 font-black">{sweetLevel}%</strong>
              </div>
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-300 to-yellow-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, sweetLevel)}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                {getSweetText(sweetLevel)}
              </p>
            </div>

            {/* 3. Sour */}
            <div className="bg-gray-50/70 rounded-2xl p-4 border border-gray-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-700">🍋 Độ chua</span>
                <strong className="text-lime-600 font-black">{sourLevel}%</strong>
              </div>
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-lime-400 to-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, sourLevel)}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                {getSourText(sourLevel)}
              </p>
            </div>

            {/* 4. Salty */}
            <div className="bg-gray-50/70 rounded-2xl p-4 border border-gray-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-700">🧂 Đậm đà</span>
                <strong className="text-blue-600 font-black">{saltyLevel}%</strong>
              </div>
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, saltyLevel)}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                {getSaltyText(saltyLevel)}
              </p>
            </div>
          </div>

          {/* Badges: Budget & Radius */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <div className="px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-xl text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <span>💰 Ngân sách:</span>
              <strong className="text-[#ff7b00]">{money(budgetMin)} – {money(budgetMax)}</strong>
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <span>🚗 Bán kính quét:</span>
              <strong className="text-emerald-600">{(maxDistanceMeters / 1000).toFixed(1)} km</strong>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 3: KHÓA DỊ ỨNG & RÀNG BUỘC AN TOÀN               */}
        {/* ======================================================== */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">shield</span>
              </span>
              <div>
                <h2 className="font-extrabold text-base text-gray-900">Khóa Dị Ứng An Toàn</h2>
                <p className="text-xs text-gray-400">
                  AI tự động loại trừ 100% quán và món ăn chứa thành phần đã chọn
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              Bảo vệ nghiêm ngặt
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {[
              {
                key: "seafood",
                label: "Hải sản (Tôm, cua, mực, ốc)",
                desc: "Khóa tuyệt đối, không tiếp xúc chéo",
                active: allergies.seafood,
              },
              {
                key: "peanuts",
                label: "Đậu phộng / Lạc",
                desc: "Tránh các món xào rắc lạc và sốt đậu phộng",
                active: allergies.peanuts,
              },
              {
                key: "dairy",
                label: "Sữa & Phô mai (Lactose)",
                desc: "Tránh các món có bơ, phô mai, sữa đặc",
                active: allergies.dairy,
              },
              {
                key: "gluten",
                label: "Gluten bột mì",
                desc: "Ưu tiên bún, phở, miến gạo, cơm tấm",
                active: allergies.gluten,
              },
            ].map((item) => {
              const catalog = allergenCatalog.find(
                (entry) => entry.code === ALLERGY_UI_CODES[item.key],
              );
              return (
                <div
                  key={item.key}
                  onClick={() => handleToggleAllergy(item.key)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    item.active
                      ? "border-red-200 bg-red-50/50"
                      : "border-gray-100 bg-gray-50/50 hover:bg-gray-50"
                  }`}
                >
                  <div>
                    <h3 className="font-bold text-xs text-gray-900">
                      {catalog?.name || item.label}
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {catalog?.description || item.desc}
                    </p>
                  </div>
                  <div
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                      item.active ? "bg-red-500" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        item.active ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {saving && (
            <p className="mt-2 text-right text-[11px] font-bold text-gray-400">
              Đang đồng bộ thay đổi an toàn...
            </p>
          )}
        </section>

      </div>

      {/* Confirmation Modal (Playwright contract) */}
      {showTasteSaved && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <span className="material-symbols-outlined text-4xl text-emerald-600">check_circle</span>
            <h2 className="mt-2 text-lg font-black text-gray-900">Đã lưu khẩu vị của bạn</h2>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              Hệ thống đã lưu đầy đủ các chỉ số vị giác và khẩu vị của bạn vào cơ sở dữ liệu.
            </p>
            <button
              type="button"
              onClick={() => setShowTasteSaved(false)}
              className="mt-5 min-h-11 w-full rounded-xl bg-[#ff7b00] px-4 text-xs font-bold text-white shadow-sm"
            >
              Khẩu vị của tôi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TasteFacts({ analysis }) {
  const result = analysis?.result || {};
  const labels = analysis?.labels || {};
  const facts = [
    ...(result.cuisines || []).map((item) => `Ẩm thực ${item.code}`),
    ...(result.dishes || []).map((item) =>
      `${item.preference === "LIKED" ? "Thích" : "Không thích"}: ${item.name}`,
    ),
    ...(result.allergies || []).map(
      (item) => `Dị ứng: ${labels.allergies?.[item.code] || item.code}`,
    ),
    ...(result.diets || []).map(
      (item) => `Chế độ ăn: ${labels.diets?.[item.code] || item.code}`,
    ),
    ...(result.fields || []).map((item) => `${item.field}: ${item.value}`),
  ];
  if (facts.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {facts.map((fact) => (
        <span
          key={fact}
          className="rounded-full border border-white bg-white px-2.5 py-1 text-[10px] font-bold text-gray-700 shadow-sm"
        >
          {fact}
        </span>
      ))}
    </div>
  );
}
