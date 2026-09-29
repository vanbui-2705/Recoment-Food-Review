import { createHash, randomBytes } from "node:crypto";

import { jwtVerify, SignJWT, type JWTPayload } from "jose";

const TOKEN_ISSUER = "rec-food";
const ACCESS_TOKEN_ALGORITHM = "HS256";

export type AccessTokenClaims = {
  userId: string;
  role: "USER" | "ADMIN";
};

function secretBytes(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  secret: string,
  expiresInSeconds: number,
): Promise<string> {
  return new SignJWT({ role: claims.role, typ: "access" })
    .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM, typ: "JWT" })
    .setSubject(claims.userId)
    .setIssuer(TOKEN_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(secretBytes(secret));
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessTokenClaims> {
  const result = await jwtVerify(token, secretBytes(secret), {
    algorithms: [ACCESS_TOKEN_ALGORITHM],
    issuer: TOKEN_ISSUER,
  });
  const payload = result.payload;

  if (!isAccessTokenPayload(payload)) {
    throw new Error("Invalid access token claims");
  }

  return {
    userId: payload.sub,
    role: payload.role,
  };
}

function isAccessTokenPayload(payload: JWTPayload): payload is JWTPayload & {
  sub: string;
  role: "USER" | "ADMIN";
  typ: "access";
} {
  return (
    typeof payload.sub === "string" &&
    payload.typ === "access" &&
    (payload.role === "USER" || payload.role === "ADMIN")
  );
}

export function createRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
