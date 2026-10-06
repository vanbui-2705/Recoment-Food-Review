import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { AppError } from "../../common/errors/app-error.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { securityNamespace } from "../../common/security/shared-quota.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
import { providerRequestLimit } from "../discovery/provider.quota.js";
import { loadAiConfig } from "../ai/ai.config.js";
import { loadEmailConfig } from "../email/email.config.js";
import { audit } from "./admin.audit.js";

const credentials = {
  google: "GOOGLE_PLACES_API_KEY",
  goong: "GOONG_API_KEY",
  foursquare: "FOURSQUARE_API_KEY",
  geoapify: "GEOAPIFY_API_KEY",
  themealdb: "THEMEALDB_API_KEY",
  spoonacular: "SPOONACULAR_API_KEY",
} as const;
export const adminOperationsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRoles("ADMIN"));
  app.addHook(
    "preHandler",
    createRateLimitHook({ keyPrefix: "admin-operations", limit: 60, windowMs: 60000 }),
  );
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  const ai = loadAiConfig(),
    email = loadEmailConfig();
  app.get("/admin/operations", async () => {
    const now = new Date(),
      namespace = securityNamespace();
    const [observations, quotas, analysis, chat, emails, deletions, maintenance, budget] =
      await app.prisma.$transaction([
        app.prisma.providerObservation.findMany({ where: { namespace } }),
        app.prisma.sharedQuotaBucket.findMany({
          where: { namespace, scope: { startsWith: "provider:" }, resetAt: { gt: now } },
          select: { scope: true, count: true, resetAt: true },
        }),
        app.prisma.tasteAnalysisJob.groupBy({ by: ["status"], _count: true }),
        app.prisma.chatRun.groupBy({ by: ["status"], _count: true }),
        app.prisma.emailOutbox.groupBy({ by: ["status"], _count: true }),
        app.prisma.accountDeletionJob.groupBy({ by: ["status"], _count: true }),
        app.prisma.maintenanceLease.findUnique({ where: { name: "retention-v1" } }),
        app.prisma.aiBudgetUsage.findUnique({
          where: { namespace_day: { namespace, day: now.toISOString().slice(0, 10) } },
        }),
      ]);
    return {
      data: {
        generatedAt: now,
        providers: Object.entries(credentials).map(([source, key]) => {
          const observation = observations.find((row) => row.provider === source),
            quota = quotas.find((row) => row.scope === `provider:${source}`);
          return {
            source,
            configured: !!process.env[key]?.trim(),
            status: !process.env[key]?.trim()
              ? "NOT_CONFIGURED"
              : !observation || observation.lastAttemptAt.getTime() < now.getTime() - 3600000
                ? "NOT_CHECKED"
                : observation.lastStatus,
            lastAttemptAt: observation?.lastAttemptAt ?? null,
            lastSuccessAt: observation?.lastSuccessAt ?? null,
            requests: observation?.requests.toString() ?? "0",
            failures: observation?.failures.toString() ?? "0",
            quotaRejections: observation?.quotaRejections.toString() ?? "0",
            minuteLimit: providerRequestLimit(),
            used: quota?.count ?? 0,
            resetAt: quota?.resetAt ?? null,
          };
        }),
        aiBudget: {
          limitMicros: String(ai.dailyBudgetMicros),
          reservedMicros: budget?.reservedMicros.toString() ?? "0",
          requests: budget?.requests ?? 0,
          pricingValidUntil: ai.priceValidUntil,
          model: ai.model,
        },
        capabilities: {
          aiConfigured: !!ai.apiKey,
          emailConfigured: email.configured,
          workerEnabled: ai.workerEnabled,
        },
        jobs: { analysis, chat, email: emails, deletion: deletions },
        retention: {
          lastCompletedAt: maintenance?.lastCompletedAt ?? null,
          nextRunAt: maintenance?.nextRunAt ?? null,
          lastErrorCode: maintenance?.lastErrorCode ?? null,
        },
      },
    };
  });
  app.get(
    "/admin/operations/account-deletions",
    {
      schema: {
        querystring: Type.Object(
          {
            cursor: Type.Optional(Type.String({ format: "uuid" })),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const { cursor, limit = 20 } = req.query;
      const items = await app.prisma.accountDeletionJob.findMany({
        where: { ...(cursor ? { id: { gt: cursor } } : {}) },
        orderBy: { id: "asc" },
        take: limit + 1,
        select: {
          id: true,
          status: true,
          attempts: true,
          requestedAt: true,
          updatedAt: true,
          availableAt: true,
          errorCode: true,
        },
      });
      return {
        data: {
          items: items.slice(0, limit),
          nextCursor: items.length > limit ? items[limit - 1]!.id : null,
        },
      };
    },
  );
  app.post(
    "/admin/operations/account-deletions/:id/retry",
    {
      schema: {
        params: Type.Object(
          { id: Type.String({ format: "uuid" }) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          { expectedUpdatedAt: Type.String({ format: "date-time" }), confirm: Type.Literal(true) },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      if (!ai.workerEnabled)
        throw new AppError(503, "ACCOUNT_DELETION_UNAVAILABLE", "Worker xử lý xóa chưa được bật.");
      return serializableWrite(app.prisma, async (tx) => {
        if (
          !(await tx.user.findFirst({
            where: { id: req.authUser!.id, role: "ADMIN", status: "ACTIVE" },
          }))
        )
          throw new AppError(403, "FORBIDDEN", "Không còn quyền quản trị.");
        const job = await tx.accountDeletionJob.findUnique({ where: { id: req.params.id } });
        if (!job)
          throw new AppError(
            404,
            "DELETION_JOB_NOT_FOUND",
            "Yêu cầu xóa đã xử lý hoặc không tồn tại.",
          );
        const updatedAt = new Date(Math.max(Date.now(), job.updatedAt.getTime() + 1));
        const changed = await tx.accountDeletionJob.updateMany({
          where: {
            id: job.id,
            status: "FAILED",
            updatedAt: new Date(req.body.expectedUpdatedAt),
            user: { status: "DISABLED" },
          },
          data: {
            status: "QUEUED",
            attempts: 0,
            availableAt: new Date(),
            errorCode: null,
            leaseToken: null,
            leaseUntil: null,
            updatedAt,
          },
        });
        if (!changed.count)
          throw new AppError(
            409,
            "DELETION_JOB_CONFLICT",
            "Yêu cầu đã thay đổi. Tải lại trước khi thử tiếp.",
          );
        await audit(tx, req.authUser!.id, "ACCOUNT_DELETE_RETRY", job.userId, {
          requestId: job.id,
        });
        return { data: { id: job.id, status: "QUEUED", updatedAt } };
      });
    },
  );
};
