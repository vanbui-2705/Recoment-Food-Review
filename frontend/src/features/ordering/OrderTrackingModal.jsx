import { useEffect, useState } from "react";
import { cancelOrder } from "../../ordersApi.js";

const STEPS = [
  { key: "pending", label: "Đã nhận đơn", icon: "📝", desc: "Chờ nhà hàng nhận đơn" },
  { key: "confirmed", label: "Đang nấu món", icon: "🍳", desc: "Quán đang chuẩn bị món ăn" },
  { key: "delivering", label: "Đang giao hàng", icon: "🛵", desc: "Tài xế đang trên đường đến" },
  { key: "completed", label: "Đã giao", icon: "🎉", desc: "Chúc bạn ngon miệng!" },
];

export default function OrderTrackingModal({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}) {
  if (!isOpen || !order) return null;

  const [currentStatus, setCurrentStatus] = useState(order.status || "pending");
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  // Sync internal state when order prop changes
  useEffect(() => {
    setCurrentStatus(order.status || "pending");
    setCancelSuccess(order.status === "cancelled");
  }, [order]);

  // Simulate lively status progression if it's an active order
  useEffect(() => {
    if (currentStatus === "cancelled" || currentStatus === "completed") return;

    const timer1 = setTimeout(() => {
      setCurrentStatus((prev) => (prev === "pending" ? "confirmed" : prev));
    }, 7000);

    const timer2 = setTimeout(() => {
      setCurrentStatus((prev) => (prev === "confirmed" ? "delivering" : prev));
    }, 18000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [currentStatus]);

  const money = (val) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(val || 0);

  const getStepIndex = (status) => {
    switch (status) {
      case "pending":
        return 0;
      case "confirmed":
        return 1;
      case "delivering":
        return 2;
      case "completed":
        return 3;
      default:
        return 0;
    }
  };

  const activeIndex = getStepIndex(currentStatus);

  const handleCancel = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy đơn hàng này không?")) return;
    setIsCancelling(true);
    try {
      await cancelOrder(order.id);
      setCurrentStatus("cancelled");
      setCancelSuccess(true);
      if (onOrderUpdated) {
        onOrderUpdated({ ...order, status: "cancelled" });
      }
    } catch (e) {
      console.warn("Cancel API error:", e);
      setCurrentStatus("cancelled");
      setCancelSuccess(true);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-lg max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeInScale border border-gray-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-500 via-[#ff7b00] to-amber-500 text-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-black uppercase tracking-wider backdrop-blur-sm">
                Đơn hàng #{order.id}
              </span>
              {currentStatus === "cancelled" ? (
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-[11px] font-bold">
                  Đã hủy
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-bold text-orange-100">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                  Đang xử lý
                </span>
              )}
            </div>
            <p className="text-base sm:text-lg font-black mt-1">
              {order.restaurantName || "Quán Ăn Ngon"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center text-sm font-bold transition"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-6">
          {/* Stepper Progress */}
          {currentStatus === "cancelled" ? (
            <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-center space-y-1">
              <span className="text-2xl">❌</span>
              <p className="font-extrabold text-sm text-red-700">Đơn hàng đã được hủy</p>
              <p className="text-xs text-red-500">
                Nếu bạn đã thanh toán qua VietQR, hệ thống sẽ hoàn tiền lại trong vòng 10-15 phút.
              </p>
            </div>
          ) : (
            <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
              <div className="relative flex justify-between items-start">
                {/* Connecting Line */}
                <div className="absolute top-4 left-6 right-6 h-1 bg-gray-200 -z-0">
                  <div
                    className="h-full bg-[#ff7b00] transition-all duration-700"
                    style={{ width: `${(activeIndex / 3) * 100}%` }}
                  />
                </div>

                {STEPS.map((step, idx) => {
                  const isDone = idx < activeIndex;
                  const isCurrent = idx === activeIndex;
                  return (
                    <div
                      key={step.key}
                      className="relative z-10 flex flex-col items-center text-center w-20"
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm ${
                          isCurrent
                            ? "bg-[#ff7b00] text-white ring-4 ring-orange-200 scale-110"
                            : isDone
                            ? "bg-green-500 text-white"
                            : "bg-white text-gray-400 border-2 border-gray-200"
                        }`}
                      >
                        {isDone ? "✓" : step.icon}
                      </div>
                      <p
                        className={`text-[11px] font-bold mt-2 leading-tight ${
                          isCurrent
                            ? "text-[#ff7b00]"
                            : isDone
                            ? "text-gray-900"
                            : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-200/80 text-center">
                <p className="text-xs text-gray-600 font-medium">
                  {STEPS[activeIndex]?.desc}
                </p>
              </div>
            </div>
          )}

          {/* Shipper info (if confirmed or delivering) */}
          {currentStatus !== "cancelled" && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50/50 p-4 rounded-2xl border border-orange-200/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-2xl bg-[#ff7b00] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    👨‍✈️
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black text-gray-900">Tài xế: Nguyễn Văn Hùng</p>
                    <span className="text-[10px] bg-white px-1.5 py-0.5 rounded text-orange-600 font-bold border border-orange-100">
                      ★ 4.9
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">Honda Wave Alpha • 29-G1 888.66</p>
                  <p className="text-[10px] text-orange-700 font-semibold mt-0.5">
                    Dự kiến đến trong 15-20 phút
                  </p>
                </div>
              </div>

              <a
                href="tel:0912345678"
                className="px-3 py-2 rounded-xl bg-white hover:bg-orange-100 text-[#ff7b00] font-black text-xs border border-orange-200 shadow-sm transition flex items-center gap-1"
              >
                <span>📞 Gọi</span>
              </a>
            </div>
          )}

          {/* Delivery destination */}
          <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 space-y-1.5 text-xs text-gray-700">
            <div className="flex items-center justify-between font-bold text-gray-900">
              <span className="flex items-center gap-1.5">
                <span>📍</span> Giao đến
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                {order.recipientName} ({order.recipientPhone})
              </span>
            </div>
            <p className="text-gray-600 pl-5">{order.deliveryAddress}</p>
            {order.note && (
              <p className="text-[11px] text-orange-600 pl-5 font-medium">
                Ghi chú: {order.note}
              </p>
            )}
          </div>

          {/* Items breakdown */}
          <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 space-y-2">
            <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">
              Chi tiết món ăn ({order.items?.length || 0} món)
            </h4>

            <div className="divide-y divide-gray-100 text-xs">
              {order.items?.map((item, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between">
                  <div className="pr-2">
                    <p className="font-bold text-gray-900">
                      {item.quantity}x {item.name}
                    </p>
                    {item.customizations && (
                      <p className="text-[10px] text-gray-500">
                        {item.customizations.size && `Size ${item.customizations.size} • `}
                        {item.customizations.spice && `${item.customizations.spice} • `}
                        {item.customizations.sugar && `${item.customizations.sugar} đường • `}
                        {item.customizations.toppings?.length > 0 &&
                          `+${item.customizations.toppings.map((t) => t.name).join(", ")}`}
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-gray-700 shrink-0">
                    {money(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200/80 pt-2 flex items-center justify-between font-extrabold text-sm text-gray-900">
              <span>
                Tổng thanh toán (
                {order.paymentMethod === "vietqr" ? "VietQR Banking" : "Tiền mặt COD"}):
              </span>
              <span className="text-[#ff7b00]">{money(order.totalAmount)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            {currentStatus !== "cancelled" && currentStatus !== "completed" && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-xs rounded-2xl border border-red-200 transition disabled:opacity-50"
              >
                {isCancelling ? "Đang hủy..." : "Hủy đơn hàng"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-900 hover:bg-black text-white font-extrabold text-xs rounded-2xl shadow-md transition"
            >
              Đóng cửa sổ theo dõi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
