import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { AppError } from "../../common/errors/app-error.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { enqueueTasteAnalysis } from "../taste-analysis/taste-analysis.service.js";

const publicNote = (
  note: { description: string; revision: number; analyzedRevision: number; updatedAt: Date } | null,
) =>
  note
    ? {
        description: note.description,
        revision: note.revision,
        updatedAt: note.updatedAt,
        analysisStatus: note.analyzedRevision === note.revision ? "ANALYZED" : "NOT_ANALYZED",
      }
    : null;

export const personalFoodKnowledgeRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", app.authenticate);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  app.get("/users/me/food-knowledge", async (req) => ({
    data: {
      knowledge: publicNote(
        await app.prisma.personalFoodKnowledge.findUnique({ where: { userId: req.authUser!.id } }),
      ),
    },
  }));
  app.put(
    "/users/me/food-knowledge",
    {
      preHandler: createRateLimitHook({
        keyPrefix: "food-knowledge-write",
        limit: 20,
        windowMs: 60000,
      }),
      schema: {
        body: Type.Object(
          {
            description: Type.String({ minLength: 1, maxLength: 6000 }),
            expectedRevision: Type.Integer({ minimum: 0, maximum: 2147483646 }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const description = req.body.description.trim();
      if (!description)
        throw new AppError(400, "EMPTY_TASTE_DESCRIPTION", "Hãy nhập mô tả khẩu vị của bạn");
      const userId = req.authUser!.id;
      const conflict = () =>
        new AppError(
          409,
          "FOOD_KNOWLEDGE_CONFLICT",
          "Mô tả đã được cập nhật ở nơi khác. Tải lại bản đã lưu trước khi sửa tiếp.",
        );
      const note = await app.prisma
        .$transaction(async (tx) => {
          // Serialize saves with analysis apply/confirmation before taking a job lock.
          await tx.$queryRaw`SELECT user_id FROM personal_food_knowledge WHERE user_id = ${userId}::uuid FOR UPDATE`;
          const current = await tx.personalFoodKnowledge.findUnique({ where: { userId } });
          if ((current?.revision ?? 0) !== req.body.expectedRevision) {
            if (
              current &&
              current.revision === req.body.expectedRevision + 1 &&
              current.description === description
            ) {
              await enqueueTasteAnalysis(tx, userId, current.revision);
              return current;
            }
            throw conflict();
          }
          if (current?.description === description) {
            await enqueueTasteAnalysis(tx, userId, current.revision);
            return current;
          }
          if (!current) {
            const created = await tx.personalFoodKnowledge.create({
              data: { userId, description },
            });
            await enqueueTasteAnalysis(tx, userId, created.revision);
            return created;
          }
          const result = await tx.personalFoodKnowledge.updateMany({
            where: { userId, revision: req.body.expectedRevision },
            data: { description, revision: { increment: 1 } },
          });
          if (!result.count) throw conflict();
          const updated = await tx.personalFoodKnowledge.findUniqueOrThrow({ where: { userId } });
          await enqueueTasteAnalysis(tx, userId, updated.revision);
          return updated;
        })
        .catch((error: unknown) => {
          if (error && typeof error === "object" && "code" in error && error.code === "P2002")
            throw conflict();
          throw error;
        });
      return { data: { knowledge: publicNote(note) } };
    },
  );
};
