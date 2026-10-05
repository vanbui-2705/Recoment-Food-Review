export const money = (amount) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    amount,
  );
export const date = (value) => new Date(value).toLocaleString("vi-VN");
export const meals = [
  ["BREAKFAST", "Bữa sáng"],
  ["LUNCH", "Bữa trưa"],
  ["DINNER", "Bữa tối"],
  ["SNACK", "Bữa phụ"],
  ["LATE_NIGHT", "Ăn khuya"],
];
