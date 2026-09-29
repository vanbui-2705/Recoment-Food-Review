import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import { loadEnv } from "../../config/env.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { createAuthRepository } from "./auth.repository.js";
import {
  AuthSessionResponseSchema,
  ChangePasswordSchema,
  LoginSchema,
  RefreshTokenSchema,
  RegisterResponseSchema,
  RegisterUserSchema,
} from "./auth.schema.js";
import { createAuthService } from "./auth.service.js";

function requestMetadata(request: {
  headers: Record<string, string | string[] | undefined>;
  ip: string;
}) {
  const userAgent = request.headers["user-agent"];

  const metadata: { userAgent?: string; ipAddress: string } = { ipAddress: request.ip };
  if (typeof userAgent === "string") {
    metadata.userAgent = userAgent;
  } else if (Array.isArray(userAgent) && userAgent[0]) {
    metadata.userAgent = userAgent[0];
  }

  return metadata;
}

function serializeSession(
  session: Awaited<ReturnType<ReturnType<typeof createAuthService>["login"]>>,
) {
  return {
    data: {
      ...session,
      user: {
        ...session.user,
        createdAt: session.user.createdAt.toISOString(),
      },
    },
  };
}

export const authRoutes: FastifyPluginAsyncTypebox = async function authRoutes(app) {
  const config = loadEnv();
  const repository = createAuthRepository(app.prisma);
  const service = createAuthService(repository, config);
  const registerRateLimit = createRateLimitHook({
    keyPrefix: "auth-register",
    limit: 5,
    windowMs: 60_000,
  });
  const loginRateLimit = createRateLimitHook({
    keyPrefix: "auth-login",
    limit: 5,
    windowMs: 60_000,
  });
  const refreshRateLimit = createRateLimitHook({
    keyPrefix: "auth-refresh",
    limit: 10,
    windowMs: 60_000,
  });
  const changePasswordRateLimit = createRateLimitHook({
    keyPrefix: "auth-change-password",
    limit: 5,
    windowMs: 15 * 60_000,
  });

  app.post(
    "/auth/register",
    {
      schema: {
        body: RegisterUserSchema,
        response: { 201: RegisterResponseSchema },
      },
      preHandler: registerRateLimit,
    },
    async (request, reply) => {
      const user = await service.register(request.body);

      return reply.status(201).send({
        data: {
          user: {
            ...user,
            createdAt: user.createdAt.toISOString(),
          },
        },
      });
    },
  );

  app.post(
    "/auth/login",
    {
      schema: {
        body: LoginSchema,
        response: { 200: AuthSessionResponseSchema },
      },
      preHandler: loginRateLimit,
    },
    async (request, reply) => {
      const session = await service.login(request.body, requestMetadata(request));
      return reply.status(200).send(serializeSession(session));
    },
  );

  app.post(
    "/auth/refresh",
    {
      schema: {
        body: RefreshTokenSchema,
        response: { 200: AuthSessionResponseSchema },
      },
      preHandler: refreshRateLimit,
    },
    async (request, reply) => {
      const session = await service.refresh(request.body, requestMetadata(request));
      return reply.status(200).send(serializeSession(session));
    },
  );

  app.post("/auth/logout", { schema: { body: RefreshTokenSchema } }, async (request, reply) => {
    await service.logout(request.body);
    return reply.status(204).send();
  });

  app.post(
    "/auth/change-password",
    {
      preHandler: [app.authenticate, changePasswordRateLimit],
      schema: { body: ChangePasswordSchema },
    },
    async (request, reply) => {
      if (!request.authUser) {
        throw new Error("Authenticated user missing after authentication hook");
      }

      await service.changePassword(request.authUser.id, request.body);
      return reply.status(204).send();
    },
  );
};
