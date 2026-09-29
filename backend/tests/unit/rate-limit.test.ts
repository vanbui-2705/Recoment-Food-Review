import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { createRateLimitHook } from "../../src/common/security/rate-limit.js";

describe("authentication rate limit", () => {
  it("rejects the request after the configured limit and provides retry time", async () => {
    const hook = createRateLimitHook({ keyPrefix: "test", limit: 2, windowMs: 60_000 });
    const request = { ip: "127.0.0.1" } as FastifyRequest;
    const reply = { header: vi.fn() } as unknown as FastifyReply;

    await hook(request, reply);
    await hook(request, reply);
    await expect(hook(request, reply)).rejects.toMatchObject({
      statusCode: 429,
      code: "RATE_LIMITED",
    });

    expect(reply.header).toHaveBeenCalledWith("Retry-After", "60");
  });
});
