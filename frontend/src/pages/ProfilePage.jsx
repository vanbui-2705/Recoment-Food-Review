import { useState } from "react";

export default function ProfilePage({ onSaved = () => {} }) {
  const [allergies, setAllergies] = useState({
    seafood: true,
    peanuts: false,
    dairy: false,
    gluten: false,
  });

  const [chefNotes, setChefNotes] = useState({
    noOnions: true,
    spicyLevel: 2,
    lowOil: true,
  });

  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onSaved("Đã cập nhật Hồ sơ Vị giác EatWise AI thành công!");
    }, 400);
  };

  return (
    <div className="h-full w-full overflow-y-auto p-4 lg:p-6 lg:pt-2 bg-[#f8f9fa]">
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        
        {/* User Card Header */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#ff7b00] to-[#ffb000] text-white flex items-center justify-center font-extrabold text-2xl shadow-md">
              K
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-gray-900">Nguyễn Tuấn Khang</h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase">
                  EatWise Gold
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium mt-0.5">khang.ai@eatwise.vn • ID: #EW-9821</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="px-4 py-2 bg-orange-50 rounded-2xl text-center border border-orange-100 flex-1 sm:flex-none">
              <span className="block text-xs font-bold text-gray-500">Điểm tích lũy</span>
              <strong className="text-sm font-extrabold text-[#ff7b00]">1.420 pts</strong>
            </div>
            <div className="px-4 py-2 bg-emerald-50 rounded-2xl text-center border border-emerald-100 flex-1 sm:flex-none">
              <span className="block text-xs font-bold text-gray-500">Tiết kiệm AI</span>
              <strong className="text-sm font-extrabold text-emerald-600">340.000đ</strong>
            </div>
          </div>
        </div>

        {/* Section 1: Khóa Dị Ứng (Allergen Guard) */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">shield</span>
              </span>
              <div>
                <h2 className="font-extrabold text-base text-gray-900">Khóa Dị Ứng & Ràng Buộc An Toàn</h2>
                <p className="text-xs text-gray-400">AI tự động loại trừ 100% quán và món ăn chứa chất này</p>
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
            ].map((item) => (
              <div
                key={item.key}
                onClick={() => setAllergies((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${item.active ? "border-red-200 bg-red-50/50" : "border-gray-100 bg-gray-50/50 hover:bg-gray-50"}`}
              >
                <div>
                  <h3 className="font-bold text-xs text-gray-900">{item.label}</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">{item.desc}</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${item.active ? "bg-red-500" : "bg-gray-300"}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${item.active ? "translate-x-5" : "translate-x-0"}`}></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Tự Động Dặn Quán (Auto Chef Notes) */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-xl bg-orange-50 text-[#ff7b00] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">edit_note</span>
            </span>
            <div>
              <h2 className="font-extrabold text-base text-gray-900">Tự Động Dặn Quán (Auto Chef Notes)</h2>
              <p className="text-xs text-gray-400">Khi đặt món, AI tự động thêm các ghi chú này vào hóa đơn bếp</p>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            <div className="p-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-gray-900">Không rắc hành lá & hành phi</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Áp dụng cho mọi món nước và món cơm</p>
              </div>
              <div
                onClick={() => setChefNotes((prev) => ({ ...prev, noOnions: !prev.noOnions }))}
                className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative flex items-center px-0.5 ${chefNotes.noOnions ? "bg-[#ff7b00]" : "bg-gray-300"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${chefNotes.noOnions ? "translate-x-5" : "translate-x-0"}`}></div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-gray-900">Mức độ cay tối đa</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Cấp độ 2/10 (Ít cay, ấm bụng, ớt rim vừa phải)</p>
              </div>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 font-extrabold text-xs rounded-xl border border-amber-200">
                Cấp độ 2 (Ít cay)
              </span>
            </div>

            <div className="p-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-gray-900">Ưu tiên nước dùng thanh trong, ít dầu béo</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Tự động chọn phiên bản nước trong tại quán</p>
              </div>
              <div
                onClick={() => setChefNotes((prev) => ({ ...prev, lowOil: !prev.lowOil }))}
                className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative flex items-center px-0.5 ${chefNotes.lowOil ? "bg-[#ff7b00]" : "bg-gray-300"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${chefNotes.lowOil ? "translate-x-5" : "translate-x-0"}`}></div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: AI Engine Metrics */}
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl p-6 border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
              <span className="material-symbols-outlined text-[24px]">neurology</span>
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-gray-900">EatWise Match Engine: 99.8% Chính Xác</h3>
              <p className="text-xs text-gray-500 mt-0.5">Đã học sâu qua 24 bữa ăn và 3 tầng kiểm duyệt an toàn</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3 bg-[#ff7b00] hover:bg-[#e66a00] text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {saving ? <span className="material-symbols-outlined animate-spin text-[16px]">sync</span> : <span className="material-symbols-outlined text-[16px]">save</span>}
            {saving ? "Đang lưu..." : "Lưu Thay Đổi"}
          </button>
        </section>

      </div>
    </div>
  );
}
