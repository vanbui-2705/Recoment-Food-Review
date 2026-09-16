import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const HealthResponseSchema = Type.Object({
  status: Type.Literal("ok"),
  service: Type.String(),
  timestamp: Type.String(),
});

export const healthRoutes: FastifyPluginAsyncTypebox = async function healthRoutes(app) {
  app.get(
    "/health",
    {
      schema: {
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async () => ({
      status: "ok" as const,
      service: "Rec-Food Backend",
      timestamp: new Date().toISOString(),
    }),
  );
};
