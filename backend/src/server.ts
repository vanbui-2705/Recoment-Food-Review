import "dotenv/config";

import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

const config = loadEnv();
const app = buildApp({ logger: true });

async function start(): Promise<void> {
  try {
    const address = await app.listen({
      port: config.port,
      host: config.host,
    });

    app.log.info({ address, environment: config.nodeEnv }, "Server started");
  } catch (error) {
    app.log.error({ err: error }, "Could not start server");
    process.exitCode = 1;
  }
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, "Shutting down server");

  try {
    await app.close();
  } catch (error) {
    app.log.error({ err: error }, "Graceful shutdown failed");
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

void start();
