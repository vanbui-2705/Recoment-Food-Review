import { describe, expect, it } from "vitest";
import {
  feedbackScores,
  applyFeedback,
} from "../../src/modules/recommendations/feedback.policy.js";
describe("bounded private soft feedback", () => {
  it("uses the latest rating and limits repeat likes/skips without affecting eligibility", () => {
    const now = new Date();
    const events = Array.from({ length: 100 }, (_, i) => ({
      key: "dish:one",
      id: String(i),
      type: "LIKED",
      rating: null,
      at: now,
    }));
    events.push({ key: "dish:one", id: "skip", type: "SKIPPED", rating: null, at: now });
    expect(feedbackScores(events).get("dish:one")).toBe(0);
    const ratings = [
      { key: "dish:one", id: "old", type: "RATED", rating: 1, at: new Date(+now - 1000) },
      { key: "dish:one", id: "new", type: "RATED", rating: 5, at: now },
    ];
    expect(feedbackScores(ratings).get("dish:one")).toBe(0.2);
    expect(applyFeedback(50, 0.2)).toBe(52);
    expect(applyFeedback(99, 100)).toBe(100);
    expect(applyFeedback(1, -100)).toBe(0);
  });
});
