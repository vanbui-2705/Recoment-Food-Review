import { PrismaPg } from "@prisma/adapter-pg";
import fastifyPlugin from "fastify-plugin";
import { Pool } from "pg";

import { loadEnv } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const databasePlugin = fastifyPlugin(
  async (app) => {
    const config = loadEnv();
    const pool = new Pool({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: 5_000,
      max: 10,
    });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    await prisma.$connect();
    app.decorate("prisma", prisma);

    app.addHook("onClose", async () => {
      await prisma.$disconnect();
      await pool.end();
    });
  },
  { name: "database" },
);
