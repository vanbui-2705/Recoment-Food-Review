import { verify } from "argon2";
import { randomUUID } from "node:crypto";

import type { AppConfig } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from "../../common/security/token.js";
import { hashPassword } from "../../common/security/password.js";
import {
  DuplicateEmailError,
  RefreshTokenRotationConflictError,
  type AuthRepository,
  type AuthenticatedUserRecord,
  type RegisteredUserRecord,
} from "./auth.repository.js";
import type {
  ChangePasswordInput,
  LoginInput,
  RefreshTokenInput,
  RegisterInput,
} from "./auth.schema.js";

type AuthServiceConfig = Pick<
  AppConfig,
  "jwtAccessSecret" | "accessTokenTtlSeconds" | "refreshTokenTtlDays"
>;

type TokenMetadata = {
  userAgent?: string;
  ipAddress?: string;
};

export type AuthSession = {
  user: RegisteredUserRecord;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, " ");
}

function toPublicUser(user: AuthenticatedUserRecord | RegisteredUserRecord): RegisteredUserRecord {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function invalidCredentials(): AppError {
  return new AppError(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng");
}

function refreshTokenExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}

export function createAuthService(repository: AuthRepository, config?: AuthServiceConfig) {
  const requireConfig = (): AuthServiceConfig => {
    if (!config) {
      throw new Error("Auth service token configuration is required");
    }

    return config;
  };

  const issueSession = async (
    user: AuthenticatedUserRecord,
    metadata: TokenMetadata,
  ): Promise<AuthSession> => {
    const tokenConfig = requireConfig();
    const opaqueRefreshToken = createRefreshToken();
    const familyId = randomUUID();
    const refreshExpiresAt = new Date(
      Date.now() + tokenConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1_000,
    );

    await repository.createRefreshToken({
      userId: user.id,
      familyId,
      authVersion: user.authVersion,
      tokenHash: opaqueRefreshToken.tokenHash,
      expiresAt: refreshExpiresAt,
      ...metadata,
    });

    return {
      user: toPublicUser(user),
      accessToken: await signAccessToken(
        { userId: user.id, role: user.role, authVersion: user.authVersion, sessionId: familyId },
        tokenConfig.jwtAccessSecret,
        tokenConfig.accessTokenTtlSeconds,
      ),
      refreshToken: opaqueRefreshToken.token,
      expiresIn: tokenConfig.accessTokenTtlSeconds,
    };
  };

  return {
    async register(input: RegisterInput): Promise<RegisteredUserRecord> {
      const email = normalizeEmail(input.email);
      const displayName = normalizeDisplayName(input.displayName);

      if (displayName.length < 2) {
        throw new AppError(400, "VALIDATION_ERROR", "Dữ liệu đầu vào không hợp lệ", [
          {
            field: "displayName",
            message: "Tên hiển thị phải có ít nhất 2 ký tự sau khi chuẩn hóa",
          },
        ]);
      }

      const existingUser = await repository.findByEmail(email);
      if (existingUser) {
        throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email đã được sử dụng");
      }

      const passwordHash = await hashPassword(input.password);

      try {
        return await repository.createUser({ email, displayName, passwordHash });
      } catch (error) {
        if (error instanceof DuplicateEmailError) {
          throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email đã được sử dụng");
        }

        throw error;
      }
    },

    async login(input: LoginInput, metadata: TokenMetadata = {}): Promise<AuthSession> {
      const user = await repository.findUserWithCredentials(normalizeEmail(input.email));

      if (!user || user.status !== "ACTIVE") {
        throw invalidCredentials();
      }

      const passwordMatches = await verify(user.passwordHash, input.password).catch(() => false);

      if (!passwordMatches) {
        throw invalidCredentials();
      }

      return issueSession(user, metadata);
    },

    async refresh(input: RefreshTokenInput, metadata: TokenMetadata = {}): Promise<AuthSession> {
      const tokenConfig = requireConfig();
      const tokenHash = hashRefreshToken(input.refreshToken);
      const storedToken = await repository.findRefreshToken(tokenHash);

      if (
        !storedToken ||
        storedToken.revokedAt ||
        refreshTokenExpired(storedToken.expiresAt) ||
        storedToken.user.status !== "ACTIVE" ||
        storedToken.authVersion !== storedToken.user.authVersion
      ) {
        throw invalidCredentials();
      }

      const replacement = createRefreshToken();
      const replacementExpiresAt = new Date(
        Date.now() + tokenConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1_000,
      );

      try {
        await repository.rotateRefreshToken({
          oldTokenId: storedToken.id,
          userId: storedToken.userId,
          familyId: storedToken.familyId,
          authVersion: storedToken.authVersion,
          tokenHash: replacement.tokenHash,
          expiresAt: replacementExpiresAt,
          ...metadata,
        });
      } catch (error) {
        if (error instanceof RefreshTokenRotationConflictError) {
          throw invalidCredentials();
        }

        throw error;
      }

      return {
        user: toPublicUser(storedToken.user),
        accessToken: await signAccessToken(
          {
            userId: storedToken.user.id,
            role: storedToken.user.role,
            authVersion: storedToken.authVersion,
            sessionId: storedToken.familyId,
          },
          tokenConfig.jwtAccessSecret,
          tokenConfig.accessTokenTtlSeconds,
        ),
        refreshToken: replacement.token,
        expiresIn: tokenConfig.accessTokenTtlSeconds,
      };
    },

    async logout(input: RefreshTokenInput): Promise<void> {
      await repository.revokeRefreshToken(hashRefreshToken(input.refreshToken));
    },

    async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
      const user = await repository.findUserWithCredentialsById(userId);
      if (!user || user.status !== "ACTIVE") {
        throw new AppError(401, "INVALID_CURRENT_PASSWORD", "Mật khẩu hiện tại không đúng");
      }

      const currentPasswordMatches = await verify(user.passwordHash, input.currentPassword).catch(
        () => false,
      );
      if (!currentPasswordMatches) {
        throw new AppError(401, "INVALID_CURRENT_PASSWORD", "Mật khẩu hiện tại không đúng");
      }

      if (input.currentPassword === input.newPassword) {
        throw new AppError(
          400,
          "PASSWORD_REUSE_NOT_ALLOWED",
          "Mật khẩu mới phải khác mật khẩu hiện tại",
        );
      }

      await repository.changePassword(
        userId,
        await hashPassword(input.newPassword),
        user.passwordHash,
      );
    },

    async getActiveUserById(userId: string): Promise<RegisteredUserRecord | null> {
      const user = await repository.findUserById(userId);
      if (!user || user.status !== "ACTIVE") {
        return null;
      }

      return toPublicUser(user);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
