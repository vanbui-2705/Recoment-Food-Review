import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
import { loadAiConfig } from "../ai/ai.config.js";
import { AiError, createGeminiProvider, type StructuredAiProvider } from "../ai/ai.provider.js";
import { createRecommendationService } from "../recommendations/recommendation.service.js";
import { createDiscoveryService } from "../discovery/discovery.service.js";
import {
  CHAT_INSTRUCTION,
  ChatPlanSchema,
  chatReplies,
  mergeChatContext,
  validateChatPlan,
  type ChatContext,
  type ChatPlan,
} from "./chat.policy.js";
const active = ["QUEUED", "RUNNING"];
function notFound(): never {
  throw new AppError(404, "CONVERSATION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện của bạn");
}
type Tool = ChatPlan["tools"][number];
type ToolResult = { status: string; references: Prisma.InputJsonObject[] };
export type ChatDispatcher = (
  userId: string,
  tool: Tool,
  context: ChatContext,
  key: string,
  signal?: AbortSignal,
) => Promise<ToolResult>;
export function createChatService(
  prisma: PrismaClient,
  env = process.env,
  injectedProvider?: StructuredAiProvider,
  injectedDispatcher?: ChatDispatcher,
) {
  const config = loadAiConfig(env),
    provider = injectedProvider ?? createGeminiProvider(config);
  const timeoutMs = Number(env.CHAT_RUN_TIMEOUT_MS?.trim() || 90000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 90000)
    throw new Error("Invalid CHAT_RUN_TIMEOUT_MS");
  const scopedFetch =
    (signal: AbortSignal): typeof fetch =>
    (input, init) =>
      fetch(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
      });
  const dispatch: ChatDispatcher =
    injectedDispatcher ??
    (async (userId, tool, context, key, signal) => {
      const fetcher = signal ? scopedFetch(signal) : fetch;
      const recommendations = createRecommendationService(prisma, env, fetcher),
        discovery = createDiscoveryService(prisma, env, fetcher);
      if (tool.name === "RECOMMEND") {
        const result = await recommendations.recommend(userId, { ...context, idempotencyKey: key });
        return { status: result.status, references: [{ kind: "RECOMMENDATION", id: result.id }] };
      }
      if (tool.name === "RESTAURANTS") {
        const result = await discovery.restaurants(
          userId,
          tool.args.query.trim(),
          undefined,
          context.latitude === undefined
            ? undefined
            : { latitude: context.latitude, longitude: context.longitude! },
          context.radius ?? 3500,
          context.onlyOpen,
        );
        return {
          status: result.status,
          references: result.items
            .slice(0, 4)
            .map((item) => ({ kind: "PLACE", source: item.source, id: item.placeId })),
        };
      }
      if (tool.name === "RECIPES") {
        const result = await discovery.searchRecipes(tool.args.query.trim());
        return {
          status: result.status,
          references: result.items
            .slice(0, 4)
            .map((item) => ({ kind: "RECIPE", source: item.source, id: item.id })),
        };
      }
      const note = await prisma.personalFoodKnowledge.findUnique({
        where: { userId },
        select: { revision: true, analyzedRevision: true },
      });
      const profile = await prisma.tasteProfile.findUnique({
        where: { userId },
        select: { onboardingCompleted: true },
      });
      return {
        status:
          note && note.revision !== note.analyzedRevision
            ? "PROFILE_PENDING_ANALYSIS"
            : !profile?.onboardingCompleted
              ? "ONBOARDING_REQUIRED"
              : "READY",
        references: [],
      };
    });
  async function owned(userId: string, id: string) {
    const conversation = await prisma.conversation.findFirst({ where: { id, userId } });
    if (!conversation) notFound();
    return conversation;
  }
  async function emit(
    tx: Prisma.TransactionClient,
    runId: string,
    type: string,
    payload: Prisma.InputJsonObject,
  ) {
    const run = await tx.chatRun.update({
      where: { id: runId },
      data: { nextSeq: { increment: 1 } },
      select: { nextSeq: true },
    });
    return tx.chatEvent.create({ data: { runId, seq: run.nextSeq, type, payload } });
  }
  async function finish(
    id: string,
    token: string,
    status: "COMPLETED" | "FAILED",
    code: string,
    payload?: Prisma.InputJsonObject,
  ) {
    return prisma.$transaction(async (tx) => {
      const changed = await tx.chatRun.updateMany({
        where: { id, status: "RUNNING", leaseToken: token, leaseUntil: { gt: new Date() } },
        data: {
          status,
          errorCode: status === "FAILED" ? code : null,
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (!changed.count) return false;
      const run = await tx.chatRun.findUniqueOrThrow({ where: { id } });
      if (status === "COMPLETED") {
        const text = chatReplies[code as keyof typeof chatReplies];
        await tx.chatMessage.create({
          data: { conversationId: run.conversationId, role: "ASSISTANT", content: text },
        });
        await emit(tx, id, "RESULT", { replyCode: code, text, ...payload });
      } else await emit(tx, id, "ERROR", { code });
      await emit(tx, id, "DONE", { status });
      return true;
    });
  }
  return {
    configured: provider.configured,
    create: (userId: string) =>
      prisma.conversation.create({
        data: { userId, title: "Cuộc trò chuyện mới" },
        select: { id: true, title: true, createdAt: true },
      }),
    list: (userId: string, page: number) =>
      prisma.conversation.findMany({
        where: { userId },
        select: { id: true, title: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 20,
        take: 21,
      }),
    async detail(userId: string, id: string) {
      const conversation = await owned(userId, id);
      const messages = await prisma.chatMessage.findMany({
        where: { conversationId: id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      });
      const runs = await prisma.chatRun.findMany({
        where: { conversationId: id },
        select: { id: true, messageId: true, status: true, errorCode: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
      });
      return { conversation, messages: messages.reverse(), runs };
    },
    async remove(userId: string, id: string) {
      if (!(await prisma.conversation.deleteMany({ where: { id, userId } })).count) notFound();
      return { deleted: true };
    },
    async submit(userId: string, id: string, text: string, key: string, update: ChatContext) {
      const content = text.trim();
      if (!content) throw new AppError(400, "INVALID_MESSAGE", "Nhập nội dung bạn muốn hỏi");
      if (!provider.configured)
        throw new AppError(503, "AI_NOT_CONFIGURED", "Chat chưa được kết nối AI");
      const hash = createHash("sha256")
        .update(
          JSON.stringify({
            id,
            content,
            update: Object.fromEntries(Object.entries(update).sort()),
          }),
        )
        .digest("hex");
      return serializableWrite(
        prisma,
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM conversations WHERE id=${id}::uuid AND user_id=${userId}::uuid FOR UPDATE`;
          const conversation = await tx.conversation.findFirst({ where: { id, userId } });
          if (!conversation) notFound();
          const idempotencyKey = `${userId}:${key}`;
          const previous = await tx.chatRun.findUnique({ where: { idempotencyKey } });
          if (previous) {
            if (previous.inputHash !== hash)
              throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Mã gửi đã dùng cho tin nhắn khác");
            return { id: previous.id, status: previous.status, replay: true };
          }
          if (await tx.chatRun.count({ where: { conversationId: id, status: { in: active } } }))
            throw new AppError(
              409,
              "CHAT_RUN_ACTIVE",
              "Hãy chờ hoặc hủy lượt đang xử lý trước khi gửi tiếp",
            );
          const settings = await tx.discoverySettings.findUnique({ where: { userId } });
          const saved: ChatContext = settings
            ? {
                budget: settings.budget,
                radius: settings.radius,
                onlyOpen: settings.onlyOpen,
                ...(settings.latitude === null || settings.longitude === null
                  ? {}
                  : { latitude: settings.latitude, longitude: settings.longitude }),
              }
            : {};
          const context = mergeChatContext(
            { ...saved, ...(conversation.context as ChatContext) },
            update,
          );
          const note = await tx.personalFoodKnowledge.findUnique({
            where: { userId },
            select: { revision: true },
          });
          const message = await tx.chatMessage.create({
            data: { conversationId: id, role: "USER", content },
          });
          const run = await tx.chatRun.create({
            data: {
              conversationId: id,
              messageId: message.id,
              idempotencyKey,
              inputHash: hash,
              context: { ...context, profileRevision: note?.revision ?? 0 },
            },
          });
          await tx.conversation.update({
            where: { id },
            data: {
              context,
              title:
                conversation.title === "Cuộc trò chuyện mới"
                  ? content.slice(0, 100)
                  : conversation.title,
            },
          });
          await emit(tx, run.id, "STATUS", { status: "QUEUED" });
          return { id: run.id, status: run.status, replay: false };
        },
        true,
      );
    },
    async events(userId: string, id: string, after: number) {
      const run = await prisma.chatRun.findFirst({
        where: { id, conversation: { userId } },
        select: { id: true, status: true },
      });
      if (!run) notFound();
      return {
        status: run.status,
        events: await prisma.chatEvent.findMany({
          where: { runId: id, seq: { gt: after } },
          orderBy: { seq: "asc" },
          take: 100,
        }),
      };
    },
    async cancel(userId: string, id: string) {
      return prisma.$transaction(async (tx) => {
        const run = await tx.chatRun.findFirst({ where: { id, conversation: { userId } } });
        if (!run) notFound();
        const changed = await tx.chatRun.updateMany({
          where: { id, status: { in: active } },
          data: { status: "CANCELLED", leaseToken: null, leaseUntil: null },
        });
        if (changed.count) await emit(tx, id, "DONE", { status: "CANCELLED" });
        return {
          status: changed.count
            ? "CANCELLED"
            : (await tx.chatRun.findUniqueOrThrow({ where: { id }, select: { status: true } }))
                .status,
        };
      });
    },
    async tick(scopeUserId?: string) {
      const token = randomUUID(),
        now = new Date(),
        lease = new Date(+now + 120000);
      const claimed = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string; attempts: number }>
        >`SELECT r.id, r.attempts FROM chat_runs r JOIN conversations c ON c.id=r.conversation_id WHERE (${scopeUserId ?? null}::uuid IS NULL OR c.user_id=${scopeUserId ?? null}::uuid) AND (r.status='QUEUED' OR (r.status='RUNNING' AND r.lease_until < ${now})) ORDER BY r.created_at FOR UPDATE OF r SKIP LOCKED LIMIT 1`;
        if (!rows[0]) return null;
        if (rows[0].attempts >= config.maxAttempts) {
          await tx.chatRun.update({
            where: { id: rows[0].id },
            data: {
              status: "FAILED",
              errorCode: "CHAT_ATTEMPTS_EXHAUSTED",
              leaseToken: null,
              leaseUntil: null,
            },
          });
          await emit(tx, rows[0].id, "ERROR", { code: "CHAT_ATTEMPTS_EXHAUSTED" });
          await emit(tx, rows[0].id, "DONE", { status: "FAILED" });
          return null;
        }
        return tx.chatRun.update({
          where: { id: rows[0].id },
          data: {
            status: "RUNNING",
            leaseToken: token,
            leaseUntil: lease,
            attempts: { increment: 1 },
          },
          include: { conversation: true },
        });
      });
      if (!claimed) return false;
      const deadline = +now + timeoutMs;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const timeoutError = () => new AppError(504, "CHAT_DEADLINE", "Lượt tìm món quá thời gian");
      async function bounded<T>(work: Promise<T>): Promise<T> {
        if (controller.signal.aborted) throw timeoutError();
        let rejectTimeout!: () => void;
        const timedOut = new Promise<never>((_resolve, reject) => {
          rejectTimeout = () => reject(timeoutError());
          controller.signal.addEventListener("abort", rejectTimeout, { once: true });
        });
        try {
          return await Promise.race([work, timedOut]);
        } finally {
          controller.signal.removeEventListener("abort", rejectTimeout);
        }
      }
      async function guard() {
        if (Date.now() > deadline)
          throw new AppError(504, "CHAT_DEADLINE", "Lượt tìm món quá thời gian");
        if (
          !(await prisma.chatRun.count({
            where: { id: claimed!.id, status: "RUNNING", leaseToken: token },
          }))
        )
          throw new AppError(409, "CHAT_CANCELLED", "Lượt tìm đã hủy");
      }
      try {
        if (claimed.attempts > config.maxAttempts)
          throw new AppError(503, "CHAT_ATTEMPTS_EXHAUSTED", "Lượt xử lý bị gián đoạn nhiều lần");
        await guard();
        const day = new Date().toISOString().slice(0, 10);
        const reserved = await prisma.$queryRaw<
          Array<{ requests: number }>
        >`INSERT INTO ai_request_usage(day,requests) VALUES (${day},1) ON CONFLICT(day) DO UPDATE SET requests=ai_request_usage.requests+1 WHERE ai_request_usage.requests < ${config.dailyRequests} RETURNING requests`;
        if (!reserved.length) throw new AiError("AI_QUOTA_EXCEEDED");
        const messages = await prisma.chatMessage.findMany({
          where: { conversationId: claimed.conversationId },
          select: { role: true, content: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 12,
        });
        const modelMessages = messages.reverse();
        while (
          modelMessages.length > 1 &&
          Buffer.byteLength(JSON.stringify(modelMessages), "utf8") > 30000
        )
          modelMessages.shift();
        const runProvider =
          injectedProvider ?? createGeminiProvider(config, scopedFetch(controller.signal));
        let plan = validateChatPlan(
          await bounded(
            runProvider.generate(
              CHAT_INSTRUCTION,
              { messages: modelMessages, context: claimed.context },
              ChatPlanSchema,
            ),
          ),
        );
        await guard();
        const { profileRevision, ...context } = claimed.context as ChatContext & {
          profileRevision: number;
        };
        const note = await prisma.personalFoodKnowledge.findUnique({
          where: { userId: claimed.conversation.userId },
          select: { revision: true },
        });
        if ((note?.revision ?? 0) !== profileRevision)
          throw new AppError(409, "RECOMMENDATION_PROFILE_CHANGED", "Khẩu vị đã thay đổi");
        if (plan.tools.some((t) => t.name === "RECOMMEND") && context.budget === undefined)
          plan = { reply: "ASK_BUDGET", tools: [] };
        else if (
          plan.tools.some((t) => t.name === "RECOMMEND" || t.name === "RESTAURANTS") &&
          context.latitude === undefined
        )
          plan = { reply: "ASK_LOCATION", tools: [] };
        const results: Prisma.InputJsonObject[] = [];
        for (const tool of plan.tools) {
          await guard();
          const result = await bounded(
            dispatch(
              claimed.conversation.userId,
              tool,
              context,
              claimed.messageId,
              controller.signal,
            ),
          );
          await guard();
          results.push({ tool: tool.name, status: result.status, references: result.references });
        }
        await guard();
        await finish(claimed.id, token, "COMPLETED", plan.reply, { results });
      } catch (error) {
        const code =
          error instanceof AppError
            ? error.code
            : error instanceof AiError
              ? error.code
              : "CHAT_UNAVAILABLE";
        await finish(claimed.id, token, "FAILED", code).catch(() => {});
      } finally {
        clearTimeout(timer);
        controller.abort();
      }
      return true;
    },
  };
}
