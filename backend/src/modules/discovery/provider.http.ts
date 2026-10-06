export type JsonObject = Record<string, unknown>;
export const object = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
export const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
export const string = (value: unknown): string => (typeof value === "string" ? value : "");
export const number = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
export function safeUrl(value: unknown): string | null {
  try {
    const url = new URL(string(value));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
export class ProviderError extends Error {
  constructor(public status: "UNAVAILABLE" | "QUOTA_EXCEEDED" | "INVALID_DATA") {
    super(status);
  }
}
export async function providerJson(
  provider: string,
  url: string,
  options: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<JsonObject> {
  try {
    const response = await fetcher(url, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(6000),
    });
    if (response.status === 429 || response.status === 402)
      throw new ProviderError("QUOTA_EXCEEDED");
    if (!response.ok) throw new ProviderError("UNAVAILABLE");
    // Bound decoded response size, including chunked responses.
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError("INVALID_DATA");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 3_000_000) throw new ProviderError("INVALID_DATA");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const payload: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new ProviderError("INVALID_DATA");
    return object(payload);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("UNAVAILABLE");
  }
}
