import { describe, expect, it, vi } from "vitest";

import type { AppError } from "../../src/common/errors/app-error.js";
import type { AuthRepository } from "../../src/modules/auth/auth.repository.js";
import { createAuthService } from "../../src/modules/auth/auth.service.js";

function createRepositoryMock(): AuthRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    createUser: vi.fn().mockImplementation(async (input) => ({
      id: "f8f762bb-3a4c-45a4-92b7-d365b1fc8348",
      email: input.email,
      displayName: input.displayName,
      role: "USER" as const,
      createdAt: new Date("2026-09-23T00:00:00.000Z"),
    })),
  };
}

describe("Auth service registration", () => {
  it("chuẩn hóa email và display name trước khi lưu", async () => {
    const repository = createRepositoryMock();
    const service = createAuthService(repository);

    const user = await service.register({
      email: "  New.User@Example.COM  ",
      password: "strong-password",
      displayName: "  Nguyễn   Văn A  ",
    });

    expect(repository.findByEmail).toHaveBeenCalledWith("new.user@example.com");
    expect(repository.createUser).toHaveBeenCalledWith({
      email: "new.user@example.com",
      displayName: "Nguyễn Văn A",
      passwordHash: expect.stringMatching(/^\$argon2id\$/),
    });
    expect(user.email).toBe("new.user@example.com");
  });

  it("từ chối email đã tồn tại trước khi hash mật khẩu", async () => {
    const repository = createRepositoryMock();
    vi.mocked(repository.findByEmail).mockResolvedValue({ id: "existing-user" });
    const service = createAuthService(repository);

    await expect(
      service.register({
        email: "existing@example.com",
        password: "strong-password",
        displayName: "Existing User",
      }),
    ).rejects.toMatchObject<AppError>({
      statusCode: 409,
      code: "EMAIL_ALREADY_EXISTS",
    });

    expect(repository.createUser).not.toHaveBeenCalled();
  });
});
