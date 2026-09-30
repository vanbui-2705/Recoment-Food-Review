import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

import { createTasteProfileRepository } from "./taste-profile.repository.js";
import {
  CatalogResponseSchema,
  ProfilePayloadSchema,
  ProfileResponseSchema,
} from "./taste-profile.schema.js";
import { createTasteProfileService } from "./taste-profile.service.js";

export const tasteProfileRoutes: FastifyPluginAsyncTypebox = async function tasteProfileRoutes(app) {
  const repository = createTasteProfileRepository(app.prisma);
  const service = createTasteProfileService(repository);

  const catalogRoute = (path: "/catalogs/allergens" | "/catalogs/dietary-restrictions" | "/catalogs/cuisines") => {
    app.get(
      path,
      {
        preHandler: app.authenticate,
        schema: { response: { 200: CatalogResponseSchema } },
      },
      async (_request, reply) => {
        const kind = path.slice("/catalogs/".length) as "allergens" | "dietary-restrictions" | "cuisines";
        return reply.status(200).send({ data: { items: await service.listCatalog(kind) } });
      },
    );
  };

  catalogRoute("/catalogs/allergens");
  catalogRoute("/catalogs/dietary-restrictions");
  catalogRoute("/catalogs/cuisines");

  app.get(
    "/users/me/profile",
    {
      preHandler: app.authenticate,
      schema: { response: { 200: ProfileResponseSchema } },
    },
    async (request, reply) => {
      if (!request.authUser) {
        throw new Error("Authenticated user missing after authentication hook");
      }

      return reply.status(200).send({ data: { profile: await service.getProfile(request.authUser.id) } });
    },
  );

  app.put(
    "/users/me/profile",
    {
      preHandler: app.authenticate,
      schema: { body: ProfilePayloadSchema, response: { 200: ProfileResponseSchema } },
    },
    async (request, reply) => {
      if (!request.authUser) {
        throw new Error("Authenticated user missing after authentication hook");
      }

      const profile = await service.saveProfile(request.authUser.id, request.body, false);
      return reply.status(200).send({ data: { profile } });
    },
  );

  app.post(
    "/users/me/onboarding",
    {
      preHandler: app.authenticate,
      schema: { body: ProfilePayloadSchema, response: { 200: ProfileResponseSchema } },
    },
    async (request, reply) => {
      if (!request.authUser) {
        throw new Error("Authenticated user missing after authentication hook");
      }

      const profile = await service.saveProfile(request.authUser.id, request.body, true);
      return reply.status(200).send({ data: { profile } });
    },
  );
};
