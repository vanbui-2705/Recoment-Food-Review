import { normalizeFoodText } from "./food.schema.js";

// Explicit equivalents only; never infer identity from ingredients or fuzzy similarity.
const equivalents = new Map([
  ["beef pho", "pho bo"],
  ["pho beef", "pho bo"],
  ["chicken pho", "pho ga"],
  ["pho chicken", "pho ga"],
]);
export function foodIdentity(title: string): string {
  const normalized = normalizeFoodText(title);
  return equivalents.get(normalized) ?? normalized;
}
