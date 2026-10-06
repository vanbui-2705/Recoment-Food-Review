type Feedback = { key: string; type: string; rating: number | null; at: Date; id: string };
// Only the latest signal of each type counts. Repeated requests must not let
// one rating or skip overwhelm the bounded soft preference adjustment.
export function feedbackScores(events: Feedback[]) {
  const latest = new Set<string>(),
    scores = new Map<string, number>();
  for (const event of [...events].sort((a, b) => +b.at - +a.at || b.id.localeCompare(a.id))) {
    const typeKey = `${event.key}:${event.type}`;
    if (latest.has(typeKey)) continue;
    latest.add(typeKey);
    const delta =
      event.type === "LIKED"
        ? 0.2
        : event.type === "SKIPPED"
          ? -0.2
          : event.type === "RATED" &&
              event.rating !== null &&
              Number.isInteger(event.rating) &&
              event.rating >= 1 &&
              event.rating <= 5
            ? (event.rating - 3) / 10
            : 0;
    scores.set(event.key, (scores.get(event.key) ?? 0) + delta);
  }
  return new Map([...scores].map(([key, value]) => [key, Math.max(-0.3, Math.min(0.3, value))]));
}
export function applyFeedback(score: number, adjustment: number) {
  return (
    Math.round(
      Math.max(0, Math.min(100, score + Math.max(-0.3, Math.min(0.3, adjustment)) * 10)) * 100,
    ) / 100
  );
}
