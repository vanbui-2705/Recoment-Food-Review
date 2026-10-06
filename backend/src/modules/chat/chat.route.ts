import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { ChatContextSchema } from "./chat.policy.js";
import { createChatService } from "./chat.service.js";
const Id = Type.Object({ id: Type.String({ format: "uuid" }) }, { additionalProperties: false });
const Cursor = Type.Object(
  { after: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })) },
  { additionalProperties: false },
);
export const chatRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", app.authenticate);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  const service = createChatService(app.prisma);
  const rate = createRateLimitHook({ keyPrefix: "chat-write", limit: 20, windowMs: 60000 });
  app.get(
    "/conversations",
    {
      schema: {
        querystring: Type.Object(
          { page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const rows = await service.list(request.authUser!.id, request.query.page ?? 1);
      return {
        data: {
          configured: service.configured,
          items: rows.slice(0, 20),
          hasMore: rows.length > 20,
        },
      };
    },
  );
  app.post("/conversations", { preHandler: rate }, async (request, reply) =>
    reply.code(201).send({ data: await service.create(request.authUser!.id) }),
  );
  app.get("/conversations/:id", { schema: { params: Id } }, async (request) => ({
    data: await service.detail(request.authUser!.id, request.params.id),
  }));
  app.delete(
    "/conversations/:id",
    {
      preHandler: rate,
      schema: {
        params: Id,
        body: Type.Object({ confirm: Type.Literal(true) }, { additionalProperties: false }),
      },
    },
    async (request) => ({ data: await service.remove(request.authUser!.id, request.params.id) }),
  );
  app.post(
    "/conversations/:id/messages",
    {
      preHandler: rate,
      schema: {
        params: Id,
        body: Type.Object(
          {
            text: Type.String({ minLength: 1, maxLength: 4000 }),
            idempotencyKey: Type.String({ format: "uuid" }),
            context: Type.Optional(ChatContextSchema),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => ({
      data: await service.submit(
        request.authUser!.id,
        request.params.id,
        request.body.text,
        request.body.idempotencyKey,
        request.body.context ?? {},
      ),
    }),
  );
  app.get(
    "/chat-runs/:id/events",
    { schema: { params: Id, querystring: Cursor } },
    async (request) => ({
      data: await service.events(request.authUser!.id, request.params.id, request.query.after ?? 0),
    }),
  );
  app.post(
    "/chat-runs/:id/cancel",
    { preHandler: rate, schema: { params: Id } },
    async (request) => ({ data: await service.cancel(request.authUser!.id, request.params.id) }),
  );
  app.get(
    "/chat-runs/:id/stream",
    { schema: { params: Id, querystring: Cursor } },
    async (request, reply) => {
      let after = request.query.after ?? 0;
      let batch = await service.events(request.authUser!.id, request.params.id, after);
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      });
      let closed = false;
      const stop = () => {
        closed = true;
      };
      reply.raw.once("close", stop);
      const deadline = Date.now() + 45000;
      try {
        do {
          for (const event of batch.events) {
            if (closed) break;
            reply.raw.write(
              `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify({ seq: event.seq, type: event.type, payload: event.payload })}\n\n`,
            );
            after = event.seq;
          }
          if (!active(batch.status) || closed || Date.now() >= deadline) break;
          reply.raw.write(": heartbeat\n\n");
          await new Promise<void>((resolve) => {
            const timer = setTimeout(done, 1000);
            function done() {
              clearTimeout(timer);
              reply.raw.off("close", done);
              resolve();
            }
            reply.raw.once("close", done);
          });
          if (closed) break;
          batch = await service.events(request.authUser!.id, request.params.id, after);
        } while (!closed);
      } catch {
        if (!closed)
          reply.raw.write(
            `event: ERROR\ndata: ${JSON.stringify({ type: "ERROR", payload: { code: "CHAT_STREAM_INTERRUPTED" } })}\n\n`,
          );
      } finally {
        reply.raw.off("close", stop);
        if (!closed) reply.raw.end();
      }
    },
  );
};
const active = (status: string) => status === "QUEUED" || status === "RUNNING";
