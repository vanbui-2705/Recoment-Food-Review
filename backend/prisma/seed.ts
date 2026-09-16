import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { Pool } from "pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { UserRole } from "../src/generated/prisma/enums.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL chưa được cấu hình");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const allergens = [
  { code: "PEANUT", name: "Đậu phộng" },
  { code: "TREE_NUT", name: "Các loại hạt cây" },
  { code: "SHELLFISH", name: "Động vật có vỏ" },
  { code: "FISH", name: "Cá" },
  { code: "MILK", name: "Sữa" },
  { code: "EGG", name: "Trứng" },
  { code: "SOY", name: "Đậu nành" },
  { code: "WHEAT_GLUTEN", name: "Lúa mì và gluten" },
  { code: "SESAME", name: "Mè" },
] as const;

const dietaryRestrictions = [
  { code: "VEGETARIAN", name: "Ăn chay có trứng/sữa" },
  { code: "VEGAN", name: "Thuần chay" },
  { code: "HALAL", name: "Halal" },
  { code: "KOSHER", name: "Kosher" },
  { code: "GLUTEN_FREE", name: "Không gluten" },
] as const;

const cuisines = [
  { code: "VIETNAMESE", name: "Việt Nam" },
  { code: "CHINESE", name: "Trung Quốc" },
  { code: "JAPANESE", name: "Nhật Bản" },
  { code: "KOREAN", name: "Hàn Quốc" },
  { code: "THAI", name: "Thái Lan" },
  { code: "INDIAN", name: "Ấn Độ" },
  { code: "ITALIAN", name: "Ý" },
  { code: "FRENCH", name: "Pháp" },
  { code: "AMERICAN", name: "Mỹ" },
  { code: "MEXICAN", name: "Mexico" },
] as const;

async function seedCatalogs(): Promise<void> {
  await prisma.$transaction([
    ...allergens.map((item) =>
      prisma.allergen.upsert({
        where: { code: item.code },
        update: { name: item.name },
        create: item,
      }),
    ),
    ...dietaryRestrictions.map((item) =>
      prisma.dietaryRestriction.upsert({
        where: { code: item.code },
        update: { name: item.name },
        create: item,
      }),
    ),
    ...cuisines.map((item) =>
      prisma.cuisine.upsert({
        where: { code: item.code },
        update: { name: item.name },
        create: item,
      }),
    ),
  ]);

  console.log(
    `Đã seed ${allergens.length} allergens, ${dietaryRestrictions.length} dietary restrictions và ${cuisines.length} cuisines`,
  );
}

async function main(): Promise<void> {
  await seedCatalogs();

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("Bỏ qua development admin: thiếu SEED_ADMIN_EMAIL hoặc SEED_ADMIN_PASSWORD");
    return;
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  await prisma.user.upsert({
    where: { email },
    update: {
      displayName: "Development Admin",
      passwordHash,
      role: UserRole.ADMIN,
    },
    create: {
      email,
      displayName: "Development Admin",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  console.log(`Đã seed development admin: ${email}`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
  await pool.end();
}
