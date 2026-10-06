// Deliberately omit messages/stacks/query arguments: database and provider errors may contain secrets.
export function safeError(error: unknown) {
  const value = error as { name?: unknown; code?: unknown } | null;
  const name = [
    "Error",
    "AppError",
    "PrismaClientKnownRequestError",
    "PrismaClientUnknownRequestError",
    "DriverAdapterError",
  ].includes(String(value?.name))
    ? String(value?.name)
    : "UnhandledError";
  const code =
    typeof value?.code === "string" && /^[A-Z][A-Z0-9_]{0,30}$/.test(value.code)
      ? value.code
      : "UNEXPECTED_ERROR";
  return { type: name, code, message: "Internal error", stack: "" };
}
export function safeRequest(request: { id?: string; method?: string; url?: string }) {
  return {
    id: request.id,
    method: request.method ?? "UNKNOWN",
    url: request.url?.split("?")[0] ?? "/",
  };
}
