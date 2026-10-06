import type { Prisma } from "../../generated/prisma/client.js";
// Callers construct bounded, non-sensitive metadata, never pass the request payload.
export async function audit(
  tx: Prisma.TransactionClient,
  actorId: string | null,
  action: string,
  targetId: string,
  metadata: Prisma.InputJsonObject = {},
) {
  return tx.adminAudit.create({ data: { actorId, action, targetId, metadata } });
}
