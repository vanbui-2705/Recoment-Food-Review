import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Fastify from "fastify";

import { registerErrorHandlers } from "./common/errors/error-handler.js";
import { adminRoutes } from "./modules/admin/admin.route.js";
import { authRoutes } from "./modules/auth/auth.route.js";
import { healthRoutes } from "./modules/health/health.route.js";
import { tasteProfileRoutes } from "./modules/taste-profile/taste-profile.route.js";
import { foodRoutes } from "./modules/food/food.route.js";
import { discoveryRoutes } from "./modules/discovery/discovery.route.js";
import { personalFoodKnowledgeRoutes } from "./modules/personal-food-knowledge/personal-food-knowledge.route.js";
import { usersRoutes } from "./modules/users/users.route.js";
import { authPlugin } from "./plugins/auth.plugin.js";
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
    app.register(authPlugin);
    app.register(authRoutes);
    app.register(usersRoutes);
    app.register(tasteProfileRoutes);
    app.register(adminRoutes);
    app.register(foodRoutes);
    app.register(discoveryRoutes);
    app.register(personalFoodKnowledgeRoutes);
  }

  app.register(healthRoutes);

  return app;
}
