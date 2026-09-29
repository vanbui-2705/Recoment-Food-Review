import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";

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
      tokenHash: string;
      expiresAt: Date;
      userAgent?: string;
      ipAddress?: string;
    }): Promise<void> {
      try {
        await prisma.$transaction(
          async (transaction) => {
            const replacement = await transaction.refreshToken.create({
              data: {
                userId: input.userId,
                tokenHash: input.tokenHash,
                expiresAt: input.expiresAt,
                ...(input.userAgent ? { userAgent: input.userAgent } : {}),
                ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
              },
            });

            const revoked = await transaction.refreshToken.updateMany({
              where: { id: input.oldTokenId, revokedAt: null },
              data: {
                revokedAt: new Date(),
                lastUsedAt: new Date(),
                replacedByTokenId: replacement.id,
              },
            });

            if (revoked.count !== 1) {
              throw new RefreshTokenRotationConflictError();
            }
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          throw new RefreshTokenRotationConflictError();
        }

        throw error;
      }
    },

    async revokeRefreshToken(tokenHash: string): Promise<void> {
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      });
    },

    async changePassword(userId: string, passwordHash: string): Promise<void> {
      await prisma.$transaction(async (transaction) => {
        const updated = await transaction.user.updateMany({
          where: { id: userId },
          data: { passwordHash },
        });

        if (updated.count !== 1) {
          throw new Error("User no longer exists");
        }

        await transaction.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date(), lastUsedAt: new Date() },
        });
      });
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
