import { createHash, randomBytes } from "node:crypto";

import { jwtVerify, SignJWT, type JWTPayload } from "jose";

const TOKEN_ISSUER = "rec-food";
const ACCESS_TOKEN_ALGORITHM = "HS256";

export type AccessTokenClaims = {
  userId: string;
  role: "USER" | "ADMIN";
  authVersion?: number;
  sessionId?: string;
};

function secretBytes(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  secret: string,
  expiresInSeconds: number,
): Promise<string> {
  return new SignJWT({
    role: claims.role,
    typ: "access",
    version: claims.authVersion ?? 0,
    ...(claims.sessionId ? { sid: claims.sessionId } : {}),
  })
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
    authVersion: (payload.version as number | undefined) ?? 0,
    ...(typeof payload.sid === "string" ? { sessionId: payload.sid } : {}),
  };
}

function isAccessTokenPayload(payload: JWTPayload): payload is JWTPayload & {
  sub: string;
  role: "USER" | "ADMIN";
  typ: "access";
} {
  return (
    typeof payload.sub === "string" &&
    (payload.version === undefined ||
      (Number.isSafeInteger(payload.version) && (payload.version as number) >= 0)) &&
    (payload.sid === undefined ||
      (typeof payload.sid === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sid))) &&
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
