import { apiRequest } from "./profileApi.js";
import { mealPeriodForLocalHour } from "./dashboardAdapters.js";

const query = (params) => {
  const value = new URLSearchParams();
  for (const [key, entry] of Object.entries(params)) {
    if (entry !== undefined && entry !== null && entry !== "") {
      value.set(key, String(entry));
    }
  }
  const serialized = value.toString();
  return serialized ? `?${serialized}` : "";
};

export const createIdempotencyKey = () => crypto.randomUUID();

export const fetchTodayDashboard = (mealPeriod = mealPeriodForLocalHour()) =>
  Promise.allSettled([
    apiRequest(`/recommendations/today${query({ mealPeriod })}`),
    apiRequest(`/recipes/today${query({ mealPeriod })}`),
  ]).then(([recommendations, recipes]) => {
    if (recommendations.status === "rejected" && recipes.status === "rejected") {
      throw recommendations.reason;
    }
    return {
      recommendations:
        recommendations.status === "fulfilled"
          ? recommendations.value.data
          : { status: "UNAVAILABLE", items: [] },
      recipes:
        recipes.status === "fulfilled"
          ? recipes.value.data
          : { status: "UNAVAILABLE", items: [] },
    };
  });

export const createRecommendation = (input, idempotencyKey) =>
  apiRequest("/recommendations", {
    method: "POST",
    body: JSON.stringify({ ...input, idempotencyKey }),
  }).then((response) => response.data);

export const recordDishInteraction = (dishId, type, idempotencyKey, details = {}) =>
  apiRequest(`/users/me/dishes/${encodeURIComponent(dishId)}/interactions`, {
    method: "POST",
    body: JSON.stringify({ type, idempotencyKey, ...details }),
  }).then((response) => response.data);

export const saveDishPreference = (dishId, preference) =>
  apiRequest(`/users/me/dishes/${encodeURIComponent(dishId)}/preference`, {
    method: "PUT",
    body: JSON.stringify({ preference }),
  }).then((response) => response.data);

export const fetchDishRestaurants = (dishId) =>
  apiRequest(`/dishes/${encodeURIComponent(dishId)}/restaurants`).then(
    (response) => response.data,
  );

export const fetchDishes = (input = {}) =>
  apiRequest(`/dishes${query(input)}`).then((response) => response.data);

export const recordRecipeInteraction = (source, recipeId, type, idempotencyKey) =>
  apiRequest(
    `/recipes/${encodeURIComponent(source)}/${encodeURIComponent(recipeId)}/interactions`,
    {
      method: "POST",
      body: JSON.stringify({ type, idempotencyKey }),
    },
  ).then((response) => response.data);

export const fetchHistory = (input = {}) =>
  apiRequest(`/users/me/history${query(input)}`).then(
    (response) => response.data,
  );

export const recordHistoryFeedback = (
  kind,
  interactionId,
  type,
  idempotencyKey,
  rating,
) =>
  apiRequest(
    `/users/me/history/${encodeURIComponent(kind)}/${encodeURIComponent(interactionId)}/feedback`,
    {
      method: "POST",
      body: JSON.stringify({
        type,
        idempotencyKey,
        ...(rating === undefined ? {} : { rating }),
      }),
    },
  ).then((response) => response.data);

export const fetchNearbyFood = (input) =>
  apiRequest(`/discovery/nearby-food${query(input)}`).then(
    (response) => response.data,
  );

export const searchRestaurants = (input) =>
  apiRequest(`/discovery/restaurants${query(input)}`).then(
    (response) => response.data,
  );

export const listConversations = (page = 1) =>
  apiRequest(`/conversations${query({ page })}`).then(
    (response) => response.data,
  );

export const createConversation = () =>
  apiRequest("/conversations", { method: "POST" }).then(
    (response) => response.data,
  );

export const fetchConversation = (conversationId) =>
  apiRequest(`/conversations/${encodeURIComponent(conversationId)}`).then(
    (response) => response.data,
  );

export const sendConversationMessage = (
  conversationId,
  text,
  context,
  idempotencyKey,
) =>
  apiRequest(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ text, context, idempotencyKey }),
    },
  ).then((response) => response.data);

export const fetchChatEvents = (runId, after = 0) =>
  apiRequest(`/chat-runs/${encodeURIComponent(runId)}/events${query({ after })}`).then(
    (response) => response.data,
  );

export const streamChatEvents = (runId, after = 0, signal) =>
  apiRequest(
    `/chat-runs/${encodeURIComponent(runId)}/stream${query({ after })}`,
    { responseType: "stream", signal },
  );

export async function readChatEventStream(response, onEvent) {
  if (!response.body) return { after: 0, done: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let after = 0;
  let done = false;
  while (true) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const data = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (!data) continue;
      const event = JSON.parse(data);
      if (Number.isInteger(event.seq)) after = Math.max(after, event.seq);
      if (event.type === "DONE") done = true;
      onEvent(event);
    }
    if (chunk.done) break;
  }
  return { after, done };
}
