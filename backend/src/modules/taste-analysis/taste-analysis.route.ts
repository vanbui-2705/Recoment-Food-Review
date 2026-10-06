import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { loadAiConfig } from "../ai/ai.config.js";
import { createBudgetedGeminiProvider } from "../ai/ai.budget.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { createTasteAnalysisService, publicAnalysis } from "./taste-analysis.service.js";
import type { TasteAnalysisJob } from "../../generated/prisma/client.js";
import { object, list, string } from "../discovery/provider.http.js";
export const tasteAnalysisRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const config = loadAiConfig();
  const provider = createBudgetedGeminiProvider(app.prisma, config);
  const service = createTasteAnalysisService(app.prisma, config, provider);
  const serialize = async (job: TasteAnalysisJob | null) => {
    const output = publicAnalysis(job, provider.configured);
    if (!output || !job?.result) return output;
    const result = object(job.result);
    const allergenCodes = list(result.allergies).map((f) => string(object(f).code));
    const dietCodes = list(result.diets).map((f) => string(object(f).code));
    const [allergens, diets] = await Promise.all([
      app.prisma.allergen.findMany({
        where: { code: { in: allergenCodes } },
        select: { code: true, name: true },
      }),
      app.prisma.dietaryRestriction.findMany({
        where: { code: { in: dietCodes } },
        select: { code: true, name: true },
      }),
    ]);
    return {
      ...output,
      labels: {
        allergies: Object.fromEntries(allergens.map((f) => [f.code, f.name])),
        diets: Object.fromEntries(diets.map((f) => [f.code, f.name])),
      },
    };
  };
  app.addHook("preHandler", app.authenticate);
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  const limited = createRateLimitHook({ keyPrefix: "taste-analysis", limit: 10, windowMs: 60000 });
  const params = Type.Object(
    { id: Type.String({ format: "uuid" }) },
    { additionalProperties: false },
  );
  app.get("/users/me/food-knowledge/analyses", async (req) => ({
    data: {
      configured: provider.configured,
      analysis: await serialize(await service.latest(req.authUser!.id)),
    },
  }));
  app.post("/users/me/food-knowledge/analyses", { preHandler: limited }, async (req, reply) =>
    reply.code(202).send({
      data: {
        analysis: await serialize(await service.start(req.authUser!.id)),
      },
    }),
  );
  app.get("/users/me/food-knowledge/analyses/:id", { schema: { params } }, async (req) => ({
    data: {
      analysis: await serialize(await service.get(req.authUser!.id, req.params.id)),
    },
  }));
  app.post(
    "/users/me/food-knowledge/analyses/:id/confirm",
    {
      preHandler: limited,
      schema: {
        params,
        body: Type.Object(
          { sourceRevision: Type.Integer({ minimum: 1 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => ({
      data: {
        analysis: await serialize(
          await service.confirm(req.authUser!.id, req.params.id, req.body.sourceRevision),
        ),
      },
    }),
  );
};
