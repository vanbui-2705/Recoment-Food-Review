import { useState } from "react";

export const sourceNames = {
  GEOAPIFY: "Geoapify",
  FOURSQUARE: "Foursquare",
  GOOGLE_PLACES: "Google Places",
  GOONG: "Goong",
  OPENSTREETMAP: "OpenStreetMap",
  THEMEALDB: "TheMealDB",
  SPOONACULAR: "Spoonacular",
};

export default function DiscoveryPage({ onNavigate = () => {}, onSelectDish = () => {} }) {
  return (
    <div className="flex flex-col h-full w-full p-4 lg:p-6 lg:pt-2 overflow-y-auto overflow-x-hidden relative">
      
      {/* Top AI Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-3 lg:p-4 flex flex-col md:flex-row items-start md:items-center justify-between mb-4 lg:mb-6 shadow-sm gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-[10px] lg:text-[11px] font-bold text-blue-600 uppercase tracking-wide">EatWise • Personalized</span>
              <span className="text-[10px] lg:text-[11px] text-gray-500 font-medium">Đã kiểm tra an toàn 3 tầng</span>
            </div>
            <h2 className="font-bold text-[14px] lg:text-[16px] text-gray-900 mt-0.5 truncate">Trưa nay 24°C se mát tại Cầu Giấy — AI chọn riêng cho bạn</h2>
          </div>
        </div>
        <div className="flex gap-2 lg:gap-3 w-full md:w-auto">
          <button
            onClick={() => onNavigate("profile")}
            className="flex-1 md:flex-none px-3 lg:px-4 py-2 bg-white text-blue-600 font-bold text-[12px] lg:text-[13px] rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1 shadow-sm whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span> <span className="hidden sm:inline">Xem phân tích</span>
          </button>
          <button
            onClick={() => onNavigate("chat")}
            className="flex-[2] md:flex-none px-3 lg:px-5 py-2 bg-[#ff7b00] text-white font-bold text-[12px] lg:text-[13px] rounded-xl shadow-md hover:bg-[#e66a00] transition-colors flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px]">restaurant</span> AI tự động lên món
          </button>
        </div>
      </div>

      {/* Main Grid Widget Area */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 mb-6 lg:mb-8">
        
        {/* BIG LEFT CARD - Bún Bò Huế */}
        <div className="col-span-1 md:col-span-5 bg-white rounded-3xl p-5 lg:p-6 shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center flex-wrap gap-2">
              <span className="px-2.5 py-1 bg-[#e6f6f2] text-[#00a67d] rounded-full text-[10px] lg:text-[11px] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span> 98% Khẩu vị
              </span>
              <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] lg:text-[11px] font-bold hidden sm:block">Top #1 Bún Bò Cầu Giấy</span>
            </div>
            <button className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors shrink-0">
              <span className="material-symbols-outlined text-[18px]">favorite</span>
            </button>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-1 text-[#ffb800] text-[12px] lg:text-[13px] font-bold mb-1">
                <span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings: "'FILL' 1"}}>star</span> 4.9 (1.2k)
              </div>
              <h3 className="font-bold text-[20px] lg:text-[24px] text-gray-900 leading-tight mb-1">Bún Bò Huế O Xuân</h3>
              <p className="text-[10px] lg:text-[11px] font-bold text-gray-500 uppercase">ĐẶC BIỆT NƯỚC TRONG — BÒ NẠM</p>
              
              <p className="text-[12px] lg:text-[13px] text-gray-600 leading-relaxed mt-2 lg:mt-3 hidden sm:block">
                Nước hầm xương bò 14 tiếng thanh ngọt tự nhiên, sả ớt rim đậm đà. Đã bật khóa an toàn...
              </p>
            </div>
            <div className="w-[100px] lg:w-[120px] shrink-0 relative self-center sm:self-start">
              <img src="/assets/stitch/bun-bo-hue.jpg" className="w-[100px] lg:w-[120px] h-[100px] lg:h-[120px] rounded-full object-cover border-4 border-white shadow-md mx-auto" />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded-full text-[9px] lg:text-[10px] font-bold text-gray-700 shadow-sm border border-gray-100 whitespace-nowrap">
                550 kcal
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between mt-auto mb-4 lg:mb-6">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[24px] lg:text-[28px] text-[#ff7b00]">55.000đ</span>
              <span className="text-[12px] lg:text-[14px] text-gray-400 line-through">65.000đ</span>
            </div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-xl flex gap-2 mb-4 lg:mb-6">
            <span className="material-symbols-outlined text-blue-600 text-[18px]">verified</span>
            <div>
              <span className="text-[10px] lg:text-[11px] font-bold text-blue-600 uppercase">EatWise Reasoning</span>
              <p className="text-[11px] lg:text-[12px] text-gray-700 font-medium line-clamp-1">Quán có chứng nhận bếp riêng không nhiễm chéo h...</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onNavigate("chat")}
              className="flex-[2] bg-[#ff7b00] text-white h-11 lg:h-12 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:bg-[#e66a00] transition-colors text-[13px] lg:text-[14px]"
            >
              <span className="material-symbols-outlined text-[18px] lg:text-[20px]">smart_toy</span> Nhờ AI đặt ngay
            </button>
            <button
              onClick={() => onNavigate("map")}
              className="flex-[1] bg-white border border-gray-200 text-gray-700 h-11 lg:h-12 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors text-[13px] lg:text-[14px]"
            >
              <span className="material-symbols-outlined text-[18px] lg:text-[20px]">map</span> <span className="sm:hidden lg:inline">Bản đồ</span>
            </button>
          </div>
        </div>

        {/* MIDDLE COLUMN */}
        <div className="col-span-1 md:col-span-3 flex flex-row md:flex-col gap-4 lg:gap-6">
          {/* Wheel Widget */}
          <div className="bg-white rounded-3xl p-4 lg:p-5 shadow-sm border border-gray-100 flex flex-col items-center flex-1">
            <div className="flex justify-between w-full mb-2">
              <span className="text-[13px] lg:text-[14px] font-bold text-gray-900 truncate mr-2">Chưa biết ăn gì?</span>
              <button
                onClick={() => onNavigate("chat")}
                className="text-[11px] lg:text-[12px] text-[#ff7b00] font-bold whitespace-nowrap hover:underline"
              >
                Lắc AI
              </button>
            </div>
            
            <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full border-[5px] lg:border-[6px] border-blue-500 border-t-[#ff7b00] border-r-[#00a67d] border-b-purple-500 my-auto flex items-center justify-center relative cursor-pointer" onClick={() => onNavigate("chat")}>
              <div className="w-3 h-3 lg:w-4 lg:h-4 bg-white rounded-full shadow-md absolute -top-1"></div>
              <span className="material-symbols-outlined text-gray-300 text-[28px] lg:text-[32px]">restaurant</span>
            </div>
            
            <div className="text-center mt-auto w-full pt-2">
              <p className="font-bold text-[13px] lg:text-[14px] text-gray-900 truncate">Phở Bò Tái Lăn</p>
              <p className="text-[10px] lg:text-[11px] text-gray-500 mt-0.5 truncate">Đã lọc kiêng khem</p>
            </div>
          </div>

          {/* Swipe Card Widget */}
          <div
            onClick={() => onNavigate("chat")}
            className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-4 lg:p-5 shadow-md flex flex-col items-center justify-center text-white flex-1 relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow min-h-[140px]"
          >
            <div className="absolute top-0 right-0 w-24 h-24 lg:w-32 lg:h-32 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <span className="material-symbols-outlined text-[28px] lg:text-[36px] mb-1 lg:mb-2 opacity-90">style</span>
            <h3 className="font-bold text-[16px] lg:text-[18px] text-center">Quẹt siêu tốc</h3>
            <button className="mt-3 bg-white text-purple-600 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-[11px] lg:text-[12px] font-bold shadow-sm whitespace-nowrap pointer-events-none">
              Bắt đầu (15 món)
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="col-span-1 md:col-span-4 flex flex-col gap-4 lg:gap-6">
          
          {/* Active Order Widget */}
          <div
            onClick={() => onNavigate("history")}
            className="bg-white rounded-3xl p-4 lg:p-5 shadow-sm border border-gray-100 flex flex-col cursor-pointer hover:border-orange-200 transition-colors"
          >
            <div className="flex justify-between items-center mb-3 lg:mb-4">
              <span className="px-2.5 py-1 bg-green-50 text-green-600 rounded-full text-[10px] lg:text-[11px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Đang giao tới bạn
              </span>
              <span className="text-[10px] lg:text-[11px] text-gray-400 font-bold">#HW-8924</span>
            </div>
            
            <h3 className="font-bold text-[15px] lg:text-[16px] text-gray-900 leading-tight">Bún Bò Huế O Xuân</h3>
            <p className="text-[11px] lg:text-[12px] text-gray-500 mb-3 lg:mb-4 truncate">1x Tô Đặc Biệt (Không hành lá, Nước trong)</p>
            
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] lg:text-[11px] font-bold text-gray-400">Thời gian dự kiến</span>
              <span className="font-bold text-[16px] lg:text-[18px] text-[#ff7b00]">12 phút nữa</span>
            </div>
            
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="w-[60%] h-full bg-[#ff7b00] rounded-full"></div>
            </div>
            <div className="flex justify-between text-[9px] lg:text-[10px] font-bold text-gray-400 mb-3 lg:mb-4">
              <span className="text-[#ff7b00]">Đã lấy món</span>
              <span className="text-[#ff7b00]">Đang trên đường</span>
              <span>Điểm nhận</span>
            </div>

            <div className="flex items-center gap-2 lg:gap-3 pt-3 border-t border-gray-50">
              <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0"></div>
              <div className="min-w-0">
                <p className="font-bold text-[11px] lg:text-[12px] text-gray-900 truncate">Bác Trần Hùng</p>
                <p className="text-[9px] lg:text-[10px] text-gray-500 truncate">Honda Wave • 29E1</p>
              </div>
              <div className="ml-auto flex gap-1 lg:gap-2">
                <button className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[14px] lg:text-[16px]">chat</span></button>
                <button className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[14px] lg:text-[16px]">call</span></button>
              </div>
            </div>
          </div>

          {/* Taste Profile AI */}
          <div className="bg-white rounded-3xl p-4 lg:p-5 shadow-sm border border-gray-100 flex flex-col flex-1">
            <div className="flex justify-between items-center mb-2 lg:mb-3">
              <h3 className="font-bold text-[14px] lg:text-[15px] text-gray-900 flex items-center gap-1">
                <span className="material-symbols-outlined text-blue-600 text-[18px]">neurology</span> Taste Profile
              </h3>
              <button
                onClick={() => onNavigate("profile")}
                className="text-[10px] lg:text-[11px] text-blue-600 font-bold hover:underline"
              >
                Chỉnh sửa
              </button>
            </div>
            
            <p className="text-[10px] lg:text-[11px] text-gray-500 mb-3 lg:mb-4 hidden sm:block">
              EatWise AI liên tục quét thực đơn nhà hàng theo 3 khóa ràng buộc:
            </p>
            
            <div className="flex flex-col gap-2 mb-3 lg:mb-4">
              <div className="flex items-center gap-2 lg:gap-3 bg-red-50 p-2 lg:p-2.5 rounded-xl border border-red-100">
                <span className="material-symbols-outlined text-red-500 text-[16px] lg:text-[18px]">gpp_bad</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[11px] lg:text-[12px] text-red-700 truncate">Khóa Dị ứng</div>
                  <div className="text-[9px] lg:text-[10px] text-red-600/80 truncate">Không tôm, cua, mực</div>
                </div>
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] lg:text-[9px] font-bold rounded uppercase">Active</span>
              </div>
              
              <div className="flex items-center gap-2 lg:gap-3 bg-gray-50 p-2 lg:p-2.5 rounded-xl border border-gray-100">
                <span className="material-symbols-outlined text-gray-500 text-[16px] lg:text-[18px]">eco</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[11px] lg:text-[12px] text-gray-900 truncate">Ghi chú bếp</div>
                  <div className="text-[9px] lg:text-[10px] text-gray-500 truncate">Không rắc hành lá</div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-auto pt-3 border-t border-gray-50">
              <span className="text-[9px] lg:text-[10px] text-gray-400 font-bold">Độ tin cậy lọc</span>
              <span className="text-[10px] lg:text-[11px] text-[#00a67d] font-bold">99.8% Chính xác</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Horizontal List */}
      <div>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-4 gap-2 sm:gap-0">
          <div>
            <h2 className="font-bold text-[18px] lg:text-[20px] text-gray-900">Món Ngon Đúng Mood Trưa Nay</h2>
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
              <button className="px-3 py-1 bg-gray-800 text-white rounded-full text-[11px] lg:text-[12px] font-bold whitespace-nowrap">Tất cả (AI chọn)</button>
              <button className="px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-full text-[11px] lg:text-[12px] font-bold whitespace-nowrap">Nước dùng nóng</button>
              <button className="px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-full text-[11px] lg:text-[12px] font-bold whitespace-nowrap">Chắc dạ cơm tấm</button>
              <button className="px-3 py-1 bg-white border border-gray-200 text-gray-600 rounded-full text-[11px] lg:text-[12px] font-bold whitespace-nowrap">Ăn nhẹ healthy</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 pb-4">
          {[
            { name: "Phở Bò Tái Lăn Bát Đàn", price: "60.000đ", img: "/assets/stitch/pho-bo.jpg", dist: "1.2km", tag: "0% Hành lá" },
            { name: "Cơm Tấm Ba Ghiền", price: "50.000đ", img: "/assets/stitch/com-tam.jpg", dist: "1.5km", tag: "Chắc dạ" },
            { name: "Miến Gà Ta Trộn", price: "45.000đ", img: "/assets/stitch/mien-ga.jpg", dist: "700m", tag: "An toàn 100%" },
            { name: "Lẩu Thái Ba Chỉ", price: "75.000đ", img: "https://source.unsplash.com/800x600/?hotpot", dist: "2.1km", tag: "Cay dịu" }
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group cursor-pointer flex flex-col">
              <div className="h-[120px] lg:h-[140px] relative overflow-hidden bg-gray-100 shrink-0">
                <img src={item.img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-2 left-2 flex gap-1">
                  <span className="bg-white/90 backdrop-blur px-1.5 py-0.5 lg:px-2 lg:py-1 rounded text-[9px] lg:text-[10px] font-bold text-[#00a67d] flex items-center gap-1 shadow-sm">
                    <span className="material-symbols-outlined text-[10px] lg:text-[12px]">check_circle</span> 98%
                  </span>
                </div>
                <div className="absolute top-2 right-2 bg-[#ff7b00] text-white px-1.5 py-0.5 lg:px-2 lg:py-1 rounded text-[9px] lg:text-[10px] font-bold shadow-sm max-w-[80px] truncate text-center">
                  {item.tag}
                </div>
              </div>
              <div className="p-3 lg:p-4 flex flex-col flex-1">
                <div className="flex justify-between items-center text-[9px] lg:text-[10px] text-gray-500 font-bold mb-1">
                  <span className="truncate mr-1">{item.dist}</span>
                  <span className="flex items-center text-[#ffb800] shrink-0"><span className="material-symbols-outlined text-[12px] lg:text-[14px]">star</span> 4.8</span>
                </div>
                <h4 className="font-bold text-[12px] lg:text-[14px] text-gray-900 leading-snug line-clamp-2 mb-2">{item.name}</h4>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-[14px] lg:text-[16px] text-[#ff7b00]">{item.price}</span>
                  </div>
                  <button
                    onClick={() => onNavigate("chat")}
                    className="h-7 lg:h-8 px-2 lg:px-3 bg-orange-50 text-[#ff7b00] rounded-lg lg:rounded-xl font-bold text-[11px] lg:text-[12px] flex items-center justify-center gap-1 hover:bg-[#ff7b00] hover:text-white transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span> <span className="hidden sm:inline">Đặt</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
