import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
import { foodIdentity } from "../food/food.identity.js";
import { REPEAT_WINDOW_MS } from "../food/food.policy.js";

type Kind = "DISH" | "RECIPE";
type Cursor = { at: string; id: string; kind: Kind };
type Db = PrismaClient | Prisma.TransactionClient;
const cooldownTypes = ["CHOSEN", "EATEN"] as const;
function missing(): never {
  throw new AppError(404, "HISTORY_NOT_FOUND", "Không tìm thấy bản ghi của bạn");
}
function decode(value?: string): Cursor | undefined {
  if (!value) return;
  try {
    const item = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    if (
      Object.keys(item).sort().join() !== "at,id,kind" ||
      !/^[0-9a-f-]{36}$/i.test(item.id) ||
      !["DISH", "RECIPE"].includes(item.kind) ||
      !Number.isFinite(Date.parse(item.at)) ||
      new Date(item.at).toISOString() !== item.at
    )
      throw new Error("Invalid cursor");
    return item;
  } catch {
    throw new AppError(400, "INVALID_HISTORY_CURSOR", "Trang nhật ký không hợp lệ; hãy tải lại");
  }
}
export function createHistoryService(prisma: PrismaClient) {
  async function list(
    userId: string,
    input: { cursor?: string; kind?: Kind; type?: "CHOSEN" | "EATEN"; limit?: number },
  ) {
    const cursor = decode(input.cursor),
      limit = input.limit ?? 20;
    function older(kind: Kind) {
      if (!cursor) return {};
      const at = new Date(cursor.at);
      return {
        OR: [
          { createdAt: { lt: at } },
          ...(kind < cursor.kind ? [{ createdAt: at }] : []),
          ...(kind === cursor.kind ? [{ createdAt: at, id: { lt: cursor.id } }] : []),
        ],
      };
    }
    const interactionType = input.type ?? { in: [...cooldownTypes] };
    const [dishes, recipes] = await Promise.all([
      input.kind === "RECIPE"
        ? []
        : prisma.userInteraction.findMany({
            where: { userId, interactionType, ...older("DISH") },
            select: {
              id: true,
              createdAt: true,
              interactionType: true,
              dish: { select: { name: true } },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
          }),
      input.kind === "DISH"
        ? []
        : prisma.recipeInteraction.findMany({
            where: { userId, interactionType, ...older("RECIPE") },
            select: {
              id: true,
              createdAt: true,
              interactionType: true,
              title: true,
              source: true,
              recipeId: true,
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
          }),
    ]);
    const all = [
      ...dishes.map(({ dish, ...row }) => ({ ...row, kind: "DISH" as Kind, title: dish.name })),
      ...recipes.map((row) => ({ ...row, kind: "RECIPE" as Kind })),
    ].sort(
      (a, b) =>
        +b.createdAt - +a.createdAt || b.kind.localeCompare(a.kind) || b.id.localeCompare(a.id),
    );
    const items = all
      .slice(0, limit)
      .map((row) => ({ ...row, eligibleAgainAt: new Date(+row.createdAt + REPEAT_WINDOW_MS) }));
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        all.length > limit && last
          ? Buffer.from(
              JSON.stringify({ at: last.createdAt.toISOString(), id: last.id, kind: last.kind }),
            ).toString("base64url")
          : null,
    };
  }
  async function preview(db: Db, userId: string, kind: Kind, id: string, now = new Date()) {
    const targetDish =
      kind === "DISH"
        ? await db.userInteraction.findFirst({
            where: { id, userId },
            include: { dish: { include: { aliases: true } } },
          })
        : null;
    const targetRecipe =
      kind === "RECIPE" ? await db.recipeInteraction.findFirst({ where: { id, userId } }) : null;
    if (!targetDish && !targetRecipe) missing();
    const names = new Set(
      targetDish
        ? [targetDish.dish.name, ...targetDish.dish.aliases.map((a) => a.alias)].map(foodIdentity)
        : [targetRecipe!.canonicalName],
    );
    const since = new Date(+now - REPEAT_WINDOW_MS);
    // Read predicates inside the deletion transaction too: a concurrent new meal
    // must trigger serialization retry rather than silently changing this preview.
    const dishes = await db.userInteraction.findMany({
      where: { userId, createdAt: { gt: since }, interactionType: { in: [...cooldownTypes] } },
      include: { dish: { include: { aliases: true } } },
    });
    const recipes = await db.recipeInteraction.findMany({
      where: { userId, createdAt: { gt: since }, interactionType: { in: [...cooldownTypes] } },
    });
    const related = [
      ...dishes
        .filter((row) =>
          targetDish
            ? row.dishId === targetDish.dishId
            : [row.dish.name, ...row.dish.aliases.map((a) => a.alias)]
                .map(foodIdentity)
                .some((name) => names.has(name)),
        )
        .map((row) => ({ id: row.id, kind: "DISH", at: row.createdAt })),
      ...recipes
        .filter((row) => names.has(row.canonicalName))
        .map((row) => ({ id: row.id, kind: "RECIPE", at: row.createdAt })),
    ];
    const remaining = related.filter((row) => row.kind !== kind || row.id !== id);
    const after = remaining.length
      ? new Date(Math.max(...remaining.map((row) => +row.at)) + REPEAT_WINDOW_MS)
      : null;
    const target = targetDish ?? targetRecipe!;
    const expectedVersion = createHash("sha256")
      .update(
        JSON.stringify({
          kind,
          id,
          at: target.createdAt,
          rows: related.sort((a, b) => a.id.localeCompare(b.id)),
        }),
      )
      .digest("hex");
    return {
      id,
      kind,
      title: targetDish?.dish.name ?? targetRecipe!.title,
      expectedVersion,
      eligibleAgainAtAfterDeletion: after,
      remainingCooldownRecords: remaining.length,
      notice: after
        ? "Lần chọn hoặc ăn khác vẫn giữ thời gian chờ cho món này."
        : "Xóa bản ghi này có thể đưa món trở lại danh sách gợi ý. Các ràng buộc dị ứng và chế độ ăn vẫn được giữ.",
    };
  }
  return {
    list,
    preview: (userId: string, kind: Kind, id: string) => preview(prisma, userId, kind, id),
    remove: (userId: string, kind: Kind, id: string, expectedVersion: string) =>
      serializableWrite(prisma, async (tx) => {
        const current = await preview(tx, userId, kind, id);
        if (current.expectedVersion !== expectedVersion)
          throw new AppError(
            409,
            "HISTORY_CHANGED",
            "Nhật ký đã thay đổi; hãy xem lại ảnh hưởng trước khi xóa",
          );
        const deleted =
          kind === "DISH"
            ? await tx.userInteraction.deleteMany({ where: { id, userId } })
            : await tx.recipeInteraction.deleteMany({ where: { id, userId } });
        if (!deleted.count) missing();
        return { deleted: true, eligibleAgainAt: current.eligibleAgainAtAfterDeletion };
      }),
  };
}
