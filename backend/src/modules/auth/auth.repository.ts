import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
import { AppError } from "../../common/errors/app-error.js";

const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;

const authenticatedUserSelect = {
  ...publicUserSelect,
  status: true,
  authVersion: true,
  legacyAccessDisabled: true,
} as const satisfies Prisma.UserSelect;

const credentialsUserSelect = {
  ...authenticatedUserSelect,
  passwordHash: true,
} as const satisfies Prisma.UserSelect;

const refreshTokenSelect = {
  id: true,
  userId: true,
  tokenHash: true,
  expiresAt: true,
  revokedAt: true,
  replacedByTokenId: true,
  familyId: true,
  authVersion: true,
  user: { select: authenticatedUserSelect },
} as const satisfies Prisma.RefreshTokenSelect;

export type RegisteredUserRecord = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export type AuthenticatedUserRecord = Prisma.UserGetPayload<{
  select: typeof authenticatedUserSelect;
}>;

export type CredentialsUserRecord = Prisma.UserGetPayload<{
  select: typeof credentialsUserSelect;
}>;

export type RefreshTokenRecord = Prisma.RefreshTokenGetPayload<{
  select: typeof refreshTokenSelect;
}>;

export class DuplicateEmailError extends Error {
  public constructor() {
    super("Email already exists");
    this.name = "DuplicateEmailError";
  }
}

export class RefreshTokenRotationConflictError extends Error {
  public constructor() {
    super("Refresh token was already rotated");
    this.name = "RefreshTokenRotationConflictError";
  }
}

export function createAuthRepository(prisma: PrismaClient) {
  return {
    async findByEmail(email: string): Promise<{ id: string } | null> {
      return prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
    },

    async findUserWithCredentials(email: string): Promise<CredentialsUserRecord | null> {
      return prisma.user.findUnique({
        where: { email },
        select: credentialsUserSelect,
      });
    },

    async findUserWithCredentialsById(id: string): Promise<CredentialsUserRecord | null> {
      return prisma.user.findUnique({
        where: { id },
        select: credentialsUserSelect,
      });
    },

    async findUserById(id: string): Promise<AuthenticatedUserRecord | null> {
      return prisma.user.findUnique({
        where: { id },
        select: authenticatedUserSelect,
      });
    },

    async createUser(input: {
      email: string;
      displayName: string;
      passwordHash: string;
    }): Promise<RegisteredUserRecord> {
      try {
        return await prisma.user.create({
          data: input,
          select: publicUserSelect,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new DuplicateEmailError();
        }

        throw error;
      }
    },

    async createRefreshToken(input: {
      userId: string;
      familyId: string;
      authVersion: number;
      tokenHash: string;
      expiresAt: Date;
      userAgent?: string;
      ipAddress?: string;
    }): Promise<void> {
      await prisma.refreshToken.create({ data: input });
    },

    async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
      return prisma.refreshToken.findUnique({
        where: { tokenHash },
        select: refreshTokenSelect,
      });
    },

    async rotateRefreshToken(input: {
      oldTokenId: string;
      userId: string;
      familyId: string;
      authVersion: number;
      tokenHash: string;
      expiresAt: Date;
      userAgent?: string;
      ipAddress?: string;
    }): Promise<void> {
      try {
        await serializableWrite(prisma, async (transaction) => {
          const replacement = await transaction.refreshToken.create({
            data: {
              userId: input.userId,
              familyId: input.familyId,
              authVersion: input.authVersion,
              tokenHash: input.tokenHash,
              expiresAt: input.expiresAt,
              ...(input.userAgent ? { userAgent: input.userAgent } : {}),
              ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
            },
          });

          const revoked = await transaction.refreshToken.updateMany({
            where: {
              id: input.oldTokenId,
              userId: input.userId,
              familyId: input.familyId,
              authVersion: input.authVersion,
              revokedAt: null,
              expiresAt: { gt: new Date() },
              user: { status: "ACTIVE", authVersion: input.authVersion },
            },
            data: {
              revokedAt: new Date(),
              lastUsedAt: new Date(),
              replacedByTokenId: replacement.id,
            },
          });

          if (revoked.count !== 1) {
            throw new RefreshTokenRotationConflictError();
          }
        });
      } catch (error) {
        if (error instanceof AppError && error.code === "WRITE_CONFLICT") {
          throw new RefreshTokenRotationConflictError();
        }

        throw error;
      }
    },

    async revokeRefreshToken(tokenHash: string): Promise<void> {
      await serializableWrite(prisma, async (tx) => {
        const token = await tx.refreshToken.findUnique({
          where: { tokenHash },
          select: { userId: true, familyId: true },
        });
        if (token)
          await tx.user.update({
            where: { id: token.userId },
            data: { legacyAccessDisabled: true },
          });
        if (token)
          await tx.refreshToken.updateMany({
            where: { userId: token.userId, familyId: token.familyId, revokedAt: null },
            data: { revokedAt: new Date(), lastUsedAt: new Date() },
          });
      });
    },

    async changePassword(
      userId: string,
      passwordHash: string,
      expectedHash: string,
    ): Promise<void> {
      await serializableWrite(prisma, async (transaction) => {
        const updated = await transaction.user.updateMany({
          where: { id: userId, passwordHash: expectedHash, status: "ACTIVE" },
          data: { passwordHash, authVersion: { increment: 1 } },
        });

        if (updated.count !== 1) {
          throw new AppError(
            409,
            "ACCOUNT_CHANGED",
            "Tài khoản đã thay đổi. Hãy đăng nhập lại trước khi đổi mật khẩu.",
          );
        }

        await transaction.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date(), lastUsedAt: new Date() },
        });
      });
    },

    async isSessionActive(userId: string, familyId: string, authVersion: number): Promise<boolean> {
      return !!(await prisma.refreshToken.findFirst({
        where: { userId, familyId, authVersion, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true },
      }));
    },

    async listSessions(userId: string) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { authVersion: true },
      });
      return prisma.refreshToken.findMany({
        where: {
          userId,
          authVersion: user?.authVersion ?? -1,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: { status: "ACTIVE" },
        },
        select: {
          familyId: true,
          userAgent: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
      });
    },

    async revokeSession(userId: string, familyId: string) {
      await serializableWrite(prisma, async (tx) => {
        const token = await tx.refreshToken.findFirst({
          where: { userId, familyId },
          select: { id: true },
        });
        if (!token)
          throw new AppError(
            404,
            "SESSION_NOT_FOUND",
            "Phiên đăng nhập không còn trong tài khoản của bạn.",
          );
        await tx.user.update({ where: { id: userId }, data: { legacyAccessDisabled: true } });
        await tx.refreshToken.updateMany({
          where: { userId, familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
    },

    async logoutAll(userId: string) {
      await serializableWrite(prisma, async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { authVersion: { increment: 1 } } });
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
