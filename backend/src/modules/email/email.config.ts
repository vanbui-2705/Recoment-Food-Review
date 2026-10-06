export function loadEmailConfig(env = process.env) {
  const provider = env.EMAIL_PROVIDER?.trim() || "resend";
  if (!["resend", "disabled"].includes(provider)) throw new Error("Invalid EMAIL_PROVIDER");
  const apiKey = env.RESEND_API_KEY?.trim() || "";
  const from = env.EMAIL_FROM?.trim() || "";
  const keyHex = env.EMAIL_OUTBOX_ENCRYPTION_KEY?.trim() || "";
  const appUrl = env.PUBLIC_APP_URL?.trim() || "";
  const configured = provider === "resend" && !!apiKey;
  const timeoutMs = Number(env.EMAIL_TIMEOUT_MS?.trim() || 10000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 20000)
    throw new Error("Invalid EMAIL_TIMEOUT_MS");
  if (configured) {
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)) throw new Error("Invalid EMAIL_FROM");
    if (!/^[a-f0-9]{64}$/i.test(keyHex)) throw new Error("Invalid EMAIL_OUTBOX_ENCRYPTION_KEY");
    const allowed = (env.EMAIL_ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    let url: URL;
    try {
      url = new URL(appUrl);
    } catch {
      throw new Error("Invalid PUBLIC_APP_URL");
    }
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      !allowed.includes(url.origin)
    )
      throw new Error("PUBLIC_APP_URL must match EMAIL_ALLOWED_ORIGINS");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.protocol !== "https:" &&
      !(env.NODE_ENV !== "production" && url.protocol === "http:" && local)
    )
      throw new Error("PUBLIC_APP_URL requires HTTPS");
  }
  return { configured, apiKey, from, keyHex, appUrl, timeoutMs };
}
export type EmailConfig = ReturnType<typeof loadEmailConfig>;
