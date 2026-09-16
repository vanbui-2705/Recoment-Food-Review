import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Fastify from "fastify";

import { registerErrorHandlers } from "./common/errors/error-handler.js";
import { healthRoutes } from "./modules/health/health.route.js";
import { databasePlugin } from "./plugins/database.plugin.js";

export type BuildAppOptions = {
  logger?: boolean;
  database?: boolean;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  registerErrorHandlers(app);

  if (options.database ?? true) {
    app.register(databasePlugin);
  }

  app.register(healthRoutes);

  return app;
}
