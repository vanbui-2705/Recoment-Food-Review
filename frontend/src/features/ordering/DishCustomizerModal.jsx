import { useState } from "react";

export default function DishCustomizerModal({
  dish,
  restaurant,
  isOpen,
  onClose,
  onAddToCart,
}) {
  if (!isOpen || !dish) return null;

  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState("M");
  const [sugar, setSugar] = useState("70%");
  const [ice, setIce] = useState("Đá chung");
  const [spice, setSpice] = useState("Cay vừa");
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [note, setNote] = useState("");

  const isDrink = /trà|cà phê|nước|sinh tố|smoothie|coffee|tea|juice/i.test(dish.name || dish.title);

  const availableToppings = isDrink
    ? [
        { id: "top_tc", name: "Trân châu trắng", price: 8000 },
        { id: "top_kc", name: "Kem Cheese béo ngậy", price: 12000 },
        { id: "top_th", name: "Thạch củ năng", price: 8000 },
      ]
    : [
        { id: "top_egg", name: "Trứng ốp la lòng đào", price: 8000 },
        { id: "top_meat", name: "Thịt / Sườn thêm", price: 25000 },
        { id: "top_quay", name: "Quẩy giòn nóng hổi", price: 10000 },
      ];

  const handleToggleTopping = (topping) => {
    setSelectedToppings((prev) =>
      prev.some((t) => t.id === topping.id)
        ? prev.filter((t) => t.id !== topping.id)
        : [...prev, topping],
    );
  };

  const basePrice = dish.price || dish.priceMin || 50000;
  const sizeSurcharge = size === "L" ? 10000 : 0;
  const toppingTotal = selectedToppings.reduce((sum, t) => sum + t.price, 0);
  const unitPrice = basePrice + sizeSurcharge + toppingTotal;
  const totalPrice = unitPrice * quantity;

  const money = (val) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(val || 0);

  const handleConfirm = () => {
    const item = {
      id: `${dish.id}_${Date.now()}`,
      dishId: dish.id,
      name: dish.name || dish.title,
      price: unitPrice,
      quantity,
      size,
      sugar: isDrink ? sugar : undefined,
      ice: isDrink ? ice : undefined,
      spice: !isDrink ? spice : undefined,
      toppings: selectedToppings.map((t) => t.name),
      note: note.trim() || undefined,
      image: dish.image,
      restaurantId: restaurant?.id || "res_default",
      restaurantName: restaurant?.name || "Quán Ăn",
      restaurantAddress: restaurant?.address || "",
    };
    onAddToCart(item);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-md max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeInScale">
        
        {/* Header with image */}
        <div className="relative h-44 sm:h-52 w-full bg-gray-100 shrink-0">
          <img
            src={dish.image}
            alt={dish.name || dish.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition"
          >
            ✕
          </button>

          <div className="absolute bottom-3 left-4 right-4 text-white">
            <span className="px-2 py-0.5 bg-[#ff7b00] rounded-md text-[10px] font-black uppercase tracking-wider">
              {dish.category || "Món ngon"}
            </span>
            <h2 className="text-base sm:text-lg font-black mt-1 leading-tight drop-shadow-sm">
              {dish.name || dish.title}
            </h2>
            <p className="text-xs text-orange-200 font-extrabold mt-0.5">
              {money(basePrice)}
            </p>
          </div>
        </div>

        {/* Scrollable options */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          
          {dish.description && (
            <p className="text-gray-500 leading-relaxed italic bg-gray-50 p-2.5 rounded-xl border border-gray-100">
              {dish.description}
            </p>
          )}

          {/* Size Choice */}
          <div>
            <label className="font-extrabold text-gray-800 block mb-2">
              Chọn Size:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "M", label: "Size Vừa (M)", extra: 0 },
                { key: "L", label: "Size Lớn (L)", extra: 10000 },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSize(s.key)}
                  className={`p-2.5 rounded-xl border text-center font-bold transition flex items-center justify-between ${
                    size === s.key
                      ? "border-[#ff7b00] bg-orange-50 text-[#ff7b00]"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{s.label}</span>
                  <span className="text-[10px]">{s.extra ? `+${money(s.extra)}` : "Tiêu chuẩn"}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Drink Options: Sugar & Ice */}
          {isDrink ? (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="font-extrabold text-gray-800 block mb-1.5">
                  Độ ngọt (Đường):
                </label>
                <select
                  value={sugar}
                  onChange={(e) => setSugar(e.target.value)}
                  className="w-full h-9 rounded-xl border border-gray-200 px-2 font-bold text-gray-700 outline-none focus:border-[#ff7b00]"
                >
                  <option value="100%">100% (Ngọt chuẩn)</option>
                  <option value="70%">70% (Ngọt vừa)</option>
                  <option value="50%">50% (Ít ngọt)</option>
                  <option value="0%">0% (Không đường)</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-gray-800 block mb-1.5">
                  Lượng đá:
                </label>
                <select
                  value={ice}
                  onChange={(e) => setIce(e.target.value)}
                  className="w-full h-9 rounded-xl border border-gray-200 px-2 font-bold text-gray-700 outline-none focus:border-[#ff7b00]"
                >
                  <option value="Đá chung">Đá chung ly</option>
                  <option value="Đá riêng">Để đá riêng</option>
                  <option value="Ít đá">Ít đá (50%)</option>
                  <option value="Không đá">Không đá</option>
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="font-extrabold text-gray-800 block mb-1.5">
                Mức độ cay:
              </label>
              <div className="flex gap-2">
                {["Không cay", "Cay nhẹ", "Cay vừa", "Siêu cay"].map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => setSpice(sp)}
                    className={`flex-1 py-1.5 rounded-xl border text-center font-bold text-[11px] transition ${
                      spice === sp
                        ? "border-red-500 bg-red-50 text-red-600"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {sp}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toppings Selection */}
          <div>
            <label className="font-extrabold text-gray-800 block mb-2">
              Topping & Món ăn kèm:
            </label>
            <div className="space-y-1.5">
              {availableToppings.map((topping) => {
                const active = selectedToppings.some((t) => t.id === topping.id);
                return (
                  <div
                    key={topping.id}
                    onClick={() => handleToggleTopping(topping)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      active
                        ? "border-[#ff7b00] bg-orange-50/60"
                        : "border-gray-100 hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-bold text-gray-800">{topping.name}</span>
                    <span className="font-extrabold text-[#ff7b00]">
                      +{money(topping.price)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Note input */}
          <div>
            <label className="font-extrabold text-gray-800 block mb-1.5">
              Ghi chú cho quán:
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Ít hành lá, cho nhiều tương đen, nước sôi..."
              maxLength={150}
              className="w-full h-9 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:border-[#ff7b00]"
            />
          </div>
        </div>

        {/* Footer with Quantity & Add to Cart button */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-black hover:bg-gray-200 transition"
            >
              -
            </button>
            <span className="w-6 text-center font-black text-xs text-gray-900">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-black hover:bg-gray-200 transition"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 bg-[#ff7b00] hover:bg-[#e66a00] text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-2"
          >
            <span>Thêm vào giỏ</span>
            <span>•</span>
            <span>{money(totalPrice)}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
