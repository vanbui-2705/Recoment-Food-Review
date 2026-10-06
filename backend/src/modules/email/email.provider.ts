import type { EmailConfig } from "./email.config.js";
export type EmailPayload = { from: string; to: [string]; subject: string; text: string };
export class EmailProviderError extends Error {
  constructor(
    public code: string,
    public retryable: boolean,
  ) {
    super(code);
  }
}
export interface EmailProvider {
  configured: boolean;
  send(id: string, payload: EmailPayload): Promise<string>;
}
// Official REST /emails and Idempotency-Key: https://resend.com/docs/api-reference/emails/send-email
export function createEmailProvider(
  config: EmailConfig,
  fetcher: typeof fetch = fetch,
): EmailProvider {
  return {
    configured: config.configured,
    async send(id, payload) {
      if (!config.configured) throw new EmailProviderError("EMAIL_NOT_CONFIGURED", false);
      try {
        const response = await fetcher("https://api.resend.com/emails", {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(config.timeoutMs),
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `account-email/${id}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok)
          throw new EmailProviderError(
            response.status === 429 || response.status >= 500
              ? "EMAIL_PROVIDER_BUSY"
              : "EMAIL_PROVIDER_REJECTED",
            response.status === 429 || response.status >= 500,
          );
        const reader = response.body?.getReader();
        if (!reader) throw new EmailProviderError("EMAIL_INVALID_RESPONSE", true);
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            size += next.value.length;
            if (size > 10000) throw new EmailProviderError("EMAIL_INVALID_RESPONSE", true);
            chunks.push(next.value);
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        const data = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { id?: unknown };
        if (typeof data.id !== "string" || !/^[a-f0-9-]{36}$/i.test(data.id))
          throw new EmailProviderError("EMAIL_INVALID_RESPONSE", true);
        return data.id;
      } catch (error) {
        if (error instanceof EmailProviderError) throw error;
        throw new EmailProviderError("EMAIL_PROVIDER_UNAVAILABLE", true);
      }
    },
  };
}
