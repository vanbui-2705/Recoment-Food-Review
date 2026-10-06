import type { PrismaClient } from "../../generated/prisma/client.js";

export async function hasUnprocessedFoodKnowledge(prisma: PrismaClient, userId: string) {
  const note = await prisma.personalFoodKnowledge.findUnique({
    where: { userId },
    select: { revision: true, analyzedRevision: true },
  });
  return !!note && note.analyzedRevision < note.revision;
}
