import { useState } from "react";

export default function ChatPage() {
  const [input, setInput] = useState("");

  return (
    <div className="flex flex-col xl:flex-row h-full w-full p-0 xl:p-6 xl:pt-2 gap-0 xl:gap-6 overflow-hidden relative bg-[#f8f9fa]">
      
      {/* Left Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-white xl:rounded-3xl shadow-sm border-x-0 xl:border-x border-t-0 xl:border-t border-b xl:border-b border-gray-100 overflow-hidden relative">
        {/* Top Banner */}
        <div className="bg-blue-50/50 p-3 lg:p-4 border-b border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between z-10 shrink-0 gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
              <span className="material-symbols-outlined text-[20px] lg:text-[24px]">smart_toy</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-[14px] lg:text-[16px] text-gray-900 leading-tight flex flex-wrap items-center gap-2">
                EatWise Concierge 
                <span className="px-1.5 lg:px-2 py-0.5 bg-blue-600 text-white rounded text-[8px] lg:text-[9px] uppercase tracking-wide">GPT-4O</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2 lg:gap-4 text-[9px] lg:text-[11px] text-gray-500 font-medium mt-1">
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px] lg:text-[14px] text-green-500">check_circle</span> #KW-8842</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px] lg:text-[14px]">cloud</span> 24°C</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:gap-4 text-[9px] lg:text-[11px] font-bold w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
            <span className="flex items-center gap-1 text-red-500 whitespace-nowrap"><span className="material-symbols-outlined text-[12px] lg:text-[14px]">gpp_bad</span> Shield: Bật</span>
            <span className="flex items-center gap-1 text-gray-500 whitespace-nowrap"><span className="material-symbols-outlined text-[12px] lg:text-[14px]">speed</span> 280ms</span>
            <span className="flex items-center gap-1 bg-gray-100 px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg text-gray-700 whitespace-nowrap">Ví: 1.250k</span>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col gap-4 lg:gap-6">
          <div className="text-center">
            <span className="bg-gray-50 px-2 lg:px-3 py-1 rounded-full text-[9px] lg:text-[11px] text-gray-400 font-bold border border-gray-100">
              Hôm nay, 11:42 AM • Phiên T-9920
            </span>
          </div>

          {/* User Message */}
          <div className="flex flex-col items-end w-full">
            <span className="text-[9px] lg:text-[11px] font-bold text-gray-400 mb-1 mr-2">Tuấn Khang</span>
            <div className="bg-[#ff7b00] text-white rounded-2xl rounded-tr-sm p-3 lg:p-4 max-w-[90%] sm:max-w-[80%] shadow-sm relative group cursor-pointer hover:bg-[#e66a00] transition-colors">
              <p className="text-[13px] lg:text-[14px] leading-relaxed font-medium">
                Trời se lạnh quá, tìm cho tôi tô bún bò Huế đậm vị gần Cầu Giấy, tuyệt đối không hành và không dị ứng hải sản nhé!
              </p>
              <span className="absolute bottom-1 right-2 text-[9px] lg:text-[10px] text-white/70 font-bold">11:42 <span className="material-symbols-outlined text-[10px] lg:text-[12px] align-middle">done_all</span></span>
            </div>
          </div>

          {/* AI Message */}
          <div className="flex flex-col items-start w-full relative">
            <div className="flex items-center gap-2 mb-1 ml-2">
              <span className="text-[9px] lg:text-[11px] font-bold text-blue-600 flex items-center gap-1">Neural Agent <span className="material-symbols-outlined text-[12px] lg:text-[14px]">verified</span></span>
              <span className="text-[8px] lg:text-[10px] bg-blue-50 text-blue-600 px-1.5 lg:px-2 py-0.5 rounded-full">Phân tích 18 quán</span>
            </div>
            
            <div className="flex gap-2 lg:gap-3 max-w-[95%] sm:max-w-[85%]">
              <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-blue-200">
                <span className="material-symbols-outlined text-[14px] lg:text-[18px]">smart_toy</span>
              </div>
              
              <div className="flex flex-col gap-2 lg:gap-3 min-w-0">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm p-3 lg:p-4 shadow-sm text-[13px] lg:text-[14px] text-gray-800 leading-relaxed relative">
                  Dạ anh Khang, thời tiết Hà Nội 24°C se lạnh rất hợp với nước dùng cay nồng 12 sả và ớt chưng! Em đã rà soát thực đơn và chọn ra quán này ạ:
                  <span className="absolute bottom-1 right-2 text-[9px] lg:text-[10px] text-gray-400 font-bold">11:42</span>
                </div>

                {/* Rich Food Card in Chat */}
                <div className="bg-white border-2 border-blue-100 rounded-2xl p-3 lg:p-4 shadow-sm w-full sm:w-[400px] hover:border-blue-300 transition-colors cursor-pointer">
                  <div className="flex gap-3 lg:gap-4">
                    <div className="relative w-20 h-20 lg:w-24 lg:h-24 shrink-0">
                      <img src="/assets/stitch/bun-bo-hue.jpg" className="w-full h-full object-cover rounded-xl shadow-sm" />
                      <span className="absolute top-1 left-1 bg-[#00a67d] text-white text-[8px] lg:text-[9px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 shadow-sm">
                        <span className="material-symbols-outlined text-[8px] lg:text-[10px]">check_circle</span> 98%
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-1">
                        <h3 className="font-bold text-[14px] lg:text-[16px] text-gray-900 leading-tight truncate">Bún Bò Huế O Xuân</h3>
                        <span className="font-bold text-[14px] lg:text-[16px] text-[#ff7b00]">55.000đ</span>
                      </div>
                      <p className="text-[10px] lg:text-[11px] text-gray-500 mb-1 lg:mb-2 truncate">Cách 850m</p>
                      <p className="text-[11px] lg:text-[12px] text-gray-700 leading-snug hidden sm:block">
                        Nước hầm xương bò 12 tiếng thơm sả quế. Cam kết chế biến riêng.
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-2 lg:mt-3 bg-red-50 p-2 rounded-xl flex flex-col gap-1 border border-red-100">
                    <span className="text-[9px] lg:text-[10px] font-bold text-red-600 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px] lg:text-[14px]">shield</span> Bỏ hành lá & chả tôm
                    </span>
                    <span className="text-[9px] lg:text-[10px] font-bold text-[#ff7b00] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px] lg:text-[14px]">local_fire_department</span> Vị cay 3 (Ấm bụng)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-3 lg:p-4 bg-white border-t border-gray-100 shrink-0 pb-[70px] lg:pb-4">
          <div className="flex gap-2 mb-2 lg:mb-3 px-1 lg:px-2 overflow-x-auto scrollbar-hide">
            <button className="px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-full text-[11px] lg:text-[12px] font-bold whitespace-nowrap">
              + Nhờ AI thêm quẩy
            </button>
            <button className="px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-full text-[11px] lg:text-[12px] font-bold whitespace-nowrap">
              + Thêm trà tắc ít ngọt
            </button>
          </div>
          
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[18px] lg:text-[24px]">mic</span>
            <input 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Yêu cầu AI thêm quẩy giòn..."
              className="w-full h-10 lg:h-12 bg-gray-50 rounded-xl lg:rounded-2xl pl-10 lg:pl-12 pr-12 lg:pr-14 text-[12px] lg:text-[13px] font-medium text-gray-700 outline-none border border-gray-200 focus:border-blue-400 focus:bg-white transition-all"
            />
            <button className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 lg:w-10 lg:h-10 bg-blue-600 text-white rounded-lg lg:rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[16px] lg:text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Live Order Dispatcher (Visible on XL screens, or overlay on mobile if we wanted, but we'll show it below on scroll for mobile) */}
      <div className="w-full xl:w-[320px] shrink-0 h-auto xl:h-full overflow-y-visible xl:overflow-y-auto flex flex-col gap-4 p-4 xl:p-0">
        
        {/* Tracker Panel */}
        <div className="bg-white rounded-3xl p-4 lg:p-5 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-center mb-4 lg:mb-6">
            <div>
              <h3 className="font-bold text-[14px] lg:text-[16px] text-gray-900 leading-tight">Live Order<br className="hidden xl:block" />Dispatcher</h3>
              <p className="text-[9px] lg:text-[10px] text-gray-400">Chuỗi tự động kích hoạt</p>
            </div>
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-50 rounded-full flex flex-col items-center justify-center border border-blue-100 shrink-0">
              <span className="material-symbols-outlined text-blue-600 text-[16px] lg:text-[18px]">schedule</span>
              <span className="text-[8px] lg:text-[9px] font-bold text-blue-600">12 Phút</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:gap-5 relative pl-4">
            <div className="absolute top-2 bottom-6 left-[23px] w-[2px] bg-gray-100"></div>
            
            <div className="relative flex gap-3 lg:gap-4">
              <div className="w-4 h-4 lg:w-5 lg:h-5 rounded-full bg-[#00a67d] border-2 border-white flex items-center justify-center shadow-sm shrink-0 relative z-10 mt-0.5">
                <span className="material-symbols-outlined text-white text-[10px] lg:text-[12px] font-bold">check</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[11px] lg:text-[12px] text-gray-900 truncate">Kiểm duyệt An toàn</p>
                <p className="text-[9px] lg:text-[10px] text-gray-500 mt-0.5 leading-snug">Passed: Khóa "Không hành" & "Hải sản"</p>
              </div>
            </div>
            
            <div className="relative flex gap-3 lg:gap-4">
              <div className="w-4 h-4 lg:w-5 lg:h-5 rounded-full bg-[#00a67d] border-2 border-white flex items-center justify-center shadow-sm shrink-0 relative z-10 mt-0.5">
                <span className="material-symbols-outlined text-white text-[10px] lg:text-[12px] font-bold">check</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[11px] lg:text-[12px] text-gray-900 truncate">Áp mã ưu đãi</p>
                <p className="text-[9px] lg:text-[10px] text-gray-500 mt-0.5 leading-snug">Tự động áp mã -15.000đ Gold Member</p>
              </div>
            </div>
            
            <div className="relative flex gap-3 lg:gap-4">
              <div className="w-4 h-4 lg:w-5 lg:h-5 rounded-full bg-[#00a67d] border-2 border-white flex items-center justify-center shadow-sm shrink-0 relative z-10 mt-0.5">
                <span className="material-symbols-outlined text-white text-[10px] lg:text-[12px] font-bold">check</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[11px] lg:text-[12px] text-gray-900 truncate">Truyền lệnh bếp</p>
                <p className="text-[9px] lg:text-[10px] text-gray-500 mt-0.5 leading-snug">Bếp nhận lúc 11:42, in hóa đơn đỏ</p>
              </div>
            </div>
            
            <div className="relative flex gap-3 lg:gap-4">
              <div className="w-4 h-4 lg:w-5 lg:h-5 rounded-full bg-white border-2 border-[#ff7b00] flex items-center justify-center shadow-sm shrink-0 relative z-10 mt-0.5">
                <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-[#ff7b00] rounded-full animate-pulse"></div>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[11px] lg:text-[12px] text-[#ff7b00] truncate">Tài xế nhận đơn</p>
                <p className="text-[9px] lg:text-[10px] text-gray-500 mt-0.5 leading-snug">Đang ở ngõ 79 Duy Tân (Cách 120m)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Map & Driver Panel */}
        <div className="bg-white rounded-3xl p-3 lg:p-4 shadow-sm border border-gray-100 flex flex-col gap-3 pb-[80px] xl:pb-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-bold text-[13px] lg:text-[14px] text-gray-900 flex items-center gap-1">
              <span className="material-symbols-outlined text-[#ff7b00] text-[16px] lg:text-[18px]">route</span> Lộ trình giao hàng
            </h3>
            <span className="text-[8px] lg:text-[9px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">GPS 2s</span>
          </div>

          <div className="w-full h-[140px] lg:h-[180px] bg-gray-100 rounded-2xl relative overflow-hidden border border-gray-200">
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(#9ca3af 1px, transparent 1px), linear-gradient(90deg, #9ca3af 1px, transparent 1px)', backgroundSize: '15px 15px' }}></div>
            <svg className="absolute inset-0 w-full h-full pointer-events-none preserve-3d" viewBox="0 0 300 180" preserveAspectRatio="none">
              <path d="M 50 50 L 120 80 L 180 60 L 250 120" fill="none" stroke="#ff7b00" strokeWidth="4" />
            </svg>
            
            {/* Map UI overlays */}
            <div className="absolute bottom-2 left-2 right-2 bg-gray-900/80 backdrop-blur-md rounded-xl p-1.5 lg:p-2 flex justify-between items-center text-white">
              <div className="flex flex-col items-center flex-1">
                <span className="text-[8px] lg:text-[9px] text-gray-300">Khoảng cách</span>
                <span className="text-[10px] lg:text-[12px] font-bold">850 mét</span>
              </div>
              <div className="w-px h-5 lg:h-6 bg-gray-600"></div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-[8px] lg:text-[9px] text-gray-300">Vận tốc</span>
                <span className="text-[10px] lg:text-[12px] font-bold">28 km/h</span>
              </div>
              <div className="w-px h-5 lg:h-6 bg-gray-600"></div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-[8px] lg:text-[9px] text-green-400">Đến lúc</span>
                <span className="text-[10px] lg:text-[12px] font-bold text-green-400">12:05 PM</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-2 lg:p-3 border border-gray-100 flex items-center gap-2 lg:gap-3">
            <img src="https://ui-avatars.com/api/?name=Nam&background=0066ff&color=fff" className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[11px] lg:text-[13px] text-gray-900 flex items-center gap-1 truncate">Lê Hoàng Nam <span className="text-[#ffb800] text-[9px] lg:text-[10px]">★4.9</span></p>
              <p className="text-[9px] lg:text-[10px] text-gray-500 truncate">Honda Winner X</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-white border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-100"><span className="material-symbols-outlined text-[12px] lg:text-[14px]">chat</span></button>
              <button className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100"><span className="material-symbols-outlined text-[12px] lg:text-[14px]">call</span></button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
