import { useState } from "react";

export default function MapPage({ onNavigate }) {
  const [radius, setRadius] = useState("2km");
  const [category, setCategory] = useState("all");
  const [selectedPlace, setSelectedPlace] = useState(null);

  const places = [
    {
      id: 1,
      name: "Bún Bò Huế O Xuân",
      address: "Ngõ 79 Duy Tân, Cầu Giấy, Hà Nội",
      distance: "850m",
      rating: "4.9",
      ratingCount: "1.2k",
      price: "50.000đ - 65.000đ",
      tags: ["Bún bò", "Nước trong", "Bếp an toàn"],
      open: "Đang mở cửa • Đến 21:30",
      image: "/assets/stitch/bun-bo-hue.jpg",
      status: "Khuyên dùng bởi AI",
    },
    {
      id: 2,
      name: "Phở Gia Truyền Bát Đàn",
      address: "49 Bát Đàn, Cầu Giấy chi nhánh 2",
      distance: "1.2km",
      rating: "4.8",
      ratingCount: "950",
      price: "55.000đ - 70.000đ",
      tags: ["Phở bò", "Không hành", "Nước dùng thanh"],
      open: "Đang mở cửa • Đến 22:00",
      image: "/assets/stitch/pho-bo.jpg",
      status: "Chuẩn vị truyền thống",
    },
    {
      id: 3,
      name: "Cơm Tấm Ba Ghiền",
      address: "102 Trần Thái Tông, Cầu Giấy",
      distance: "1.5km",
      rating: "4.9",
      ratingCount: "2.1k",
      price: "45.000đ - 60.000đ",
      tags: ["Cơm sườn", "Chắc dạ", "Nướng than"],
      open: "Đang mở cửa • Đến 21:00",
      image: "/assets/stitch/com-tam.jpg",
      status: "Bán chạy giờ trưa",
    },
    {
      id: 4,
      name: "Gà Ta Quán",
      address: "18 Duy Tân, Cầu Giấy",
      distance: "700m",
      rating: "4.7",
      ratingCount: "620",
      price: "40.000đ - 55.000đ",
      tags: ["Miến gà", "Gà đồi", "Ăn nhẹ healthy"],
      open: "Đang mở cửa • Đến 21:00",
      image: "/assets/stitch/mien-ga.jpg",
      status: "Gần nhất",
    },
  ];

  return (
    <div className="flex flex-col xl:flex-row h-full w-full p-4 lg:p-6 lg:pt-2 gap-4 lg:gap-6 overflow-hidden bg-[#f8f9fa]">
      
      {/* Left List of Restaurants */}
      <div className="w-full xl:w-[460px] shrink-0 h-full flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Search & Filter Header */}
        <div className="p-4 lg:p-5 border-b border-gray-100 bg-white z-10 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Bản đồ Quán Ngon</h2>
              <p className="text-xs text-gray-400 font-medium mt-0.5">Tìm thấy 18 quán đạt chuẩn an toàn quanh bạn</p>
            </div>
            <span className="px-2.5 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> GPS Cầu Giấy
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {["Tất cả", "Gần nhất (< 1km)", "Bún & Phở", "Cơm trưa", "Healthy"].map((item, idx) => (
              <button
                key={idx}
                onClick={() => setCategory(item)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${category === item || (idx === 0 && category === "all") ? "bg-[#ff7b00] text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Places List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {places.map((place) => {
            const active = selectedPlace?.id === place.id;
            return (
              <div
                key={place.id}
                onClick={() => setSelectedPlace(place)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 ${active ? "border-[#ff7b00] bg-orange-50/40 shadow-sm" : "border-gray-100 bg-white hover:border-gray-200"}`}
              >
                <img src={place.image} alt={place.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h3 className="font-bold text-sm text-gray-900 truncate">{place.name}</h3>
                    <span className="text-[#ff7b00] font-bold text-xs shrink-0 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      {place.rating}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mb-1.5">{place.address}</p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold mb-2">
                    <span className="text-[#00a67d] bg-[#e6f6f2] px-1.5 py-0.5 rounded">{place.distance}</span>
                    <span>{place.price}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {onNavigate && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onNavigate("chat"); }}
                        className="px-2.5 py-1 bg-[#ff7b00] text-white text-[10px] font-bold rounded-lg hover:bg-[#e66a00] transition-colors"
                      >
                        Nhờ AI đặt
                      </button>
                    )}
                    <button className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-lg hover:bg-gray-200 transition-colors">
                      Chỉ đường
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Map Canvas */}
      <div className="flex-1 h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative flex flex-col">
        {/* Interactive Simulated Map */}
        <div className="w-full h-full relative bg-[#e5e9f0] overflow-hidden">
          {/* Map Grid Pattern */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          ></div>

          {/* Map Vector Roads */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 600" preserveAspectRatio="none">
            <path d="M 0 150 Q 250 180 500 120 T 800 200" fill="none" stroke="#ffffff" strokeWidth="16" />
            <path d="M 200 0 L 260 600" fill="none" stroke="#ffffff" strokeWidth="12" />
            <path d="M 500 0 L 530 600" fill="none" stroke="#ffffff" strokeWidth="10" />
            <path d="M 100 450 L 750 480" fill="none" stroke="#ffffff" strokeWidth="14" />
            {/* Highlight route */}
            <path d="M 260 250 L 380 280 L 460 220 L 520 330" fill="none" stroke="#ff7b00" strokeWidth="5" strokeDasharray="6,4" />
          </svg>

          {/* User Location Pin */}
          <div className="absolute top-[240px] left-[250px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <span className="relative flex h-8 w-8">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-8 w-8 bg-blue-600 text-white items-center justify-center shadow-lg border-2 border-white">
                <span className="material-symbols-outlined text-[16px]">person_pin_circle</span>
              </span>
            </span>
            <span className="bg-gray-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 shadow-md whitespace-nowrap">
              Bạn ở đây (Cầu Giấy)
            </span>
          </div>

          {/* Restaurant Pins */}
          {places.map((place, index) => {
            const positions = [
              { top: "320px", left: "510px" },
              { top: "180px", left: "420px" },
              { top: "430px", left: "340px" },
              { top: "160px", left: "190px" },
            ];
            const pos = positions[index] || { top: "300px", left: "300px" };
            return (
              <div
                key={place.id}
                onClick={() => setSelectedPlace(place)}
                style={{ top: pos.top, left: pos.left }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
              >
                <div className="flex flex-col items-center">
                  <div className="bg-[#ff7b00] text-white p-2 rounded-2xl shadow-xl flex items-center gap-1.5 border-2 border-white transition-transform group-hover:scale-110">
                    <span className="material-symbols-outlined text-[16px]">restaurant</span>
                    <span className="text-[11px] font-bold whitespace-nowrap">{place.name}</span>
                  </div>
                  <div className="w-2.5 h-2.5 bg-[#ff7b00] rotate-45 -mt-1.5 border-r border-b border-white"></div>
                </div>
              </div>
            );
          })}

          {/* Floating Map Controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-30">
            <button className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 border border-gray-100">
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
            <button className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 border border-gray-100">
              <span className="material-symbols-outlined text-[20px]">remove</span>
            </button>
            <button className="w-10 h-10 bg-white rounded-xl shadow-md flex items-center justify-center text-blue-600 hover:bg-gray-50 border border-gray-100">
              <span className="material-symbols-outlined text-[20px]">my_location</span>
            </button>
          </div>

          {/* Active Place Overlay Card */}
          {selectedPlace && (
            <div className="absolute bottom-6 left-6 right-6 max-w-md bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-gray-100 z-30 flex gap-4">
              <img src={selectedPlace.image} alt={selectedPlace.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-sm text-gray-900 truncate">{selectedPlace.name}</h4>
                  <button onClick={() => setSelectedPlace(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                </div>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">{selectedPlace.address}</p>
                <p className="text-[11px] font-bold text-[#ff7b00] mt-1">{selectedPlace.distance} • {selectedPlace.price}</p>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("chat")}
                    className="mt-2 w-full py-1.5 bg-[#ff7b00] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#e66a00]"
                  >
                    Nhờ AI đặt món tại quán này
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
