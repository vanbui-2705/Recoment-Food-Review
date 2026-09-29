import { Type, type Static } from "@fastify/type-provider-typebox";

// Schema này vừa validate body ở runtime, vừa là nguồn để TypeScript suy ra RegisterInput.
export const RegisterUserSchema = Type.Object(
  {
    email: Type.String({
      format: "email",
      maxLength: 255,
    }),
    password: Type.String({
      minLength: 8,
      maxLength: 255,
    }),
    displayName: Type.String({
      minLength: 2,
      maxLength: 100,
    }),
  },
  {
    // Từ chối các field lạ như role/status để client không tự gán quyền cho mình.
    additionalProperties: false,
  },
);

// Chỉ mô tả những field được phép trả về client; passwordHash cố ý không xuất hiện ở đây.
export const PublicUserSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    email: Type.String({ format: "email", maxLength: 255 }),
    displayName: Type.String({ minLength: 2, maxLength: 100 }),
    role: Type.Union([Type.Literal("USER"), Type.Literal("ADMIN")]),
    createdAt: Type.String({ format: "date-time" }),
  },
  {
    additionalProperties: false,
  },
);

export const RegisterResponseSchema = Type.Object(
  {
    data: Type.Object({
      user: PublicUserSchema,
    }),
  },
  {
    additionalProperties: false,
  },
);

export const LoginSchema = Type.Object(
  {
    email: Type.String({ format: "email", maxLength: 255 }),
    password: Type.String({ minLength: 1, maxLength: 255 }),
  },
  { additionalProperties: false },
);

export const RefreshTokenSchema = Type.Object(
  {
    refreshToken: Type.String({ minLength: 1, maxLength: 512 }),
  },
  { additionalProperties: false },
);

export const ChangePasswordSchema = Type.Object(
  {
    currentPassword: Type.String({ minLength: 1, maxLength: 255 }),
    newPassword: Type.String({ minLength: 8, maxLength: 255 }),
  },
  { additionalProperties: false },
);

export const AuthSessionResponseSchema = Type.Object(
  {
    data: Type.Object({
      user: PublicUserSchema,
      accessToken: Type.String({ minLength: 1 }),
      refreshToken: Type.String({ minLength: 1 }),
      expiresIn: Type.Integer({ minimum: 1 }),
    }),
  },
  { additionalProperties: false },
);

export const MeResponseSchema = Type.Object(
  {
    data: Type.Object({ user: PublicUserSchema }),
  },
  { additionalProperties: false },
);

// Static biến TypeBox schema thành TypeScript type, tránh phải khai báo cùng cấu trúc hai lần.
export type RegisterInput = Static<typeof RegisterUserSchema>;
export type LoginInput = Static<typeof LoginSchema>;
export type RefreshTokenInput = Static<typeof RefreshTokenSchema>;
export type ChangePasswordInput = Static<typeof ChangePasswordSchema>;
