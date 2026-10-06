import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { AppError } from "../../common/errors/app-error.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { providerJson, safeUrl } from "../discovery/provider.http.js";
export const placePhotoRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    "/places/photo",
    {
      preHandler: [
        app.authenticate,
        createRateLimitHook({ keyPrefix: "place-photo", limit: 60, windowMs: 60000 }),
      ],
      schema: {
        querystring: Type.Object(
          {
            name: Type.String({
              maxLength: 1000,
              pattern: "^places/[A-Za-z0-9_-]+/photos/[A-Za-z0-9_-]+$",
            }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req, reply) => {
      reply.header("Cache-Control", "private, no-store");
      const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
      if (!key) throw new AppError(503, "PLACES_NOT_CONFIGURED", "Nguồn ảnh chưa được cấu hình");
      try {
        const data = await providerJson(
          "google-photos",
          `https://places.googleapis.com/v1/${req.query.name}/media?maxWidthPx=640&skipHttpRedirect=true`,
          { headers: { "X-Goog-Api-Key": key } },
        );
        const imageUrl = safeUrl(data.photoUri);
        if (!imageUrl) throw new Error("Invalid image");
        const host = new URL(imageUrl).hostname;
        if (!(host.endsWith(".googleusercontent.com") || host.endsWith(".ggpht.com")))
          throw new Error("Invalid image host");
        return { data: { imageUrl } };
      } catch {
        throw new AppError(503, "PLACE_PHOTO_UNAVAILABLE", "Chưa tải được ảnh của quán");
      }
    },
  );
};
