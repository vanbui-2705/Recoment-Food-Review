import { useState } from "react";

export default function HistoryPage({ onNavigate }) {
  const [filter, setFilter] = useState("all");

  const orders = [
    {
      id: "#HW-8924",
      dish: "Bún Bò Huế O Xuân",
      note: "1x Tô Đặc Biệt (Không hành lá, Nước trong)",
      price: "55.000đ",
      time: "Hôm nay, 11:42 AM",
      status: "DELIVERING",
      statusText: "Đang giao hàng (12 phút nữa)",
      driver: "Bác Trần Hùng • Honda Wave 29E1-482.91",
      image: "/assets/stitch/bun-bo-hue.jpg",
    },
    {
      id: "#HW-8810",
      dish: "Phở Bò Tái Lăn Bát Đàn",
      note: "1x Tô Tái Lăn (Bỏ hành, ít mỡ gầu)",
      price: "60.000đ",
      time: "Hôm qua, 12:15 PM",
      status: "COMPLETED",
      statusText: "Đã hoàn thành • Đạt 98% hợp vị",
      driver: "Lê Hoàng Nam • Honda Winner X",
      image: "/assets/stitch/pho-bo.jpg",
    },
    {
      id: "#HW-8755",
      dish: "Cơm Tấm Ba Ghiền",
      note: "1x Sườn bì chả nướng than",
      price: "50.000đ",
      time: "3 ngày trước, 12:00 PM",
      status: "COMPLETED",
      statusText: "Đã hoàn thành",
      driver: "Nguyễn Văn Tuấn • Wave Alpha",
      image: "/assets/stitch/com-tam.jpg",
    },
    {
      id: "#HW-8690",
      dish: "Miến Gà Ta Trộn",
      note: "1x Miến đùi gà thả vườn (Nước trong)",
      price: "45.000đ",
      time: "5 ngày trước, 18:30 PM",
      status: "COMPLETED",
      statusText: "Đã hoàn thành",
      driver: "Phạm Hữu Long • Vision",
      image: "/assets/stitch/mien-ga.jpg",
    },
  ];

  return (
    <div className="h-full w-full overflow-y-auto p-4 lg:p-6 lg:pt-2 bg-[#f8f9fa]">
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        
        {/* Top Header */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-orange-50 text-[#ff7b00] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">receipt_long</span>
              </span>
              <h1 className="text-xl font-extrabold text-gray-900">Lịch Sử & Đơn Hàng AI</h1>
            </div>
            <p className="text-xs text-gray-400 font-medium mt-1">
              Theo dõi lộ trình giao hàng trực tiếp và lưu trữ lịch sử ẩm thực cá nhân
            </p>
          </div>

          <div className="flex gap-2">
            {["all", "delivering", "completed"].map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${filter === type ? "bg-[#ff7b00] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {type === "all" ? "Tất cả" : type === "delivering" ? "Đang giao" : "Đã ăn"}
              </button>
            ))}
          </div>
        </div>

        {/* Live Active Order Banner (If delivering) */}
        {orders.filter(o => o.status === "DELIVERING").map(order => (
          <div key={order.id} className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-3xl p-6 border border-orange-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
                <span className="font-extrabold text-xs text-green-700 uppercase tracking-wider">Đơn hàng đang giao trực tiếp</span>
              </div>
              <span className="font-bold text-xs text-gray-400">{order.id}</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-4 items-center">
                <img src={order.image} alt={order.dish} className="w-16 h-16 rounded-2xl object-cover shadow-sm shrink-0" />
                <div>
                  <h3 className="font-extrabold text-base text-gray-900">{order.dish}</h3>
                  <p className="text-xs text-gray-600 font-medium">{order.note}</p>
                  <p className="text-xs text-[#ff7b00] font-bold mt-1">{order.statusText}</p>
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("chat")}
                    className="px-4 py-2.5 bg-[#ff7b00] text-white text-xs font-bold rounded-xl shadow-md hover:bg-[#e66a00] flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
                  >
                    <span className="material-symbols-outlined text-[16px]">route</span>
                    Xem lộ trình GPS
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Order History Cards */}
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider px-1">Lịch sử các bữa ăn</h2>
          
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:border-gray-200 transition-all">
              <div className="flex gap-4 items-center min-w-0">
                <img src={order.image} alt={order.dish} className="w-14 h-14 rounded-2xl object-cover shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-extrabold text-sm text-gray-900 truncate">{order.dish}</h3>
                    <span className="text-[10px] text-gray-400 font-medium">{order.id}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{order.note}</p>
                  <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-1 font-medium">
                    <span>{order.time}</span>
                    <span>•</span>
                    <span className="font-bold text-gray-700">{order.price}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${order.status === "DELIVERING" ? "bg-orange-100 text-[#ff7b00]" : "bg-emerald-50 text-emerald-700"}`}>
                  {order.status === "DELIVERING" ? "Đang giao" : "Đã hoàn thành"}
                </span>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("chat")}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors whitespace-nowrap"
                  >
                    Đặt lại
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
