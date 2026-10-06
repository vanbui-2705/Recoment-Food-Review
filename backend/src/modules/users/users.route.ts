import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { AppError } from "../../common/errors/app-error.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";

import { MeResponseSchema } from "../auth/auth.schema.js";

export const usersRoutes: FastifyPluginAsyncTypebox = async function usersRoutes(app) {
  app.put(
    "/users/me/name",
    {
      preHandler: [
        app.authenticate,
        createRateLimitHook({ keyPrefix: "account-name", limit: 20, windowMs: 60_000 }),
      ],
      schema: {
        body: Type.Object(
          { displayName: Type.String({ minLength: 2, maxLength: 100 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const displayName = req.body.displayName.trim().replace(/\s+/g, " ");
      if (displayName.length < 2)
        throw new AppError(400, "INVALID_DISPLAY_NAME", "Tên hiển thị cần ít nhất 2 ký tự.");
      await app.prisma.user.update({ where: { id: req.authUser!.id }, data: { displayName } });
      return { data: { displayName } };
    },
  );
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
