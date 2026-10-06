export type SafetyFact = {
  kind: string;
  code: string;
  claim: string;
  status: string;
  observedAt: Date;
  expiresAt: Date;
};
export type SafetyConstraints = { allergies: string[]; diets: string[] };
export function safetyDecision(
  facts: SafetyFact[],
  constraints: SafetyConstraints,
  now = new Date(),
  offerObservedAt = new Date(0),
) {
  const reasons: string[] = [];
  const need = (kind: string, code: string, requiredClaim: string) => {
    const current = facts.filter(
      (f) =>
        f.kind === kind &&
        f.code === code &&
        f.status !== "REVOKED" &&
        f.expiresAt > now &&
        f.observedAt >= offerObservedAt &&
        +f.observedAt <= +now + 300000,
    );
    const approved = current.filter((f) => f.status === "APPROVED");
    if (
      current.some((f) => f.status === "PENDING") ||
      !approved.length ||
      approved.some((f) => f.claim !== requiredClaim)
    )
      reasons.push(`${kind}:${code}:UNCONFIRMED`);
  };
  for (const code of constraints.allergies) {
    need("ALLERGEN", code, "ABSENT");
    need("CROSS_CONTACT", code, "ABSENT");
  }
  for (const code of constraints.diets) need("DIET", code, "PRESENT");
  return { eligible: reasons.length === 0, reasons };
}
