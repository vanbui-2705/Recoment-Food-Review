import { expect, it, vi } from "vitest";
import { loadEmailConfig } from "../../src/modules/email/email.config.js";
import { encryptEmail, decryptEmail } from "../../src/modules/email/email.crypto.js";
import { createEmailProvider } from "../../src/modules/email/email.provider.js";
const config = loadEmailConfig({
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "test-key",
  EMAIL_FROM: "support@example.com",
  PUBLIC_APP_URL: "https://app.example.com",
  EMAIL_ALLOWED_ORIGINS: "https://app.example.com",
  EMAIL_OUTBOX_ENCRYPTION_KEY: "11".repeat(32),
});
it("disables blank email keys and validates the sender, encryption key and application origin", () => {
  expect(loadEmailConfig({}).configured).toBe(false);
  expect(() => loadEmailConfig({ RESEND_API_KEY: "key", EMAIL_FROM: "bad\r\nheader" })).toThrow(
    "EMAIL_FROM",
  );
  expect(() =>
    loadEmailConfig({
      RESEND_API_KEY: "key",
      EMAIL_FROM: config.from,
      EMAIL_OUTBOX_ENCRYPTION_KEY: config.keyHex,
      PUBLIC_APP_URL: "https://evil.example",
      EMAIL_ALLOWED_ORIGINS: "https://app.example.com",
    }),
  ).toThrow("EMAIL_ALLOWED_ORIGINS");
  expect(() =>
    loadEmailConfig({
      NODE_ENV: "production",
      RESEND_API_KEY: "key",
      EMAIL_FROM: config.from,
      EMAIL_OUTBOX_ENCRYPTION_KEY: config.keyHex,
      PUBLIC_APP_URL: "http://localhost:5173",
      EMAIL_ALLOWED_ORIGINS: "http://localhost:5173",
    }),
  ).toThrow("HTTPS");
});
it("encrypts email content with authenticated per-outbox identity and rejects tampering", () => {
  const plaintext = "private@example.com and one-time-token",
    cipher = encryptEmail(plaintext, config.keyHex, "outbox-a");
  expect(cipher).not.toContain("private");
  expect(cipher).not.toContain("one-time-token");
  expect(decryptEmail(cipher, config.keyHex, "outbox-a")).toBe(plaintext);
  expect(() => decryptEmail(cipher, config.keyHex, "outbox-b")).toThrow();
  expect(() => decryptEmail(cipher.slice(0, -2) + "xx", config.keyHex, "outbox-a")).toThrow();
});
it("uses the official HTTPS endpoint and stable idempotency without exposing provider bodies", async () => {
  const fetcher = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ id: "11111111-1111-4111-8111-111111111111" }), {
        status: 200,
      }),
    ),
  );
  const provider = createEmailProvider(config, fetcher),
    payload = {
      from: config.from,
      to: ["user@example.com"] as [string],
      subject: "EatWise",
      text: "private link",
    };
  await provider.send("outbox-a", payload);
  await provider.send("outbox-a", payload);
  expect(fetcher.mock.calls[0][0]).toBe("https://api.resend.com/emails");
  expect(fetcher.mock.calls[0][1].headers["Idempotency-Key"]).toBe("account-email/outbox-a");
  expect(fetcher.mock.calls[1][1].body).toBe(fetcher.mock.calls[0][1].body);
  fetcher.mockResolvedValue(new Response("raw-api-key-secret", { status: 429 }));
  await expect(provider.send("outbox-a", payload)).rejects.toMatchObject({
    code: "EMAIL_PROVIDER_BUSY",
    retryable: true,
  });
  fetcher.mockResolvedValue(new Response("secret", { status: 401 }));
  await expect(provider.send("outbox-a", payload)).rejects.toMatchObject({
    code: "EMAIL_PROVIDER_REJECTED",
    retryable: false,
  });
});
