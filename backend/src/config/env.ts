const NODE_ENV_VALUES = ["development", "test", "production"] as const;

type NodeEnv = (typeof NODE_ENV_VALUES)[number];

export type AppConfig = {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  databaseUrl: string;
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

export function loadEnv(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    nodeEnv: parseNodeEnv(environment.NODE_ENV),
    host: environment.HOST?.trim() || "0.0.0.0",
    port: parsePort(environment.PORT),
    databaseUrl: parseRequired(environment.DATABASE_URL, "DATABASE_URL"),
  };
}
