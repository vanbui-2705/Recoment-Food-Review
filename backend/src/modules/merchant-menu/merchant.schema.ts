import { Type, type Static } from "@fastify/type-provider-typebox";
import { Check } from "typebox/value";
import { AppError } from "../../common/errors/app-error.js";

const text = (max: number) => Type.String({ minLength: 1, maxLength: max });
export const SupplierWriteSchema = Type.Object(
  {
    code: Type.String({ pattern: "^[a-z0-9_-]{1,80}$" }),
    name: text(200),
    documentationUrl: text(2000),
    authorizationReference: text(500),
    maxEvidenceAgeHours: Type.Integer({ minimum: 1, maximum: 168 }),
    enabled: Type.Boolean(),
  },
  { additionalProperties: false },
);
export const MenuRowSchema = Type.Object(
  {
    restaurant: Type.Object(
      {
        externalId: text(255),
        name: text(200),
        address: text(500),
        latitude: Type.Number({ minimum: -90, maximum: 90 }),
        longitude: Type.Number({ minimum: -180, maximum: 180 }),
      },
      { additionalProperties: false },
    ),
    externalId: text(255),
    title: text(200),
    optionLabel: Type.Optional(text(200)),
    price: Type.Integer({ minimum: 0, maximum: 100000000 }),
    currency: Type.Literal("VND"),
    isAvailable: Type.Boolean(),
    sourceUrl: text(2000),
    observedAt: Type.String({ format: "date-time" }),
    expiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);
export type MenuRow = Static<typeof MenuRowSchema>;
export const SyncStartSchema = Type.Object(
  {
    supplierId: Type.String({ format: "uuid" }),
    snapshotId: text(255),
    mode: Type.Union([Type.Literal("COMPLETE"), Type.Literal("DELTA")]),
    expectedPages: Type.Integer({ minimum: 1, maximum: 10 }),
    observedAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);
export const PageSchema = Type.Object(
  {
    page: Type.Integer({ minimum: 0, maximum: 9 }),
    items: Type.Array(Type.Unknown(), { maxItems: 100 }),
  },
  { additionalProperties: false },
);
export const EvidenceSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("ALLERGEN"),
      Type.Literal("DIET"),
      Type.Literal("CROSS_CONTACT"),
    ]),
    code: Type.String({ pattern: "^[A-Z0-9_]{1,80}$" }),
    claim: Type.Union([Type.Literal("PRESENT"), Type.Literal("ABSENT"), Type.Literal("UNKNOWN")]),
    sourceUrl: text(2000),
    excerpt: text(2000),
    observedAt: Type.String({ format: "date-time" }),
    expiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);
export type EvidenceInput = Static<typeof EvidenceSchema>;
export function evidenceUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, "INVALID_SOURCE_URL", "Nguồn phải là URL HTTPS hợp lệ");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    [...url.searchParams.keys()].some((k) => /key|token|secret|auth|signature/i.test(k))
  )
    throw new AppError(
      400,
      "INVALID_SOURCE_URL",
      "Nguồn không được chứa thông tin truy cập riêng tư",
    );
  return url.href;
}
export function checkFreshness(
  observedAt: string,
  expiresAt: string,
  maxHours: number,
  now = new Date(),
) {
  const observed = new Date(observedAt),
    expires = new Date(expiresAt);
  if (
    !Number.isFinite(+observed) ||
    !Number.isFinite(+expires) ||
    observed > new Date(+now + 300000) ||
    expires <= now ||
    expires <= observed ||
    +expires - +observed > maxHours * 3600000
  )
    throw new AppError(400, "INVALID_FRESHNESS", "Thời hạn hoặc thời điểm dữ liệu không hợp lệ");
  return { observedAt: observed, expiresAt: expires };
}
export function validateMenuRow(value: unknown, maxHours: number, now = new Date()): MenuRow {
  if (!Check(MenuRowSchema, value))
    throw new AppError(400, "INVALID_MENU_ROW", "Dòng thực đơn không đúng hợp đồng dữ liệu");
  const row = value as MenuRow;
  if (
    [
      row.title,
      row.externalId,
      row.restaurant.externalId,
      row.restaurant.name,
      row.restaurant.address,
      row.optionLabel ?? "valid",
    ].some((v) => !v.trim())
  )
    throw new AppError(
      400,
      "INVALID_MENU_ROW",
      "Thông tin thực đơn không được chỉ chứa khoảng trắng",
    );
  evidenceUrl(row.sourceUrl);
  checkFreshness(row.observedAt, row.expiresAt, maxHours, now);
  return row;
}
