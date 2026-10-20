export type BehavioralDish = {
  id: string;
  cuisineCode: string;
  priceMin: number;
  priceMax: number;
  spicyLevel: number;
  sweetLevel: number;
  sourLevel: number;
  saltyLevel: number;
};

export type BehavioralEvent = {
  id: string;
  dishId: string;
  type: "VIEWED" | "LIKED" | "SKIPPED" | "CHOSEN" | "EATEN" | "RATED";
  rating: number | null;
  at: Date;
};

export type ExplicitDishPreference = {
  dishId: string;
  preference: "LIKED" | "DISLIKED";
  updatedAt: Date;
};

type WeightedSignal = {
  dish: BehavioralDish;
  strength: number;
  source: "EVENT" | "PREFERENCE";
};

export type BehavioralSnapshot = {
  signals: WeightedSignal[];
  sampleSize: number;
  confidence: "COLD_START" | "LEARNING" | "ESTABLISHED";
  positiveCuisineCodes: string[];
};

const DAY_MS = 86_400_000;
const HALF_LIFE_DAYS = 45;
const MAX_ADJUSTMENT = 24;

const eventStrength = (event: BehavioralEvent) => {
  if (event.type === "VIEWED") return 0.15;
  if (event.type === "LIKED") return 2.8;
  if (event.type === "SKIPPED") return -2.8;
  if (event.type === "CHOSEN") return 2;
  if (event.type === "EATEN") return 3.2;
  if (event.type === "RATED" && event.rating !== null) return (event.rating - 3) * 1.5;
  return 0;
};

const priceBand = (dish: BehavioralDish) => {
  const price = Math.max(dish.priceMin, dish.priceMax);
  if (price <= 60_000) return 0;
  if (price <= 150_000) return 1;
  if (price <= 350_000) return 2;
  return 3;
};

const similarity = (candidate: BehavioralDish, signal: BehavioralDish) => {
  if (candidate.id === signal.id) return { value: 1, reason: "DIRECT" as const };
  const cuisine = candidate.cuisineCode === signal.cuisineCode ? 1 : 0;
  const flavor =
    1 -
    (["spicyLevel", "sweetLevel", "sourLevel", "saltyLevel"] as const).reduce(
      (sum, key) => sum + Math.abs(candidate[key] - signal[key]),
      0,
    ) /
      400;
  const price = 1 - Math.abs(priceBand(candidate) - priceBand(signal)) / 3;
  const value = cuisine * 0.45 + flavor * 0.4 + price * 0.15;
  const reason = cuisine >= flavor && cuisine >= price ? "CUISINE" : flavor >= price ? "FLAVOR" : "PRICE";
  return { value, reason } as const;
};

export function buildBehavioralSnapshot(
  dishes: BehavioralDish[],
  events: BehavioralEvent[],
  preferences: ExplicitDishPreference[],
  now = new Date(),
): BehavioralSnapshot {
  const dishById = new Map(dishes.map((dish) => [dish.id, dish]));
  const grouped = new Map<string, BehavioralEvent[]>();
  for (const event of events) {
    if (!dishById.has(event.dishId) || event.at > now) continue;
    const key = `${event.dishId}:${event.type}`;
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }

  const signals: WeightedSignal[] = [];
  for (const rows of grouped.values()) {
    rows
      .sort((left, right) => +right.at - +left.at || right.id.localeCompare(left.id))
      .slice(0, rows[0]?.type === "VIEWED" ? 1 : 3)
      .forEach((event, index) => {
        const raw = eventStrength(event);
        if (!raw) return;
        const ageDays = Math.max(0, (+now - +event.at) / DAY_MS);
        const recency = 0.5 ** (ageDays / HALF_LIFE_DAYS);
        signals.push({
          dish: dishById.get(event.dishId)!,
          strength: raw * recency * (1 / (index + 1)),
          source: "EVENT",
        });
      });
  }
  for (const preference of preferences) {
    const dish = dishById.get(preference.dishId);
    if (!dish) continue;
    signals.push({
      dish,
      strength: preference.preference === "LIKED" ? 4 : -4,
      source: "PREFERENCE",
    });
  }

  const cuisineScores = new Map<string, number>();
  for (const signal of signals) {
    cuisineScores.set(
      signal.dish.cuisineCode,
      (cuisineScores.get(signal.dish.cuisineCode) ?? 0) + signal.strength,
    );
  }
  const sampleSize = signals.length;
  return {
    signals,
    sampleSize,
    confidence: sampleSize < 3 ? "COLD_START" : sampleSize < 8 ? "LEARNING" : "ESTABLISHED",
    positiveCuisineCodes: [...cuisineScores]
      .filter(([, score]) => score > 0.5)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 3)
      .map(([code]) => code),
  };
}

export function behavioralAdjustment(candidate: BehavioralDish, snapshot: BehavioralSnapshot) {
  let raw = 0;
  const contributions = new Map<"DIRECT" | "CUISINE" | "FLAVOR" | "PRICE", number>();
  for (const signal of snapshot.signals) {
    const match = similarity(candidate, signal.dish);
    const contribution = signal.strength * match.value;
    raw += contribution;
    contributions.set(match.reason, (contributions.get(match.reason) ?? 0) + contribution);
  }
  const adjustment = Math.max(-MAX_ADJUSTMENT, Math.min(MAX_ADJUSTMENT, raw * 2.5));
  const leading = [...contributions].sort(
    (left, right) => Math.abs(right[1]) - Math.abs(left[1]) || left[0].localeCompare(right[0]),
  )[0];
  return {
    adjustment: Math.round(adjustment * 100) / 100,
    materiallyInfluenced: Math.abs(adjustment) >= 2,
    reasonCode:
      !leading || Math.abs(adjustment) < 2
        ? null
        : (`BEHAVIOR_${adjustment > 0 ? "MATCH" : "AVOID"}_${leading[0]}` as const),
  };
}

