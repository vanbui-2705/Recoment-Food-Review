import { apiRequest } from "./profileApi.js";

export async function createOrder(payload) {
  return apiRequest("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMyOrders() {
  return apiRequest("/orders/my-orders");
}

export async function fetchOrderDetail(id) {
  return apiRequest(`/orders/${encodeURIComponent(id)}`);
}

export async function cancelOrder(id) {
  return apiRequest(`/orders/${encodeURIComponent(id)}/cancel`, {
    method: "PATCH",
  });
}
