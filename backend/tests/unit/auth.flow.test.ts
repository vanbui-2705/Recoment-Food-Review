import { describe, expect, it, vi } from "vitest";

import { hashPassword } from "../../src/common/security/password.js";
import { hashRefreshToken, verifyAccessToken } from "../../src/common/security/token.js";
import type { AuthRepository } from "../../src/modules/auth/auth.repository.js";
import { createAuthService } from "../../src/modules/auth/auth.service.js";

const config = {
  jwtAccessSecret: "unit-test-jwt-secret-that-is-long-enough",
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 30,
};

const user = {
  id: "f8f762bb-3a4c-45a4-92b7-d365b1fc8348",
  email: "user@example.com",
  displayName: "Test User",
  role: "USER" as const,
  status: "ACTIVE" as const,
  authVersion: 0,
  createdAt: new Date("2026-09-23T00:00:00.000Z"),
};

function createRepository(overrides: Partial<Record<keyof AuthRepository, unknown>> = {}) {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    findUserWithCredentials: vi.fn(),
    findUserWithCredentialsById: vi.fn(),
    findUserById: vi.fn().mockResolvedValue(user),
    createUser: vi.fn(),
    createRefreshToken: vi.fn().mockResolvedValue(undefined),
    findRefreshToken: vi.fn(),
    rotateRefreshToken: vi.fn().mockResolvedValue(undefined),
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AuthRepository;
}

describe("complete authentication flow", () => {
  it("logs in with Argon2 password verification and stores only a refresh hash", async () => {
    const passwordHash = await hashPassword("strong-password");
    const repository = createRepository({
      findUserWithCredentials: vi.fn().mockResolvedValue({ ...user, passwordHash }),
    });
    const service = createAuthService(repository, config);

    const session = await service.login(
      { email: " USER@EXAMPLE.COM ", password: "strong-password" },
      { ipAddress: "127.0.0.1" },
    );

    expect(session.user.email).toBe(user.email);
    expect(session.accessToken).toEqual(expect.any(String));
    expect(session.refreshToken).toEqual(expect.any(String));
    expect(repository.createRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        tokenHash: hashRefreshToken(session.refreshToken),
      }),
    );
    expect(repository.createRefreshToken).not.toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: session.refreshToken }),
    );

    await expect(
      verifyAccessToken(session.accessToken, config.jwtAccessSecret),
    ).resolves.toMatchObject({
      userId: user.id,
      role: "USER",
    });
  });

  it("returns one generic error for an invalid password", async () => {
    const passwordHash = await hashPassword("strong-password");
    const repository = createRepository({
      findUserWithCredentials: vi.fn().mockResolvedValue({ ...user, passwordHash }),
    });
    const service = createAuthService(repository, config);

    await expect(
      service.login({ email: user.email, password: "wrong-password" }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
    expect(repository.createRefreshToken).not.toHaveBeenCalled();
  });

  it("rotates a valid refresh token and rejects a disabled user", async () => {
    const oldRefreshToken = "old-refresh-token";
    const repository = createRepository({
      findRefreshToken: vi.fn().mockResolvedValue({
        id: "2a7b0c4d-3c7e-4bf7-9e92-4ce3e8a0f0c1",
        userId: user.id,
        tokenHash: hashRefreshToken(oldRefreshToken),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        replacedByTokenId: null,
        authVersion: 0,
        familyId: "2a7b0c4d-3c7e-4bf7-9e92-4ce3e8a0f0c1",
        user,
      }),
    });
    const service = createAuthService(repository, config);

    const session = await service.refresh({ refreshToken: oldRefreshToken });

    expect(session.refreshToken).not.toBe(oldRefreshToken);
    expect(repository.rotateRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        oldTokenId: "2a7b0c4d-3c7e-4bf7-9e92-4ce3e8a0f0c1",
        userId: user.id,
      }),
    );

    const disabledRepository = createRepository({
      findRefreshToken: vi.fn().mockResolvedValue({
        id: "2a7b0c4d-3c7e-4bf7-9e92-4ce3e8a0f0c1",
        userId: user.id,
        tokenHash: hashRefreshToken(oldRefreshToken),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        replacedByTokenId: null,
        user: { ...user, status: "DISABLED" as const },
      }),
    });

    await expect(
      createAuthService(disabledRepository, config).refresh({ refreshToken: oldRefreshToken }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
    expect(disabledRepository.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it("makes logout idempotently revoke the token hash", async () => {
    const repository = createRepository();
    const service = createAuthService(repository, config);
    const refreshToken = "logout-refresh-token";

    await service.logout({ refreshToken });
    await service.logout({ refreshToken });

    expect(repository.revokeRefreshToken).toHaveBeenCalledTimes(2);
    expect(repository.revokeRefreshToken).toHaveBeenCalledWith(hashRefreshToken(refreshToken));
  });

  it("changes password only after verifying the current password", async () => {
    const passwordHash = await hashPassword("current-password");
    const repository = createRepository({
      findUserWithCredentialsById: vi.fn().mockResolvedValue({ ...user, passwordHash }),
    });
    const service = createAuthService(repository, config);

    await service.changePassword(user.id, {
      currentPassword: "current-password",
      newPassword: "new-password",
    });

    const changedHash = vi.mocked(repository.changePassword).mock.calls[0]?.[1];
    expect(changedHash).toEqual(expect.stringMatching(/^\$argon2id\$/));
    expect(changedHash).not.toBe("new-password");

    await expect(
      service.changePassword(user.id, {
        currentPassword: "wrong-password",
        newPassword: "another-password",
      }),
    ).rejects.toMatchObject({ statusCode: 401, code: "INVALID_CURRENT_PASSWORD" });
    expect(repository.changePassword).toHaveBeenCalledTimes(1);
  });
});
