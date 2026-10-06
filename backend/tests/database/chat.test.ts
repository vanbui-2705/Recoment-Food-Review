import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createChatService, type ChatDispatcher } from "../../src/modules/chat/chat.service.js";
import type { StructuredAiProvider } from "../../src/modules/ai/ai.provider.js";
describe("durable private discovery chat", () => {
  const app = buildApp({ logger: false }),
    suffix = randomUUID();
  const ids: string[] = [];
  let headers: { authorization: string }, other: { authorization: string };
  let output: unknown = { reply: "HELP", tools: [] };
  const provider: StructuredAiProvider = {
    configured: true,
    model: "test-only",
    generate: async () => output,
  };
  const calls: string[] = [];
  const dispatch: ChatDispatcher = async (userId) => {
    calls.push(userId);
    return { status: "SUCCESS", references: [{ kind: "RECIPE", source: "themealdb", id: "1" }] };
  };
  const config = { LLM_DAILY_REQUEST_LIMIT: "100000" };
  let service: ReturnType<typeof createChatService>;
  beforeAll(async () => {
    await app.ready();
    service = createChatService(app.prisma, config, provider, dispatch);
    for (const prefix of ["owner", "other"]) {
      const email = `${prefix}-chat-${suffix}@test.local`,
        password = "chat-test-password";
      const registered = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password, displayName: "Chat Test" },
      });
      expect(registered.statusCode).toBe(201);
      ids.push(registered.json().data.user.id);
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password },
      });
      if (prefix === "owner")
        headers = { authorization: `Bearer ${login.json().data.accessToken}` };
      else other = { authorization: `Bearer ${login.json().data.accessToken}` };
    }
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });
  it("row locks serialize same-conversation submits without interfering with other owners", async () => {
    const first = await service.create(ids[0]!);
    const second = await service.create(ids[1]!);
    const key = randomUUID();
    const results = await Promise.all([
      service.submit(ids[0]!, first.id, "Same message", key, {}),
      service.submit(ids[0]!, first.id, "Same message", key, {}),
      service.submit(ids[1]!, second.id, "Independent message", randomUUID(), {}),
    ]);
    expect(results[0]!.id).toBe(results[1]!.id);
    expect(
      results
        .slice(0, 2)
        .map((row) => row.replay)
        .sort(),
    ).toEqual([false, true]);
    expect(await app.prisma.chatRun.count({ where: { conversationId: first.id } })).toBe(1);
    await service.tick(ids[0]);
    const competing = await Promise.allSettled(
      [1, 2].map(() => service.submit(ids[0]!, first.id, "Another message", randomUUID(), {})),
    );
    expect(competing.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(competing.find((row) => row.status === "rejected")).toMatchObject({
      reason: { code: "CHAT_RUN_ACTIVE" },
    });
    await service.remove(ids[0]!, first.id);
    await service.remove(ids[1]!, second.id);
  });
  it("rejects foreign conversation, replay conflict and double submit; resumes sequenced events", async () => {
    const conversation = await service.create(ids[0]!);
    const key = randomUUID();
    const run = await service.submit(ids[0]!, conversation.id, "hello", key, {});
    expect((await service.submit(ids[0]!, conversation.id, "hello", key, {})).id).toBe(run.id);
    await expect(
      service.submit(ids[0]!, conversation.id, "changed", key, {}),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(
      service.submit(ids[0]!, conversation.id, "next", randomUUID(), {}),
    ).rejects.toMatchObject({ code: "CHAT_RUN_ACTIVE" });
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/conversations/${conversation.id}`,
          headers: other,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "GET", url: `/chat-runs/${run.id}/events`, headers: other }))
        .statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "POST", url: `/chat-runs/${run.id}/cancel`, headers: other }))
        .statusCode,
    ).toBe(404);
    await service.tick(ids[0]);
    const events = await service.events(ids[0]!, run.id, 1);
    expect(events.events.map((e) => e.seq)).toEqual([2, 3]);
    expect(events.status).toBe("COMPLETED");
    expect((await service.detail(ids[0]!, conversation.id)).messages).toHaveLength(2);
    expect(
      (await app.inject({ method: "GET", url: `/chat-runs/${run.id}/stream?after=1`, headers }))
        .body,
    ).toContain("id: 2");
    await service.remove(ids[0]!, conversation.id);
    expect(await app.prisma.chatEvent.count({ where: { runId: run.id } })).toBe(0);
  });
  it("asks for missing structured context, carries context across turns and injects owner tools", async () => {
    const conversation = await service.create(ids[0]!);
    output = { reply: "RESULTS", tools: [{ name: "RECOMMEND", args: {} }] };
    const first = await service.submit(ids[0]!, conversation.id, "Recommend", randomUUID(), {});
    await service.tick(ids[0]);
    expect(
      (await service.events(ids[0]!, first.id, 0)).events.find((e) => e.type === "RESULT")?.payload,
    ).toMatchObject({ replyCode: "ASK_BUDGET" });
    const second = await service.submit(ids[0]!, conversation.id, "Near me", randomUUID(), {
      budget: 50000,
    });
    await service.tick(ids[0]);
    expect(
      (await service.events(ids[0]!, second.id, 0)).events.find((e) => e.type === "RESULT")
        ?.payload,
    ).toMatchObject({ replyCode: "ASK_LOCATION" });
    const third = await service.submit(ids[0]!, conversation.id, "Here", randomUUID(), {
      latitude: 10.7,
      longitude: 106.7,
    });
    await service.tick(ids[0]);
    expect(calls.at(-1)).toBe(ids[0]);
    expect((await service.detail(ids[0]!, conversation.id)).conversation.context).toMatchObject({
      budget: 50000,
      latitude: 10.7,
    });
    expect(JSON.stringify((await service.events(ids[0]!, third.id, 0)).events)).not.toContain(
      "photo",
    );
  });
  it("rejects injected tools, recovers expired lease and exhausts bounded crash attempts", async () => {
    const conversation = await service.create(ids[0]!);
    output = { reply: "RESULTS", tools: [{ name: "RECOMMEND", args: { userId: ids[1] } }] };
    const bad = await service.submit(ids[0]!, conversation.id, "injection", randomUUID(), {});
    const count = calls.length;
    await service.tick(ids[0]);
    expect(calls).toHaveLength(count);
    expect((await service.events(ids[0]!, bad.id, 0)).status).toBe("FAILED");
    output = { reply: "COMING_SOON", tools: [] };
    const recovery = await service.submit(
      ids[0]!,
      conversation.id,
      "order and pay",
      randomUUID(),
      {},
    );
    await app.prisma.chatRun.update({
      where: { id: recovery.id },
      data: {
        status: "RUNNING",
        attempts: 1,
        leaseToken: randomUUID(),
        leaseUntil: new Date(Date.now() - 1000),
      },
    });
    await service.tick(ids[0]);
    expect((await service.events(ids[0]!, recovery.id, 0)).status).toBe("COMPLETED");
    const exhausted = await service.submit(ids[0]!, conversation.id, "retry", randomUUID(), {});
    await app.prisma.chatRun.update({
      where: { id: exhausted.id },
      data: {
        status: "RUNNING",
        attempts: 3,
        leaseToken: randomUUID(),
        leaseUntil: new Date(Date.now() - 1000),
      },
    });
    await service.tick(ids[0]);
    expect((await service.events(ids[0]!, exhausted.id, 0)).status).toBe("FAILED");
  });
  it("cancels in-flight work and prevents late assistant output", async () => {
    let started!: () => void, release!: (value: unknown) => void;
    const start = new Promise<void>((resolve) => {
      started = resolve;
    });
    const blocked = {
      ...provider,
      generate: async () => {
        started();
        return await new Promise((resolve) => {
          release = resolve;
        });
      },
    };
    const worker = createChatService(app.prisma, config, blocked, dispatch);
    const conversation = await worker.create(ids[0]!);
    const run = await worker.submit(ids[0]!, conversation.id, "wait", randomUUID(), {});
    const processing = worker.tick(ids[0]);
    await start;
    await worker.cancel(ids[0]!, run.id);
    release({ reply: "HELP", tools: [] });
    await processing;
    expect((await worker.events(ids[0]!, run.id, 0)).status).toBe("CANCELLED");
    expect((await worker.detail(ids[0]!, conversation.id)).messages).toHaveLength(1);
  });
  it("shows unavailable AI honestly and requires explicit delete confirmation", async () => {
    const conversation = await service.create(ids[0]!);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/conversations/${conversation.id}/messages`,
          headers,
          payload: { text: "hello", idempotencyKey: randomUUID() },
        })
      ).statusCode,
    ).toBe(503);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/conversations/${conversation.id}`,
          headers,
          payload: { confirm: false },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/conversations/${conversation.id}`,
          headers: other,
          payload: { confirm: true },
        })
      ).statusCode,
    ).toBe(404);
  });
  it("enforces the total deadline even when a provider never responds", async () => {
    const hanging = { ...provider, generate: async () => await new Promise<unknown>(() => {}) };
    const bounded = createChatService(
      app.prisma,
      { ...config, CHAT_RUN_TIMEOUT_MS: "1000" },
      hanging,
      dispatch,
    );
    const conversation = await bounded.create(ids[0]!);
    const run = await bounded.submit(ids[0]!, conversation.id, "timeout", randomUUID(), {});
    await bounded.tick(ids[0]);
    const events = await bounded.events(ids[0]!, run.id, 0);
    expect(events.status).toBe("FAILED");
    expect(events.events.find((event) => event.type === "ERROR")?.payload).toMatchObject({
      code: "CHAT_DEADLINE",
    });
  });
});
