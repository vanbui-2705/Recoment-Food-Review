import { describe, expect, it } from "vitest";
import { mergeChatContext, validateChatPlan } from "../../src/modules/chat/chat.policy.js";
describe("bounded discovery chat contract", () => {
  it("rejects arbitrary tools, foreign identity, free claims and excessive calls", () => {
    for (const value of [
      { reply: "RESULTS", tools: [{ name: "PAY", args: {} }] },
      { reply: "RESULTS", tools: [{ name: "RECOMMEND", args: { userId: "someone-else" } }] },
      { reply: "RESULTS", tools: [], text: "Safe for peanut allergy" },
      { reply: "COMING_SOON", tools: [{ name: "RECOMMEND", args: {} }] },
      {
        reply: "RESULTS",
        tools: Array.from({ length: 6 }, (_, i) => ({
          name: "RECIPES",
          args: { query: `food ${i}` },
        })),
      },
      { reply: "RESULTS", tools: [{ name: "RECIPES", args: { query: " " } }] },
    ])
      expect(() => validateChatPlan(value)).toThrow();
    expect(validateChatPlan({ reply: "COMING_SOON", tools: [] })).toEqual({
      reply: "COMING_SOON",
      tools: [],
    });
  });
  it("keeps structured multi-turn context and never accepts a half location", () => {
    expect(
      mergeChatContext({ budget: 50000, latitude: 10.7, longitude: 106.7 }, { budget: 60000 }),
    ).toEqual({ budget: 60000, latitude: 10.7, longitude: 106.7 });
    expect(() => mergeChatContext({}, { latitude: 10.7 })).toThrow();
    expect(() => mergeChatContext({}, { radius: 5000 })).toThrow();
  });
});
