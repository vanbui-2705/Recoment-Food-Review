import { isIP } from "node:net";
const NODE_ENV_VALUES = ["development", "test", "production"] as const;

export function trustedProxyIps(environment: NodeJS.ProcessEnv = process.env): string[] | false {
  const ips = (environment.TRUST_PROXY_IPS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!ips.length) return false;
  if (ips.length > 8 || ips.some((ip) => !isIP(ip) || ["0.0.0.0", "::"].includes(ip)))
    throw new Error("TRUST_PROXY_IPS requires explicit proxy IP addresses (maximum 8)");
  return [...new Set(ips)];
}

type NodeEnv = (typeof NODE_ENV_VALUES)[number];

export type AppConfig = {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  databaseUrl: string;
  jwtAccessSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
};

function parseNodeEnv(value: string | undefined): NodeEnv {
  const nodeEnv = value ?? "development";

  if (!NODE_ENV_VALUES.includes(nodeEnv as NodeEnv)) {
    throw new Error(`NODE_ENV phải là một trong các giá trị: ${NODE_ENV_VALUES.join(", ")}`);
  }

  return nodeEnv as NodeEnv;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? "3001");

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT phải là số nguyên từ 1 đến 65535");
  }

  return port;
}

function parseRequired(value: string | undefined, name: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`${name} là biến môi trường bắt buộc`);
  }

  return normalizedValue;
}

function parsePositiveInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} phải là số nguyên dương`);
  }

  return parsed;
}

function parseJwtAccessSecret(value: string | undefined, nodeEnv: NodeEnv): string {
  const normalizedValue = value?.trim();

  if (normalizedValue) {
    if (nodeEnv === "production" && normalizedValue.length < 32) {
      throw new Error("JWT_ACCESS_SECRET production phải có ít nhất 32 ký tự");
    }

    return normalizedValue;
  }

  if (nodeEnv === "production") {
    throw new Error("JWT_ACCESS_SECRET là biến môi trường bắt buộc trong production");
  }

  return "development-only-replace-jwt-access-secret-please";
}

export function loadEnv(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = parseNodeEnv(environment.NODE_ENV);

  return {
    nodeEnv,
    host: environment.HOST?.trim() || "0.0.0.0",
    port: parsePort(environment.PORT),
    databaseUrl: parseRequired(environment.DATABASE_URL, "DATABASE_URL"),
    jwtAccessSecret: parseJwtAccessSecret(environment.JWT_ACCESS_SECRET, nodeEnv),
    accessTokenTtlSeconds: parsePositiveInteger(
      environment.ACCESS_TOKEN_TTL_SECONDS,
      900,
      "ACCESS_TOKEN_TTL_SECONDS",
    ),
    refreshTokenTtlDays: parsePositiveInteger(
      environment.REFRESH_TOKEN_TTL_DAYS,
      30,
      "REFRESH_TOKEN_TTL_DAYS",
    ),
  };
}
