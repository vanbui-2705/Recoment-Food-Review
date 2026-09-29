import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import { MeResponseSchema } from "../auth/auth.schema.js";

export const usersRoutes: FastifyPluginAsyncTypebox = async function usersRoutes(app) {
  app.get(
    "/users/me",
    {
      preHandler: app.authenticate,
      schema: { response: { 200: MeResponseSchema } },
    },
    async (request, reply) => {
      const user = request.authUser;
      if (!user) {
        throw new Error("Authenticated user missing after authentication hook");
      }

      return reply.status(200).send({
        data: {
          user: {
            ...user,
            createdAt: user.createdAt.toISOString(),
          },
        },
      });
    },
  );
};
