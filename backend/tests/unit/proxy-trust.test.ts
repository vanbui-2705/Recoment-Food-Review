import { afterEach, expect, it, vi } from "vitest";
import { trustedProxyIps } from "../../src/config/env.js";
import { buildApp } from "../../src/app.js";
afterEach(() => vi.unstubAllEnvs());
it("rejects wildcard, hostnames, hop counts and excessive proxy lists", () => {
  expect(trustedProxyIps({})).toBe(false);
  for (const value of [
    "true",
    "1",
    "0.0.0.0",
    "::",
    "0.0.0.0/0",
    "proxy.local",
    Array(9).fill("127.0.0.1").join(","),
  ])
    expect(() => trustedProxyIps({ TRUST_PROXY_IPS: value })).toThrow();
  expect(trustedProxyIps({ TRUST_PROXY_IPS: "172.30.5.20, 172.30.5.20" })).toEqual(["172.30.5.20"]);
});
it("ignores spoofed forwarded IPs from untrusted peers and accepts only the configured proxy", async () => {
  vi.stubEnv("TRUST_PROXY_IPS", "172.30.5.20");
  const app = buildApp({ logger: false, database: false });
  app.get("/test-client-ip", (req) => ({ ip: req.ip }));
  try {
    expect(
      (
        await app.inject({
          url: "/test-client-ip",
          remoteAddress: "203.0.113.8",
          headers: { "x-forwarded-for": "198.51.100.5" },
        })
      ).json().ip,
    ).toBe("203.0.113.8");
    expect(
      (
        await app.inject({
          url: "/test-client-ip",
          remoteAddress: "172.30.5.20",
          headers: { "x-forwarded-for": "198.51.100.5" },
        })
      ).json().ip,
    ).toBe("198.51.100.5");
  } finally {
    await app.close();
  }
});
