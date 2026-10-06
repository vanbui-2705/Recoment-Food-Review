import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma, TasteAnalysisJob } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { AiError, type StructuredAiProvider } from "../ai/ai.provider.js";
import type { AiConfig } from "../ai/ai.config.js";
import { normalizeFoodText } from "../food/food.schema.js";
import {
  AnalysisResultSchema,
  validateAnalysis,
  TASTE_ANALYSIS_INSTRUCTION,
  type AnalysisResult,
  type AnalysisCatalogs,
} from "./taste-analysis.schema.js";

type Database = Prisma.TransactionClient;
export async function enqueueTasteAnalysis(tx: Database, userId: string, revision: number) {
  await tx.tasteAnalysisJob.createMany({
    data: [{ userId, sourceRevision: revision }],
    skipDuplicates: true,
  });
}
const conflict = () =>
  new AppError(409, "ANALYSIS_REVISION_CONFLICT", "Mô tả đã thay đổi. Hãy phân tích bản mới nhất.");
export function publicAnalysis(job: TasteAnalysisJob | null, configured: boolean) {
  return job
    ? {
        id: job.id,
        sourceRevision: job.sourceRevision,
        status: job.status,
        result: job.result,
        errorCode: job.errorCode,
        attempt: job.attempt,
        updatedAt: job.updatedAt,
        configured,
      }
    : null;
}
export function createTasteAnalysisService(
  prisma: PrismaClient,
  config: AiConfig,
  provider: StructuredAiProvider,
) {
  const catalogs = async (db: Database | PrismaClient): Promise<AnalysisCatalogs> => ({
    allergens: await db.allergen.findMany({ select: { id: true, code: true, name: true } }),
    diets: await db.dietaryRestriction.findMany({ select: { id: true, code: true, name: true } }),
    cuisines: await db.cuisine.findMany({ select: { id: true, code: true, name: true } }),
  });
  const latest = async (userId: string) => {
    const note = await prisma.personalFoodKnowledge.findUnique({ where: { userId } });
    return note
      ? prisma.tasteAnalysisJob.findUnique({
          where: {
            userId_sourceRevision_schemaVersion: {
              userId,
              sourceRevision: note.revision,
              schemaVersion: 1,
            },
          },
        })
      : null;
  };
  const apply = async (
    tx: Database,
    userId: string,
    result: AnalysisResult,
    known: AnalysisCatalogs,
  ) => {
    const current = await tx.tasteProfile.findUnique({ where: { userId } });
    const values: Record<string, string | number> = {};
    for (const f of result.fields)
      values[f.field] = ["areaLabel", "mealPeriod"].includes(f.field) ? f.value : Number(f.value);
    const base = {
      spicyLevel: current?.spicyLevel ?? 30,
      sweetLevel: current?.sweetLevel ?? 45,
      sourLevel: current?.sourLevel ?? 30,
      saltyLevel: current?.saltyLevel ?? 40,
      budgetMin: current?.budgetMin ?? 0,
      budgetMax: current?.budgetMax ?? 70000,
      maxDistanceMeters: current?.maxDistanceMeters ?? 3500,
      ...values,
    };
    if (Number(base.budgetMin) > Number(base.budgetMax)) throw new AiError("AI_INVALID_OUTPUT");
    // Existing coordinates and omitted fields remain unchanged. Default values are not extracted facts.
    const profileData = { ...base, onboardingCompleted: true } as Prisma.TasteProfileUpdateInput;
    await tx.tasteProfile.upsert({
      where: { userId },
      update: profileData,
      create: {
        ...base,
        userId,
        onboardingCompleted: true,
      } as Prisma.TasteProfileUncheckedCreateInput,
    });
    for (const fact of result.allergies) {
      const allergenId = known.allergens.find((k) => k.code === fact.code)!.id;
      await tx.userAllergy.upsert({
        where: { userId_allergenId: { userId, allergenId } },
        update: {},
        create: { userId, allergenId, severity: "UNKNOWN", notes: fact.evidence },
      });
    }
    for (const fact of result.diets) {
      const dietaryRestrictionId = known.diets.find((k) => k.code === fact.code)!.id;
      await tx.userDietaryRestriction.upsert({
        where: { userId_dietaryRestrictionId: { userId, dietaryRestrictionId } },
        update: { isMandatory: true },
        create: { userId, dietaryRestrictionId, isMandatory: true },
      });
    }
    for (const fact of result.cuisines) {
      const cuisineId = known.cuisines.find((k) => k.code === fact.code)!.id;
      await tx.userCuisinePreference.upsert({
        where: { userId_cuisineId: { userId, cuisineId } },
        update: { preferenceScore: fact.preferenceScore },
        create: { userId, cuisineId, preferenceScore: fact.preferenceScore },
      });
    }
    for (const fact of result.dishes) {
      const matches = await tx.dish.findMany({
        where: {
          OR: [
            { name: { equals: fact.name, mode: "insensitive" } },
            { aliases: { some: { normalizedAlias: normalizeFoodText(fact.name) } } },
          ],
        },
        select: { id: true },
        take: 2,
      });
      if (matches.length !== 1) continue; // Unknown/ambiguous dish names remain in extracted knowledge, not guessed catalog rows.
      const dishId = matches[0]!.id;
      await tx.userDishPreference.upsert({
        where: { userId_dishId: { userId, dishId } },
        update: { preference: fact.preference },
        create: { userId, dishId, preference: fact.preference },
      });
    }
  };
  const lockNote = (tx: Database, userId: string) =>
    tx.$queryRaw`SELECT user_id FROM personal_food_knowledge WHERE user_id = ${userId}::uuid FOR UPDATE`;
  return {
    configured: provider.configured,
    latest,
    async start(userId: string) {
      if (!provider.configured)
        throw new AppError(
          503,
          "AI_NOT_CONFIGURED",
          "AI chưa được cấu hình. Mô tả của bạn vẫn được lưu.",
        );
      return prisma.$transaction(async (tx) => {
        await lockNote(tx, userId);
        const note = await tx.personalFoodKnowledge.findUnique({ where: { userId } });
        if (!note) throw new AppError(400, "DESCRIPTION_REQUIRED", "Hãy lưu mô tả khẩu vị trước.");
        await enqueueTasteAnalysis(tx, userId, note.revision);
        const where = { userId, sourceRevision: note.revision, schemaVersion: 1 };
        await tx.tasteAnalysisJob.updateMany({
          where: { ...where, status: "FAILED" },
          data: {
            status: "QUEUED",
            attempt: 0,
            availableAt: new Date(),
            errorCode: null,
            leaseToken: null,
            leaseUntil: null,
          },
        });
        return tx.tasteAnalysisJob.findUniqueOrThrow({
          where: { userId_sourceRevision_schemaVersion: where },
        });
      });
    },
    async get(userId: string, id: string) {
      const job = await prisma.tasteAnalysisJob.findFirst({ where: { userId, id } });
      if (!job) throw new AppError(404, "ANALYSIS_NOT_FOUND", "Không tìm thấy phân tích.");
      return job;
    },
    async confirm(userId: string, id: string, revision: number) {
      return prisma.$transaction(async (tx) => {
        await lockNote(tx, userId);
        await tx.$queryRaw`SELECT id FROM taste_analysis_jobs WHERE id = ${id}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
        const job = await tx.tasteAnalysisJob.findFirst({ where: { id, userId } });
        if (!job) throw new AppError(404, "ANALYSIS_NOT_FOUND", "Không tìm thấy phân tích.");
        const note = await tx.personalFoodKnowledge.findUniqueOrThrow({ where: { userId } });
        if (job.sourceRevision !== revision || note.revision !== revision) throw conflict();
        if (job.status === "APPLIED") return job;
        if (job.status !== "NEEDS_REVIEW")
          throw new AppError(409, "ANALYSIS_NOT_REVIEWABLE", "Phân tích chưa sẵn sàng xác nhận.");
        const known = await catalogs(tx);
        const result = validateAnalysis(job.result, note.description, known);
        if (result.questions.length)
          throw new AppError(
            400,
            "ANALYSIS_NEEDS_CLARIFICATION",
            "Hãy sửa mô tả để làm rõ các câu hỏi trước.",
          );
        await apply(tx, userId, result, known);
        await tx.personalFoodKnowledge.update({
          where: { userId },
          data: { analyzedRevision: revision },
        });
        return tx.tasteAnalysisJob.update({
          where: { id },
          data: { status: "APPLIED", errorCode: null },
        });
      });
    },
    async tick(now = new Date(), scopeUserId?: string) {
      if (!provider.configured) return false;
      await prisma.tasteAnalysisJob.updateMany({
        where: {
          ...(scopeUserId ? { userId: scopeUserId } : {}),
          status: "RUNNING",
          leaseUntil: { lte: now },
          attempt: { gte: config.maxAttempts },
        },
        data: {
          status: "FAILED",
          errorCode: "AI_WORKER_INTERRUPTED",
          leaseUntil: null,
          leaseToken: null,
        },
      });
      const token = randomUUID();
      const leaseUntil = new Date(now.getTime() + config.leaseSeconds * 1000);
      const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
        UPDATE taste_analysis_jobs AS j SET status = 'RUNNING', attempt = attempt + 1, lease_token = ${token}::uuid, lease_until = ${leaseUntil}, updated_at = ${now}
        WHERE j.id = (SELECT q.id FROM taste_analysis_jobs q JOIN users u ON u.id = q.user_id
          WHERE u.status = 'ACTIVE' AND q.attempt < ${config.maxAttempts}
            AND (${scopeUserId ?? null}::uuid IS NULL OR q.user_id = ${scopeUserId ?? null}::uuid)
            AND ((q.status = 'QUEUED' AND q.available_at <= ${now}) OR (q.status = 'RUNNING' AND q.lease_until <= ${now}))
          ORDER BY q.available_at, q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1)
        RETURNING j.id`;
      if (!claimed[0]) return false;
      const id = claimed[0].id;
      const job = await prisma.tasteAnalysisJob.findUniqueOrThrow({ where: { id } });
      try {
        const note = await prisma.personalFoodKnowledge.findUnique({
          where: { userId: job.userId },
        });
        if (!note || note.revision !== job.sourceRevision) {
          await prisma.tasteAnalysisJob.updateMany({
            where: { id, leaseToken: token },
            data: { status: "SUPERSEDED", leaseUntil: null, leaseToken: null },
          });
          return true;
        }
        const day = now.toISOString().slice(0, 10);
        const reservation = await prisma.$queryRaw<
          Array<{ requests: number }>
        >`INSERT INTO ai_request_usage(day, requests) VALUES (${day}, 1) ON CONFLICT(day) DO UPDATE SET requests = ai_request_usage.requests + 1 WHERE ai_request_usage.requests < ${config.dailyRequests} RETURNING requests`;
        if (!reservation.length) throw new AiError("AI_QUOTA_EXCEEDED");
        const known = await catalogs(prisma);
        const result = validateAnalysis(
          await provider.generate(
            TASTE_ANALYSIS_INSTRUCTION,
            { description: note.description, catalogs: known },
            AnalysisResultSchema,
          ),
          note.description,
          known,
        );
        await prisma.$transaction(async (tx) => {
          await lockNote(tx, job.userId);
          await tx.$queryRaw`SELECT id FROM taste_analysis_jobs WHERE id = ${id}::uuid FOR UPDATE`;
          const currentJob = await tx.tasteAnalysisJob.findUniqueOrThrow({ where: { id } });
          if (
            currentJob.status !== "RUNNING" ||
            currentJob.leaseToken !== token ||
            !currentJob.leaseUntil ||
            currentJob.leaseUntil <= new Date()
          )
            return;
          const current = await tx.personalFoodKnowledge.findUnique({
            where: { userId: job.userId },
          });
          const user = await tx.user.findUnique({
            where: { id: job.userId },
            select: { status: true },
          });
          if (!current || current.revision !== job.sourceRevision || user?.status !== "ACTIVE") {
            await tx.tasteAnalysisJob.update({
              where: { id },
              data: { status: "SUPERSEDED", leaseUntil: null, leaseToken: null },
            });
            return;
          }
          const existingAllergies = await tx.userAllergy.findMany({
            where: { userId: job.userId },
            include: { allergen: true },
          });
          const existingDiets = await tx.userDietaryRestriction.findMany({
            where: { userId: job.userId },
            include: { dietaryRestriction: true },
          });
          const safetyMention =
            /\b(di ung|allerg\w*|an chay|vegan|halal|kieng|khong an|khong duoc an)\b/.test(
              normalizeFoodText(current.description),
            );
          if (
            safetyMention &&
            !result.allergies.length &&
            !result.diets.length &&
            !result.questions.length
          ) {
            result.questions.push(
              "Mô tả có ràng buộc ăn uống cần làm rõ. Hãy ghi cụ thể tên dị nguyên hoặc chế độ ăn.",
            );
          }
          const review =
            safetyMention ||
            result.questions.length > 0 ||
            result.allergies.some(
              (f) => !existingAllergies.some((a) => a.allergen.code === f.code),
            ) ||
            result.diets.some(
              (f) =>
                !existingDiets.some((d) => d.dietaryRestriction.code === f.code && d.isMandatory),
            );
          if (!review) {
            await apply(tx, job.userId, result, await catalogs(tx));
            await tx.personalFoodKnowledge.update({
              where: { userId: job.userId },
              data: { analyzedRevision: job.sourceRevision },
            });
          }
          await tx.tasteAnalysisJob.update({
            where: { id },
            data: {
              status: review ? "NEEDS_REVIEW" : "APPLIED",
              result: result as Prisma.InputJsonValue,
              model: provider.model,
              errorCode: null,
              leaseUntil: null,
              leaseToken: null,
            },
          });
        });
      } catch (error) {
        const code = error instanceof AiError ? error.code : "AI_UNAVAILABLE";
        const terminal =
          job.attempt >= config.maxAttempts ||
          ["AI_INVALID_OUTPUT", "AI_NOT_CONFIGURED"].includes(code);
        await prisma.tasteAnalysisJob.updateMany({
          where: { id, status: "RUNNING", leaseToken: token },
          data: {
            status: terminal ? "FAILED" : "QUEUED",
            errorCode: code,
            availableAt: new Date(Date.now() + 1000 * 2 ** job.attempt),
            leaseUntil: null,
            leaseToken: null,
          },
        });
      }
      return true;
    },
  };
}
