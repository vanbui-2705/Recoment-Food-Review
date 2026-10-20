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
} from "../dashboardAdapters.js";

// Intelligent NLP parser for taste preferences
function analyzeTasteLocally(text) {
  const lower = (text || "").toLowerCase();
  
  // 1. Spicy level (0-100)
  let spicy = 30;
  if (/không (ăn|thích) cay|không cay|sợ cay/i.test(lower)) spicy = 0;
  else if (/cay nhẹ|ít cay|the the|hơi cay/i.test(lower)) spicy = 25;
  else if (/cay vừa|cay trung bình/i.test(lower)) spicy = 50;
  else if (/thích cay|ăn được cay|cay nồng/i.test(lower)) spicy = 70;
  else if (/siêu cay|rất cay|cực cay/i.test(lower)) spicy = 90;

  // 2. Sweet level (0-100)
  let sweet = 45;
  if (/không (ăn|thích) ngọt|ít ngọt|không đường|ít đường/i.test(lower)) sweet = 15;
  else if (/ngọt thanh|ngọt dịu|vừa ngọt/i.test(lower)) sweet = 40;
  else if (/thích ngọt|ngọt miền nam|hảo ngọt/i.test(lower)) sweet = 80;

  // 3. Sour level (0-100)
  let sour = 30;
  if (/không (ăn|thích) chua|sợ chua/i.test(lower)) sour = 5;
  else if (/chua thanh|canh chua|chua nhẹ/i.test(lower)) sour = 50;
  else if (/thích chua|chua cay|rất chua/i.test(lower)) sour = 75;

  // 4. Salty / Bold flavor (0-100)
  let salty = 40;
  if (/thanh đạm|nhạt|ít muối|ít dầu/i.test(lower)) salty = 25;
  else if (/vừa miệng|hài hòa/i.test(lower)) salty = 45;
  else if (/đậm đà|đậm vị|mặn mà/i.test(lower)) salty = 70;

  // 5. Budget min & max
  let budgetMin = 30000;
  let budgetMax = 70000;
  const budgetMatch = lower.match(/(\d{1,3})(?:k|\.000|\s?nghìn|\s?ngàn)/);
  if (budgetMatch) {
    const num = parseInt(budgetMatch[1], 10) * 1000;
    if (num >= 20000 && num <= 500000) {
      budgetMax = num;
      budgetMin = Math.max(0, num - 40000);
    }
  }

  // 6. Distance
  let distance = 3500;
  const distMatch = lower.match(/(\d(?:\.\d)?)\s?(?:km|cây)/);
  if (distMatch) {
    distance = Math.round(parseFloat(distMatch[1]) * 1000);
  }

  // 7. Allergies
  const detectedAllergies = {
    seafood: /tôm|cua|mực|ốc|hải sản/i.test(lower),
    peanuts: /đậu phộng|lạc|bơ đậu phộng/i.test(lower),
    dairy: /sữa|phô mai|lactose|bơ sữa/i.test(lower),
    gluten: /bột mì|gluten/i.test(lower),
  };

  // 8. Tags & Cuisine preferences
  const tags = [];
  if (/thanh đạm|ít dầu/i.test(lower)) tags.push("Thanh đạm");
  if (/đậm đà/i.test(lower)) tags.push("Đậm đà");
  if (/miền nam/i.test(lower)) tags.push("Vị miền Nam");
  if (/miền bắc|phở/i.test(lower)) tags.push("Vị miền Bắc");
  if (/miền trung|bún bò/i.test(lower)) tags.push("Vị miền Trung");
  if (/hàn|korean/i.test(lower)) tags.push("Ẩm thực Hàn");
  if (/nhật|japanese|sushi/i.test(lower)) tags.push("Ẩm thực Nhật");
  if (/healthy|eat clean|rau/i.test(lower)) tags.push("Healthy / Eat Clean");

  return {
    spicyLevel: spicy,
    sweetLevel: sweet,
    sourLevel: sour,
    saltyLevel: salty,
    budgetMin,
    budgetMax,
    maxDistanceMeters: distance,
    allergies: detectedAllergies,
    tags,
  };
}

export default function ProfilePage({
  user,
  profile,
  onProfileChanged = () => {},
  onSaved = () => {},
}) {
  // Manual granual settings
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
  const savingRef = useRef(false);

  // AI Taste Studio
  const tasteInputRef = useRef(null);
  const [tasteText, setTasteText] = useState("");
  const [savedTasteText, setSavedTasteText] = useState("");
  const [tasteRevision, setTasteRevision] = useState(0);
  const [tasteAnalysis, setTasteAnalysis] = useState(null);
  const [analysisConfigured, setAnalysisConfigured] = useState(true);
  const [savingTaste, setSavingTaste] = useState(false);
  const [analyzingTaste, setAnalyzingTaste] = useState(false);
  const [tasteError, setTasteError] = useState("");
  const [tasteConflict, setTasteConflict] = useState(false);
  const [showTasteSaved, setShowTasteSaved] = useState(false);

  // AI Instant Generated Profile Preview
  const [aiPreview, setAiPreview] = useState(null);

  // Initialize from existing real profile
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
          if (description.trim()) {
            setAiPreview(analyzeTasteLocally(description));
          }
        }
        if (analysisResult.status === "fulfilled") {
          setAnalysisConfigured(analysisResult.value.data.configured !== false);
          setTasteAnalysis(analysisResult.value.data.analysis || null);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!tasteAnalysis || !["QUEUED", "RUNNING"].includes(tasteAnalysis.status)) return;
    const timer = setTimeout(() => {
      fetchTasteAnalysis()
        .then(async (response) => {
          const next = response.data.analysis || null;
          setTasteAnalysis(next);
          setAnalysisConfigured(response.data.configured !== false);
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

  // Add chip into taste textarea
  const handleAddChip = (chipText) => {
    setTasteText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chipText;
      if (trimmed.includes(chipText)) return prev;
      return `${trimmed}, ${chipText}`;
    });
  };

  // Generate Profile using AI & NLP
  const handleAnalyzeWithAI = async () => {
    const description = tasteText.trim();
    if (!description) {
      setTasteError("Vui lòng nhập hoặc chọn vài đặc điểm khẩu vị cơ bản trước khi phân tích.");
      return;
    }
    setAnalyzingTaste(true);
    setTasteError("");

    // 1. Parse local intelligent heuristics
    const preview = analyzeTasteLocally(description);
    setAiPreview(preview);

    // 2. Persist to backend food knowledge and queue background AI job
    try {
      const response = await saveFoodKnowledge(description, tasteRevision);
      const knowledge = response.data.knowledge;
      setSavedTasteText(knowledge.description);
      setTasteRevision(knowledge.revision);

      const analysisResp = await startTasteAnalysis().catch(() => null);
      if (analysisResp) {
        setTasteAnalysis(analysisResp.data.analysis);
      }
    } catch {
      // Offline or conflict, local analysis remains available
    } finally {
      setAnalyzingTaste(false);
    }
  };

  // 1-Click apply AI Profile directly into database
  const handleApplyAiProfile = async () => {
    if (!aiPreview || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const mergedAllergies = {
        ...allergies,
        ...aiPreview.allergies,
      };

      const payload = profileToPayload(profile, {
        spicyLevel: aiPreview.spicyLevel,
        sweetLevel: aiPreview.sweetLevel,
        sourLevel: aiPreview.sourLevel,
        saltyLevel: aiPreview.saltyLevel,
        budgetMin: aiPreview.budgetMin,
        budgetMax: aiPreview.budgetMax,
        maxDistanceMeters: aiPreview.maxDistanceMeters,
        allergies: mergeAllergiesIntoProfile(profile, mergedAllergies),
      });

      const response = await replaceProfile(payload);
      const nextProfile = response.data.profile;
      onProfileChanged(nextProfile);

      // Sync form fields
      setSpicyLevel(nextProfile.spicyLevel ?? aiPreview.spicyLevel);
      setSweetLevel(nextProfile.sweetLevel ?? aiPreview.sweetLevel);
      setSourLevel(nextProfile.sourLevel ?? aiPreview.sourLevel);
      setSaltyLevel(nextProfile.saltyLevel ?? aiPreview.saltyLevel);
      setBudgetMin(nextProfile.budgetMin ?? aiPreview.budgetMin);
      setBudgetMax(nextProfile.budgetMax ?? aiPreview.budgetMax);
      setMaxDistanceMeters(nextProfile.maxDistanceMeters ?? aiPreview.maxDistanceMeters);
      setAllergies(mergedAllergies);

      onSaved("✅ Đã áp dụng và lưu Hồ sơ Vị giác chuẩn do AI phân tích vào tài khoản!");
      setShowTasteSaved(true);
    } catch (err) {
      setTasteError(err?.message || "Không thể áp dụng hồ sơ. Vui lòng thử lại.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleSaveTaste = async () => {
    const description = tasteText.trim();
    if (!description || savingTaste || tasteConflict) return;
    setSavingTaste(true);
    setTasteError("");
    try {
      const response = await saveFoodKnowledge(description, tasteRevision);
      const knowledge = response.data.knowledge;
      setTasteText(knowledge.description);
      setSavedTasteText(knowledge.description);
      setTasteRevision(knowledge.revision);
      setShowTasteSaved(true);
      const preview = analyzeTasteLocally(knowledge.description);
      setAiPreview(preview);
    } catch (error) {
      if (error?.code === "FOOD_KNOWLEDGE_CONFLICT") setTasteConflict(true);
      setTasteError(
        error?.code === "FOOD_KNOWLEDGE_CONFLICT"
          ? "Mô tả đã được cập nhật ở nơi khác."
          : "Không thể lưu mô tả lúc này.",
      );
    } finally {
      setSavingTaste(false);
    }
  };

  const handleConfirmTaste = async () => {
    if (!tasteAnalysis?.id) return;
    setAnalyzingTaste(true);
    setTasteError("");
    try {
      const response = await confirmTasteAnalysis(
        tasteAnalysis.id,
        tasteAnalysis.sourceRevision,
      );
      setTasteAnalysis(response.data.analysis);
      const refreshed = await fetchProfile();
      onProfileChanged(refreshed.data.profile);
      onSaved("Đã cập nhật khẩu vị từ mô tả của bạn.");
    } catch {
      setTasteError("Không thể xác nhận lúc này.");
    } finally {
      setAnalyzingTaste(false);
    }
  };

  // Manual save all granular sliders & inputs
  const handleSaveManual = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = profileToPayload(profile, {
        allergies: mergeAllergiesIntoProfile(profile, allergies),
        spicyLevel: Number(spicyLevel),
        sweetLevel: Number(sweetLevel),
        sourLevel: Number(sourLevel),
        saltyLevel: Number(saltyLevel),
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
        maxDistanceMeters: Number(maxDistanceMeters),
      });

      const response = await replaceProfile(payload);
      onProfileChanged(response.data.profile);
      onSaved("Đã lưu thiết lập Hồ sơ Vị giác EatWise thành công vào cơ sở dữ liệu!");
    } catch (error) {
      onSaved(error?.message || "Không thể lưu Hồ sơ Vị giác. Vui lòng thử lại.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const displayName = user?.displayName || "Tài khoản";
  const email = user?.email || "";
  const shortId = user?.id ? user.id.slice(0, 8).toUpperCase() : "";
  const money = (value) =>
    typeof value === "number" ? `${value.toLocaleString("vi-VN")}đ` : "—";

  return (
    <div className="h-full w-full overflow-y-auto p-3 sm:p-5 lg:p-6 bg-[#f8f9fa]">
      <div className="max-w-4xl mx-auto space-y-6 pb-16">
        
        {/* User Card Header */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#ff7b00] to-[#ffb000] text-white flex items-center justify-center font-extrabold text-2xl shadow-md">
              {displayName.trim().charAt(0).toUpperCase() || "E"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-gray-900">{displayName}</h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase">
                  {user?.role || "USER"}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{email} • ID: #{shortId}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="px-4 py-2 bg-orange-50 rounded-2xl text-center border border-orange-100 flex-1 sm:flex-none">
              <span className="block text-[10px] sm:text-xs font-bold text-gray-500">Ngân sách tối đa</span>
              <strong className="text-xs sm:text-sm font-extrabold text-[#ff7b00]">{money(budgetMax)}</strong>
            </div>
            <div className="px-4 py-2 bg-emerald-50 rounded-2xl text-center border border-emerald-100 flex-1 sm:flex-none">
              <span className="block text-[10px] sm:text-xs font-bold text-gray-500">Bán kính quét</span>
              <strong className="text-xs sm:text-sm font-extrabold text-emerald-600">
                {maxDistanceMeters ? `${(maxDistanceMeters / 1000).toFixed(1)} km` : "3.5 km"}
              </strong>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 1: AI TASTE STUDIO & NLP GENERATOR               */}
        {/* ======================================================== */}
        <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
          <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50/70 px-5 sm:px-6 py-5">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md">
                <span className="material-symbols-outlined text-[24px]">psychology</span>
              </span>
              <div>
                <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <span>Trợ Lý AI: Tạo Hồ Sơ Vị Giác Chuẩn Xác</span>
                  <span className="px-2 py-0.5 bg-violet-600 text-white rounded text-[9px] font-black uppercase">
                    AI Generative
                  </span>
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  Nhập tự nhiên thói quen ăn uống, chọn nhanh các gợi ý bên dưới. AI sẽ tự động phân tích 4 chỉ số vị giác (Cay, Ngọt, Chua, Mặn), dự trù ngân sách và khóa dị nguyên an toàn.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            {/* Quick Prompt Chips */}
            <div>
              <span className="text-[11px] font-bold text-gray-500 block mb-2">
                Gợi ý nhanh (chạm để thêm vào mô tả):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Thanh đạm ít dầu mỡ",
                  "Ăn cay vừa",
                  "Không ăn cay",
                  "Ngọt thanh kiểu miền Bắc",
                  "Đậm đà kiểu miền Trung",
                  "Ngọt dịu kiểu miền Nam",
                  "Thích bún, phở, miến",
                  "Thích cơm tấm, đồ nướng",
                  "Dị ứng tôm cua hải sản",
                  "Dị ứng đậu phộng/lạc",
                  "Ngân sách 50k - 70k",
                  "Bán kính 3km",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleAddChip(chip)}
                    className="px-2.5 py-1 rounded-xl bg-violet-50/80 hover:bg-violet-100 text-violet-800 text-[11px] font-bold border border-violet-200/60 transition"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Natural language description input */}
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
                className="w-full resize-y rounded-2xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-50"
              />
            </label>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="text-[11px] font-medium text-gray-500">
                {tasteChanged ? (
                  <span className="text-amber-700 font-bold">● Bạn có thay đổi mới</span>
                ) : savedTasteText ? (
                  <span className="text-emerald-700 font-bold">✓ Đã lưu vào bộ nhớ tài khoản</span>
                ) : (
                  <span>Nhập khẩu vị bất kỳ để AI phân tích</span>
                )}
                <span className="ml-2 text-gray-400">{tasteText.length}/6000</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveTaste}
                  disabled={!tasteText.trim() || savingTaste || tasteConflict}
                  className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  <span className={`material-symbols-outlined text-sm ${savingTaste ? "animate-spin" : ""}`}>
                    {savingTaste ? "progress_activity" : "save"}
                  </span>
                  <span>{savingTaste ? "Đang lưu..." : "Lưu mô tả khẩu vị"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleAnalyzeWithAI}
                  disabled={!tasteText.trim() || analyzingTaste}
                  className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  <span className={`material-symbols-outlined text-base ${analyzingTaste ? "animate-spin" : ""}`}>
                    {analyzingTaste ? "progress_activity" : "auto_awesome"}
                  </span>
                  <span>{analyzingTaste ? "AI đang phân tích..." : "AI Phân Tích & Tạo Hồ Sơ Chuẩn"}</span>
                </button>
              </div>
            </div>

            {tasteError && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                {tasteError}
              </p>
            )}

            {/* Live AI Analysis Results Card */}
            {aiPreview && (
              <div className="mt-4 rounded-2xl border-2 border-violet-200 bg-violet-50/40 p-4 sm:p-5 space-y-4 animate-fadeInScale">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-violet-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-violet-600 text-lg">verified</span>
                      <span>Kết Quả Phân Tích AI Đề Xuất Cho Bạn</span>
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Dữ liệu được trích xuất trực tiếp từ mô tả của bạn
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyAiProfile}
                    disabled={saving}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">task_alt</span>
                    <span>{saving ? "Đang áp dụng..." : "Áp Dụng Bộ Hồ Sơ Này Ngay"}</span>
                  </button>
                </div>

                {/* 4 Taste Meters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-600 mb-1">
                      <span>🌶️ Độ cay</span>
                      <span className="text-[#ff7b00]">{aiPreview.spicyLevel}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-500" style={{ width: `${aiPreview.spicyLevel}%` }}></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-600 mb-1">
                      <span>🍯 Độ ngọt</span>
                      <span className="text-amber-600">{aiPreview.sweetLevel}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-300 to-yellow-500 transition-all duration-500" style={{ width: `${aiPreview.sweetLevel}%` }}></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-600 mb-1">
                      <span>🍋 Độ chua</span>
                      <span className="text-lime-600">{aiPreview.sourLevel}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-lime-400 to-green-500 transition-all duration-500" style={{ width: `${aiPreview.sourLevel}%` }}></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-600 mb-1">
                      <span>🧂 Đậm đà</span>
                      <span className="text-blue-600">{aiPreview.saltyLevel}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-500" style={{ width: `${aiPreview.saltyLevel}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Badges: Budget, Distance, Allergies */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="px-3 py-1 bg-white border border-gray-200 rounded-xl font-bold text-gray-700">
                    💰 Ngân sách: <strong className="text-[#ff7b00]">{money(aiPreview.budgetMin)} – {money(aiPreview.budgetMax)}</strong>
                  </span>
                  <span className="px-3 py-1 bg-white border border-gray-200 rounded-xl font-bold text-gray-700">
                    🚗 Bán kính: <strong className="text-emerald-600">{(aiPreview.maxDistanceMeters / 1000).toFixed(1)} km</strong>
                  </span>
                  {Object.entries(aiPreview.allergies).filter(([, v]) => v).map(([k]) => (
                    <span key={k} className="px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded-xl font-black text-[10px] uppercase">
                      🚫 Khóa dị ứng: {k}
                    </span>
                  ))}
                  {aiPreview.tags?.map((t) => (
                    <span key={t} className="px-2.5 py-1 bg-violet-100 text-violet-800 border border-violet-200 rounded-xl font-bold text-[10px]">
                      ✨ {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Backend Taste Analysis Status */}
            {tasteAnalysis?.status === "NEEDS_REVIEW" && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-extrabold text-gray-900">Xác nhận thông tin an toàn</h3>
                <TasteFacts analysis={tasteAnalysis} />
                <button
                  type="button"
                  onClick={handleConfirmTaste}
                  disabled={analyzingTaste}
                  className="mt-3 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm"
                >
                  Xác nhận thông tin này
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 2: KHÓA DỊ ỨNG & RÀNG BUỘC AN TOÀN               */}
        {/* ======================================================== */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">shield</span>
              </span>
              <div>
                <h2 className="font-extrabold text-base text-gray-900">Khóa Dị Ứng & Ràng Buộc An Toàn</h2>
                <p className="text-xs text-gray-400">AI tự động loại trừ 100% quán và món ăn chứa thành phần này</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              Khóa nghiêm ngặt
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {[
              { key: "seafood", label: "Hải sản (Tôm, cua, mực, ốc)", desc: "Khóa tuyệt đối, không tiếp xúc chéo", active: allergies.seafood },
              { key: "peanuts", label: "Đậu phộng / Lạc", desc: "Tránh các loại sốt đậu phộng", active: allergies.peanuts },
              { key: "dairy", label: "Sữa & Phô mai (Lactose)", desc: "Ưu tiên nước dùng thanh không béo", active: allergies.dairy },
              { key: "gluten", label: "Gluten bột mì", desc: "Ưu tiên bún, phở, miến gạo", active: allergies.gluten },
            ].map((item) => {
              const catalog = allergenCatalog.find(
                (entry) => entry.code === ALLERGY_UI_CODES[item.key],
              );
              return (
                <div
                  key={item.key}
                  onClick={() => setAllergies((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    item.active
                      ? "border-red-200 bg-red-50/50"
                      : "border-gray-100 bg-gray-50/50 hover:bg-gray-50"
                  }`}
                >
                  <div>
                    <h3 className="font-bold text-xs text-gray-900">{catalog?.name || item.label}</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">{catalog?.description || item.desc}</p>
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
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION 3: ĐIỀU CHỈNH CHỈ SỐ KHẨU VỊ THỦ CÔNG (SLIDERS) */}
        {/* ======================================================== */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-100 space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-orange-50 text-[#ff7b00] flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">tune</span>
              </span>
              <div>
                <h2 className="font-extrabold text-base text-gray-900">
                  Điều Chỉnh Chỉ Số Vị Giác Thực Tế
                </h2>
                <p className="text-xs text-gray-400">
                  Kéo thanh trượt để thay đổi trực tiếp hồ sơ cá nhân trong cơ sở dữ liệu
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-gray-400">Database Live</span>
          </div>

          {/* 4 Interactive Taste Controls (Stepped Buttons + Progress Bar) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Spicy */}
            <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-100 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-800 flex items-center gap-1">
                  <span>🌶️ Mức độ cay</span>
                  <span className="text-[10px] text-gray-400">
                    ({spicyLevel === 0 ? "Không cay" : spicyLevel <= 30 ? "Cay nhẹ" : spicyLevel <= 60 ? "Cay vừa" : "Siêu cay"})
                  </span>
                </span>
                <strong className="text-[#ff7b00] font-black">{spicyLevel}%</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSpicyLevel((v) => Math.max(0, v - 10))}
                  className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center font-black text-sm shrink-0"
                  title="Giảm 10%"
                >
                  -
                </button>
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    setSpicyLevel(Math.min(100, Math.max(0, Math.round(pct / 5) * 5)));
                  }}
                  className="flex-1 h-3.5 bg-gray-200 rounded-full cursor-pointer relative overflow-hidden"
                >
                  <div
                    className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-150"
                    style={{ width: `${spicyLevel}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSpicyLevel((v) => Math.min(100, v + 10))}
                  className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center font-black text-sm shrink-0"
                  title="Tăng 10%"
                >
                  +
                </button>
              </div>
              <div className="flex items-center justify-between gap-1 pt-0.5">
                {[0, 25, 50, 75, 100].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setSpicyLevel(step)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition ${
                      spicyLevel === step
                        ? "bg-[#ff7b00] text-white shadow-xs"
                        : "bg-white text-gray-500 border border-gray-200/80 hover:bg-gray-100"
                    }`}
                  >
                    {step}%
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Sweet */}
            <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-100 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-800 flex items-center gap-1">
                  <span>🍯 Mức độ ngọt</span>
                  <span className="text-[10px] text-gray-400">
                    ({sweetLevel <= 20 ? "Thanh nhạt" : sweetLevel <= 50 ? "Vừa phải" : "Ngọt đậm miền Nam"})
                  </span>
                </span>
                <strong className="text-amber-600 font-black">{sweetLevel}%</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSweetLevel((v) => Math.max(0, v - 10))}
                  className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center font-black text-sm shrink-0"
                  title="Giảm 10%"
                >
                  -
                </button>
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    setSweetLevel(Math.min(100, Math.max(0, Math.round(pct / 5) * 5)));
                  }}
                  className="flex-1 h-3.5 bg-gray-200 rounded-full cursor-pointer relative overflow-hidden"
                >
                  <div
                    className="h-full bg-gradient-to-r from-amber-300 to-yellow-500 rounded-full transition-all duration-150"
                    style={{ width: `${sweetLevel}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSweetLevel((v) => Math.min(100, v + 10))}
                  className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center font-black text-sm shrink-0"
                  title="Tăng 10%"
                >
                  +
                </button>
              </div>
              <div className="flex items-center justify-between gap-1 pt-0.5">
                {[0, 25, 50, 75, 100].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setSweetLevel(step)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition ${
                      sweetLevel === step
                        ? "bg-amber-500 text-white shadow-xs"
                        : "bg-white text-gray-500 border border-gray-200/80 hover:bg-gray-100"
                    }`}
                  >
                    {step}%
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Sour */}
            <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-100 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-800 flex items-center gap-1">
                  <span>🍋 Mức độ chua</span>
                  <span className="text-[10px] text-gray-400">
                    ({sourLevel <= 20 ? "Không chua" : sourLevel <= 60 ? "Chua thanh" : "Chua nồng"})
                  </span>
                </span>
                <strong className="text-lime-600 font-black">{sourLevel}%</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSourLevel((v) => Math.max(0, v - 10))}
                  className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center font-black text-sm shrink-0"
                  title="Giảm 10%"
                >
                  -
                </button>
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    setSourLevel(Math.min(100, Math.max(0, Math.round(pct / 5) * 5)));
                  }}
                  className="flex-1 h-3.5 bg-gray-200 rounded-full cursor-pointer relative overflow-hidden"
                >
                  <div
                    className="h-full bg-gradient-to-r from-lime-400 to-green-500 rounded-full transition-all duration-150"
                    style={{ width: `${sourLevel}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSourLevel((v) => Math.min(100, v + 10))}
                  className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center font-black text-sm shrink-0"
                  title="Tăng 10%"
                >
                  +
                </button>
              </div>
              <div className="flex items-center justify-between gap-1 pt-0.5">
                {[0, 25, 50, 75, 100].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setSourLevel(step)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition ${
                      sourLevel === step
                        ? "bg-lime-600 text-white shadow-xs"
                        : "bg-white text-gray-500 border border-gray-200/80 hover:bg-gray-100"
                    }`}
                  >
                    {step}%
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Salty */}
            <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-100 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-800 flex items-center gap-1">
                  <span>🧂 Mức độ đậm đà / mặn</span>
                  <span className="text-[10px] text-gray-400">
                    ({saltyLevel <= 30 ? "Ăn nhạt / Thanh đạm" : saltyLevel <= 60 ? "Vừa vặn" : "Đậm vị"})
                  </span>
                </span>
                <strong className="text-blue-600 font-black">{saltyLevel}%</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSaltyLevel((v) => Math.max(0, v - 10))}
                  className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center font-black text-sm shrink-0"
                  title="Giảm 10%"
                >
                  -
                </button>
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    setSaltyLevel(Math.min(100, Math.max(0, Math.round(pct / 5) * 5)));
                  }}
                  className="flex-1 h-3.5 bg-gray-200 rounded-full cursor-pointer relative overflow-hidden"
                >
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transition-all duration-150"
                    style={{ width: `${saltyLevel}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSaltyLevel((v) => Math.min(100, v + 10))}
                  className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center font-black text-sm shrink-0"
                  title="Tăng 10%"
                >
                  +
                </button>
              </div>
              <div className="flex items-center justify-between gap-1 pt-0.5">
                {[0, 25, 50, 75, 100].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setSaltyLevel(step)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition ${
                      saltyLevel === step
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-white text-gray-500 border border-gray-200/80 hover:bg-gray-100"
                    }`}
                  >
                    {step}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Budget Range & Search Radius */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Budget */}
            <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-100 space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                Khoảng ngân sách mỗi bữa (VNĐ)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={budgetMax}
                  step="5000"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(parseInt(e.target.value, 10) || 0)}
                  className="w-1/2 h-10 bg-white border border-gray-200 rounded-xl px-3 text-xs font-bold text-gray-800 outline-none focus:border-[#ff7b00]"
                />
                <span className="text-gray-400 font-bold">—</span>
                <input
                  type="number"
                  min={budgetMin}
                  max="1000000"
                  step="5000"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(parseInt(e.target.value, 10) || 70000)}
                  className="w-1/2 h-10 bg-white border border-gray-200 rounded-xl px-3 text-xs font-bold text-gray-800 outline-none focus:border-[#ff7b00]"
                />
              </div>
              <div className="flex gap-1.5 pt-1">
                {[
                  { label: "Bình dân 50k", max: 50000 },
                  { label: "Văn phòng 70k", max: 70000 },
                  { label: "Thoải mái 120k", max: 120000 },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => {
                      setBudgetMax(b.max);
                      setBudgetMin(Math.max(0, b.max - 35000));
                    }}
                    className="px-2 py-0.5 bg-gray-200/80 hover:bg-gray-300 text-[10px] font-bold text-gray-700 rounded-lg transition"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Radius */}
            <div className="p-4 rounded-2xl bg-gray-50/60 border border-gray-100 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-700">Bán kính quét quán ăn</span>
                <strong className="text-emerald-600 font-black">
                  {(maxDistanceMeters / 1000).toFixed(1)} km
                </strong>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[1000, 2000, 3500, 5000, 10000].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setMaxDistanceMeters(d)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                      maxDistanceMeters === d
                        ? "bg-[#ff7b00] text-white shadow-sm"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {d >= 1000 ? `${d / 1000}km` : `${d}m`}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400">
                AI sẽ tìm quán và món ăn trong phạm vi này tính từ vị trí GPS của bạn
              </p>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* BOTTOM SAVE BAR: PERSIST ALL DATA TO DATABASE           */}
        {/* ======================================================== */}
        <section className="bg-gradient-to-r from-orange-50 via-amber-50 to-indigo-50 rounded-3xl p-5 sm:p-6 border border-orange-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#ff7b00] text-white flex items-center justify-center shadow-md shrink-0">
              <span className="material-symbols-outlined text-[24px]">save</span>
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900">
                Lưu Thay Đổi Hồ Sơ Vị Giác Vào Database
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Các thuật toán AI Gợi ý thực đơn và Bản đồ quán sẽ tự động áp dụng hồ sơ mới này ngay lập tức.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveManual}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3 bg-[#ff7b00] hover:bg-[#e66a00] text-white rounded-xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin text-base">sync</span>
            ) : (
              <span className="material-symbols-outlined text-base">check</span>
            )}
            <span>{saving ? "Đang lưu vào database..." : "Lưu Thay Đổi Hồ Sơ"}</span>
          </button>
        </section>

      </div>

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
