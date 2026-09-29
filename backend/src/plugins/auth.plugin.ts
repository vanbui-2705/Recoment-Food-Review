import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, preHandlerAsyncHookHandler } from "fastify";

import { loadEnv } from "../config/env.js";
import { AppError } from "../common/errors/app-error.js";
import { verifyAccessToken } from "../common/security/token.js";
import {
  createAuthRepository,
  type RegisteredUserRecord,
} from "../modules/auth/auth.repository.js";

export type AuthenticatedRequestUser = RegisteredUserRecord;
export type AppRole = "USER" | "ADMIN";

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthenticatedRequestUser | null;
  }

  interface FastifyInstance {
    authenticate: preHandlerAsyncHookHandler;
    requireRoles: (...roles: AppRole[]) => preHandlerAsyncHookHandler;
  }
}

function unauthorized(): AppError {
  return new AppError(401, "UNAUTHORIZED", "Yêu cầu xác thực hợp lệ");
}

export const authPlugin = fastifyPlugin(
  async (app: FastifyInstance) => {
    const config = loadEnv();
    const repository = createAuthRepository(app.prisma);

    app.decorateRequest("authUser", null);
    app.decorate(
      "authenticate",
      async function authenticate(request: FastifyRequest): Promise<void> {
        const authorization = request.headers.authorization;
        if (!authorization?.startsWith("Bearer ")) {
          throw unauthorized();
        }

        const accessToken = authorization.slice("Bearer ".length).trim();
        if (!accessToken) {
          throw unauthorized();
        }

        try {
          const claims = await verifyAccessToken(accessToken, config.jwtAccessSecret);
          const user = await repository.findUserById(claims.userId);

          if (!user || user.status !== "ACTIVE") {
            throw unauthorized();
          }

          request.authUser = {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            createdAt: user.createdAt,
          };
        } catch (error) {
          if (error instanceof AppError) {
            throw error;
          }

          throw unauthorized();
        }
      },
    );

    app.decorate("requireRoles", (...roles: AppRole[]) => {
      return async function requireRoles(request: FastifyRequest): Promise<void> {
        if (!request.authUser) {
          throw unauthorized();
        }

        if (!roles.includes(request.authUser.role)) {
          throw new AppError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này");
        }
      };
    });
  },
  { name: "auth" },
);
