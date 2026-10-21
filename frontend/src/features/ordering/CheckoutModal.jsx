import { useState, useId } from "react";
import { createOrder } from "../../ordersApi.js";

export default function CheckoutModal({
  cart,
  isOpen,
  onClose,
  onOrderSuccess,
}) {
  if (!isOpen || !cart || cart.length === 0) return null;

  const [name, setName] = useState(() => {
    try {
      const saved = localStorage.getItem("eatwise_user_profile");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) return parsed.name;
      }
    } catch (e) {
      // ignore
    }
    return "Nguyễn Tuấn Kiên";
  });

  const [phone, setPhone] = useState("0987 654 321");
  const [address, setAddress] = useState(
    "Tòa nhà FPT Tower, Số 10 Phạm Văn Bạch, Cầu Giấy, Hà Nội"
  );
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod"); // 'cod' | 'vietqr'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = 15000;
  const total = subtotal + deliveryFee;

  const money = (val) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(val || 0);

  const restaurantName = cart[0]?.restaurantName || "Quán Ăn Ngon";

  // Mock VietQR URL
  const qrTransferContent = `RECFOOD ${phone.replace(/\D/g, "").slice(-4)}`;
  const vietQrUrl = `https://api.vietqr.io/image/970422-0901234567-compact2.jpg?amount=${total}&addInfo=${encodeURIComponent(
    qrTransferContent
  )}&accountName=REC%20FOOD%20VIETNAM`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage("Vui lòng nhập tên người nhận!");
      return;
    }
    if (!phone.trim()) {
      setErrorMessage("Vui lòng nhập số điện thoại giao hàng!");
      return;
    }
    if (!address.trim()) {
      setErrorMessage("Vui lòng nhập địa chỉ giao hàng!");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const payload = {
        restaurantName,
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          customizations: item.customizations || {},
        })),
        totalAmount: total,
        deliveryAddress: address.trim(),
        recipientName: name.trim(),
        recipientPhone: phone.trim(),
        paymentMethod,
        note: note.trim(),
      };

      const res = await createOrder(payload);
      if (res && res.success && res.order) {
        onOrderSuccess(res.order);
      } else {
        // Fallback simulated order if backend mock fails
        const mockOrder = {
          id: "ORD-" + Math.floor(100000 + Math.random() * 900000),
          ...payload,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        onOrderSuccess(mockOrder);
      }
    } catch (err) {
      console.warn("API createOrder failed, falling back to local order:", err);
      const mockOrder = {
        id: "ORD-" + Math.floor(100000 + Math.random() * 900000),
        restaurantName,
        items: cart,
        totalAmount: total,
        deliveryAddress: address.trim(),
        recipientName: name.trim(),
        recipientPhone: phone.trim(),
        paymentMethod,
        note: note.trim(),
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      onOrderSuccess(mockOrder);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-xl max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeInScale border border-gray-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50 via-amber-50 to-white">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-[#ff7b00] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-orange-500/20">
              🛵
            </span>
            <div>
              <p className="font-extrabold text-base sm:text-lg text-gray-900">
                Xác nhận đặt đơn & Giao hàng
              </p>
              <p className="text-xs text-orange-600 font-semibold">
                {restaurantName} • Dự kiến giao ~25-30 phút
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold transition"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Delivery Details */}
          <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 space-y-3">
            <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>📍</span> Thông tin nhận món
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  Họ tên người nhận *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-gray-200 text-gray-800 focus:outline-none focus:border-[#ff7b00] transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  Số điện thoại *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912 345 678"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-gray-200 text-gray-800 focus:outline-none focus:border-[#ff7b00] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">
                Địa chỉ giao hàng tận nơi *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Số nhà, tên ngõ/đường, tòa nhà, quận..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-gray-200 text-gray-800 focus:outline-none focus:border-[#ff7b00] transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">
                Ghi chú cho tài xế & quán
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Giao lên sảnh tòa nhà gọi trước 5 phút..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-gray-200 text-gray-800 focus:outline-none focus:border-[#ff7b00] transition"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 space-y-3">
            <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>💳</span> Phương thức thanh toán
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Option 1: COD */}
              <div
                onClick={() => setPaymentMethod("cod")}
                className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-center gap-2.5 ${
                  paymentMethod === "cod"
                    ? "border-[#ff7b00] bg-orange-50/60 text-[#ff7b00]"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    paymentMethod === "cod" ? "border-[#ff7b00]" : "border-gray-400"
                  }`}
                >
                  {paymentMethod === "cod" && (
                    <div className="w-2 h-2 rounded-full bg-[#ff7b00]" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold leading-tight">Tiền mặt (COD)</p>
                  <p className="text-[10px] opacity-75">Thanh toán khi nhận món</p>
                </div>
              </div>

              {/* Option 2: VietQR */}
              <div
                onClick={() => setPaymentMethod("vietqr")}
                className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-center gap-2.5 ${
                  paymentMethod === "vietqr"
                    ? "border-[#ff7b00] bg-orange-50/60 text-[#ff7b00]"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    paymentMethod === "vietqr" ? "border-[#ff7b00]" : "border-gray-400"
                  }`}
                >
                  {paymentMethod === "vietqr" && (
                    <div className="w-2 h-2 rounded-full bg-[#ff7b00]" />
                  )}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold leading-tight">VietQR Banking</p>
                  <p className="text-[10px] opacity-75">Quét mã QR tiện lợi</p>
                </div>
              </div>
            </div>

            {/* If VietQR selected: Show QR details */}
            {paymentMethod === "vietqr" && (
              <div className="p-3.5 bg-white rounded-xl border border-orange-200 flex flex-col sm:flex-row items-center gap-3 animate-fadeIn">
                <img
                  src={vietQrUrl}
                  alt="VietQR Chuyển khoản"
                  className="w-32 h-32 object-contain rounded-lg border border-gray-100 shadow-sm shrink-0"
                />
                <div className="text-xs space-y-1 text-gray-700 w-full">
                  <p className="font-bold text-[#ff7b00] flex items-center gap-1">
                    <span>⚡</span> Quét mã bằng mọi App Ngân Hàng
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Ngân hàng: <strong>MB Bank (Quân Đội)</strong>
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Số TK: <strong>0901234567</strong>
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Số tiền: <strong className="text-orange-600">{money(total)}</strong>
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Nội dung CK: <strong className="font-mono text-gray-900 bg-gray-100 px-1 py-0.5 rounded">{qrTransferContent}</strong>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Items Summary Preview */}
          <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 space-y-2">
            <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center justify-between">
              <span>Đơn hàng ({cart.length} món)</span>
              <span className="text-[11px] font-bold text-gray-500">
                {cart.reduce((c, i) => c + i.quantity, 0)} phần
              </span>
            </h3>

            <div className="divide-y divide-gray-100 max-h-36 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.id} className="py-1.5 flex items-center justify-between text-xs">
                  <div className="truncate pr-2">
                    <span className="font-bold text-gray-800">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="text-[11px] text-gray-400 ml-1">
                      ({item.customizations?.size || "M"})
                    </span>
                  </div>
                  <span className="font-bold text-gray-700 shrink-0">
                    {money(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200/80 pt-2 space-y-1 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Tiền món:</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Phí giao hàng:</span>
                <span>{money(deliveryFee)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-gray-900 pt-1 border-t border-gray-200">
                <span>Tổng cộng:</span>
                <span className="text-[#ff7b00]">{money(total)}</span>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-gradient-to-r from-[#ff7b00] to-orange-500 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold rounded-2xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang đặt đơn...</span>
              </>
            ) : (
              <>
                <span>🚀 Đặt đơn ngay ({money(total)})</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
