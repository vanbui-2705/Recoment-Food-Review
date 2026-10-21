export default function CartDrawer({
  cart,
  isOpen,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
}) {
  if (!isOpen) return null;

  const money = (val) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(val || 0);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = cart.length ? 15000 : 0;
  const total = subtotal + deliveryFee;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm animate-fadeIn"
    >
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col z-10 animate-slideLeft">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-orange-100 text-[#ff7b00] flex items-center justify-center font-black">
              🛒
            </span>
            <div>
              <p className="font-extrabold text-base text-gray-900">Giỏ hàng của bạn</p>
              <p className="text-[11px] text-gray-400 font-medium">
                {cart[0]?.restaurantName || "Món đã chọn"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                type="button"
                onClick={onClearCart}
                className="text-[11px] text-red-500 hover:text-red-700 font-bold transition"
              >
                Xóa tất cả
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Cart items list */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <span className="material-symbols-outlined text-5xl mb-2 text-gray-300">
                shopping_basket
              </span>
              <p className="font-bold text-sm text-gray-600">Giỏ hàng đang trống</p>
              <p className="text-xs text-gray-400 mt-1">
                Hãy chọn món ăn hoặc đồ uống yêu thích từ thực đơn quán để thêm vào giỏ.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-gray-50/70 rounded-2xl border border-gray-100 flex gap-3 items-center justify-between"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-14 h-14 rounded-xl object-cover shrink-0 bg-gray-200"
                />

                <div className="flex-1 min-w-0 text-xs">
                  <h4 className="font-extrabold text-gray-900 truncate">{item.name}</h4>
                  
                  {/* Customizations tags */}
                  <div className="flex flex-wrap gap-1 mt-0.5 text-[10px] text-gray-500">
                    {item.size && <span>Size {item.size}</span>}
                    {item.sugar && <span>• {item.sugar} đường</span>}
                    {item.ice && <span>• {item.ice}</span>}
                    {item.spice && <span>• {item.spice}</span>}
                    {item.toppings?.length > 0 && (
                      <span>• {item.toppings.join(", ")}</span>
                    )}
                  </div>

                  {item.note && (
                    <p className="text-[10px] text-amber-600 italic truncate mt-0.5">
                      Ghi chú: {item.note}
                    </p>
                  )}

                  <strong className="block text-xs font-black text-[#ff7b00] mt-1">
                    {money(item.price * item.quantity)}
                  </strong>
                </div>

                {/* Quantity Controls */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="text-gray-400 hover:text-red-500 text-xs"
                    title="Xóa món"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>

                  <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      className="w-5 h-5 rounded flex items-center justify-center font-black text-gray-700 hover:bg-gray-100 text-xs"
                    >
                      -
                    </button>
                    <span className="w-5 text-center font-black text-xs text-gray-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="w-5 h-5 rounded flex items-center justify-center font-black text-gray-700 hover:bg-gray-100 text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with Subtotal & Checkout */}
        {cart.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-gray-100 bg-white space-y-3 shrink-0">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Tiền món ({cart.reduce((c, i) => c + i.quantity, 0)} phần):</span>
                <span className="font-bold text-gray-800">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Phí giao hàng dự kiến:</span>
                <span className="font-bold text-emerald-600">{money(deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <strong className="font-extrabold text-gray-900">Tổng thanh toán:</strong>
                <strong className="font-black text-[#ff7b00] text-base">{money(total)}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={onCheckout}
              className="w-full py-3.5 bg-[#ff7b00] hover:bg-[#e66a00] text-white rounded-2xl font-black text-xs shadow-lg transition flex items-center justify-center gap-2"
            >
              <span>Tiến hành đặt hàng</span>
              <span>•</span>
              <span>{money(total)}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
