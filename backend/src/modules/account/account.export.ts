import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { reauthenticate } from "./account.service.js";

export async function prepareExport(
  prisma: PrismaClient,
  userId: string,
  password: string,
  sessionId: string | null = null,
) {
  const authenticated = await reauthenticate(prisma, userId, password),
    startedAt = new Date();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      emailVerifiedAt: true,
      createdAt: true,
      tasteProfile: true,
      discoverySettings: true,
      foodKnowledge: true,
      allergies: {
        select: {
          severity: true,
          notes: true,
          createdAt: true,
          allergen: { select: { code: true, name: true } },
        },
      },
      dietaryRestrictions: {
        select: {
          isMandatory: true,
          createdAt: true,
          dietaryRestriction: { select: { code: true, name: true } },
        },
      },
      cuisinePreferences: {
        select: { preferenceScore: true, cuisine: { select: { code: true, name: true } } },
      },
      dishPreferences: { select: { preference: true, dish: { select: { id: true, name: true } } } },
    } as const satisfies Prisma.UserSelect,
  });
  return async function* exportRows() {
    let bytes = 0,
      rows = 0;
    const encode = (value: unknown) => {
      const line = JSON.stringify(value) + "\n";
      bytes += Buffer.byteLength(line);
      rows++;
      if (bytes > 50000000 || Date.now() - startedAt.getTime() > 120000)
        throw new AppError(
          413,
          "EXPORT_TOO_LARGE",
          "Xuất dữ liệu vượt giới hạn phiên tải. Hãy liên hệ hỗ trợ để nhận dữ liệu đầy đủ.",
        );
      return line;
    };
    async function stillAuthorized() {
      if (
        !(await prisma.user.findFirst({
          where: {
            id: userId,
            authVersion: authenticated.authVersion,
            status: "ACTIVE",
            ...(sessionId
              ? {
                  refreshTokens: {
                    some: {
                      familyId: sessionId,
                      authVersion: authenticated.authVersion,
                      revokedAt: null,
                      expiresAt: { gt: new Date() },
                    },
                  },
                }
              : { legacyAccessDisabled: false }),
          },
          select: { id: true },
        }))
      )
        throw new AppError(401, "UNAUTHORIZED", "Phiên đã bị thu hồi trong khi xuất dữ liệu.");
    }
    await stillAuthorized();
    yield encode({ type: "export", format: "EatWise JSONL", version: 1, capturedAt: startedAt });
    yield encode({ type: "account", data: user });
    const collections = [
      {
        type: "meal-history",
        read: (after?: string) =>
          prisma.userInteraction.findMany({
            where: {
              userId,
              createdAt: { lte: startedAt },
              ...(after ? { id: { gt: after } } : {}),
            },
            orderBy: { id: "asc" },
            take: 200,
            select: {
              id: true,
              dishId: true,
              restaurantId: true,
              interactionType: true,
              rating: true,
              feedbackOfId: true,
              createdAt: true,
              dish: { select: { name: true } },
            },
          }),
      },
      {
        type: "recipe-history",
        read: (after?: string) =>
          prisma.recipeInteraction.findMany({
            where: {
              userId,
              createdAt: { lte: startedAt },
              ...(after ? { id: { gt: after } } : {}),
            },
            orderBy: { id: "asc" },
            take: 200,
            select: {
              id: true,
              source: true,
              recipeId: true,
              canonicalDishId: true,
              interactionType: true,
              rating: true,
              feedbackOfId: true,
              createdAt: true,
            },
          }),
      },
      {
        type: "recommendation",
        read: (after?: string) =>
          prisma.recommendationRequest.findMany({
            where: {
              userId,
              requestedAt: { lte: startedAt },
              ...(after ? { id: { gt: after } } : {}),
            },
            orderBy: { id: "asc" },
            take: 200,
            select: {
              id: true,
              requestedAt: true,
              status: true,
              budgetMax: true,
              maxDistanceMeters: true,
              rankingStatus: true,
            },
          }),
      },
      {
        type: "conversation",
        read: (after?: string) =>
          prisma.conversation.findMany({
            where: {
              userId,
              createdAt: { lte: startedAt },
              ...(after ? { id: { gt: after } } : {}),
            },
            orderBy: { id: "asc" },
            take: 200,
            select: { id: true, title: true, context: true, createdAt: true, updatedAt: true },
          }),
      },
      {
        type: "message",
        read: (after?: string) =>
          prisma.chatMessage.findMany({
            where: {
              conversation: { userId },
              createdAt: { lte: startedAt },
              ...(after ? { id: { gt: after } } : {}),
            },
            orderBy: { id: "asc" },
            take: 200,
            select: { id: true, conversationId: true, role: true, content: true, createdAt: true },
          }),
      },
      {
        type: "report",
        read: (after?: string) =>
          prisma.dataReport.findMany({
            where: {
              userId,
              createdAt: { lte: startedAt },
              ...(after ? { id: { gt: after } } : {}),
            },
            orderBy: { id: "asc" },
            take: 200,
            select: {
              id: true,
              targetKind: true,
              targetSource: true,
              targetId: true,
              reason: true,
              note: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
      },
    ];
    for (const collection of collections) {
      let after: string | undefined;
      while (true) {
        await stillAuthorized();
        const items = await collection.read(after);
        for (const item of items) yield encode({ type: collection.type, data: item });
        if (items.length < 200) break;
        after = items.at(-1)!.id;
      }
    }
    await stillAuthorized();
    yield encode({ type: "complete", rows, completedAt: new Date() });
  };
}
