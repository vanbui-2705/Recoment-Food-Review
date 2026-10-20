import { apiRequest } from "./profileApi.js";

const query = (params = {}) => {
  const value = new URLSearchParams();
  for (const [key, entry] of Object.entries(params)) {
    if (entry !== undefined && entry !== null && entry !== "") {
      value.set(key, String(entry));
    }
  }
  const serialized = value.toString();
  return serialized ? `?${serialized}` : "";
};

export const fetchAdminUserStats = () =>
  apiRequest("/admin/users/stats").then((response) => response.data);

export const fetchAdminUsers = (params = {}) =>
  apiRequest(`/admin/users${query(params)}`).then((response) => response.data);

export const fetchAdminUser = (id) =>
  apiRequest(`/admin/users/${encodeURIComponent(id)}`).then((response) => response.data);

export const updateAdminUserStatus = (id, status, expectedUpdatedAt) =>
  apiRequest(`/admin/users/${encodeURIComponent(id)}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, expectedUpdatedAt }),
  }).then((response) => response.data);

export const fetchAdminAudit = (params = {}) =>
  apiRequest(`/admin/audit${query(params)}`).then((response) => response.data);
