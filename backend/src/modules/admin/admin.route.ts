import { Type } from "@fastify/type-provider-typebox";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const AdminCheckResponseSchema = Type.Object({
  data: Type.Object({
    authorized: Type.Literal(true),
    userId: Type.String({ format: "uuid" }),
  }),
});

export const adminRoutes: FastifyPluginAsyncTypebox = async function adminRoutes(app) {
  app.get(
    "/admin/access-check",
    {
      preHandler: [app.authenticate, app.requireRoles("ADMIN")],
      schema: { response: { 200: AdminCheckResponseSchema } },
    },
    async (request, reply) => {
      if (!request.authUser) {
        throw new Error("Authenticated user missing after authentication hook");
      }

      return reply.status(200).send({
        data: { authorized: true, userId: request.authUser.id },
      });
    },
  );
};
