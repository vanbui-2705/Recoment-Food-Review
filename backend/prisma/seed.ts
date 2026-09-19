import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import argon2 from "argon2";
import { Pool } from "pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  AllergenPresence,
  RestaurantBusinessStatus,
  UserRole,
  VerificationStatus,
} from "../src/generated/prisma/enums.js";

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

const ingredients = [
  { code: "RICE_NOODLE", name: "Bánh phở/bún gạo" },
  { code: "BEEF", name: "Thịt bò" },
  { code: "PORK", name: "Thịt heo" },
  { code: "RICE", name: "Gạo" },
  { code: "WHEAT_BREAD", name: "Bánh mì lúa mì" },
  { code: "FISH_SAUCE", name: "Nước mắm" },
  { code: "SOY_SAUCE", name: "Nước tương" },
  { code: "PEANUT", name: "Đậu phộng" },
  { code: "EGG", name: "Trứng" },
  { code: "SHRIMP", name: "Tôm" },
  { code: "RICE_PAPER", name: "Bánh tráng gạo" },
  { code: "FRESH_HERBS", name: "Rau thơm" },
  { code: "PICKLED_VEGETABLES", name: "Đồ chua" },
  { code: "SCALLION_OIL", name: "Mỡ hành" },
] as const;

const dishes = [
  {
    slug: "pho-bo",
    name: "Phở bò",
    description: "Phở nước với bánh phở, nước dùng và thịt bò.",
    priceMin: 40_000,
    priceMax: 90_000,
    spicyLevel: 15,
    sweetLevel: 25,
    sourLevel: 10,
    saltyLevel: 55,
    aliases: ["Phở bò", "Beef pho"],
    ingredients: [
      { code: "RICE_NOODLE", isPrimary: true },
      { code: "BEEF", isPrimary: true },
      { code: "FISH_SAUCE", isPrimary: false },
      { code: "FRESH_HERBS", isPrimary: false },
    ],
    allergens: [{ code: "FISH", presence: AllergenPresence.CONTAINS }],
  },
  {
    slug: "banh-mi-thit",
    name: "Bánh mì thịt",
    description: "Bánh mì kẹp thịt heo, đồ chua và rau thơm.",
    priceMin: 20_000,
    priceMax: 60_000,
    spicyLevel: 20,
    sweetLevel: 30,
    sourLevel: 25,
    saltyLevel: 55,
    aliases: ["Bánh mì thịt", "Vietnamese pork sandwich"],
    ingredients: [
      { code: "WHEAT_BREAD", isPrimary: true },
      { code: "PORK", isPrimary: true },
      { code: "PICKLED_VEGETABLES", isPrimary: false },
      { code: "FRESH_HERBS", isPrimary: false },
    ],
    allergens: [{ code: "WHEAT_GLUTEN", presence: AllergenPresence.CONTAINS }],
  },
  {
    slug: "bun-cha",
    name: "Bún chả",
    description: "Bún gạo ăn cùng thịt heo nướng, rau và nước chấm.",
    priceMin: 35_000,
    priceMax: 80_000,
    spicyLevel: 20,
    sweetLevel: 40,
    sourLevel: 30,
    saltyLevel: 55,
    aliases: ["Bún chả", "Bun cha Hanoi"],
    ingredients: [
      { code: "RICE_NOODLE", isPrimary: true },
      { code: "PORK", isPrimary: true },
      { code: "FISH_SAUCE", isPrimary: false },
      { code: "FRESH_HERBS", isPrimary: false },
    ],
    allergens: [{ code: "FISH", presence: AllergenPresence.CONTAINS }],
  },
  {
    slug: "goi-cuon-tom-thit",
    name: "Gỏi cuốn tôm thịt",
    description: "Bánh tráng cuốn tôm, thịt, bún và rau thơm.",
    priceMin: 25_000,
    priceMax: 70_000,
    spicyLevel: 5,
    sweetLevel: 20,
    sourLevel: 15,
    saltyLevel: 35,
    aliases: ["Gỏi cuốn", "Vietnamese fresh spring rolls"],
    ingredients: [
      { code: "RICE_PAPER", isPrimary: true },
      { code: "SHRIMP", isPrimary: true },
      { code: "PORK", isPrimary: false },
      { code: "RICE_NOODLE", isPrimary: false },
      { code: "FRESH_HERBS", isPrimary: false },
    ],
    allergens: [
      { code: "SHELLFISH", presence: AllergenPresence.CONTAINS },
      { code: "PEANUT", presence: AllergenPresence.MAY_CONTAIN },
    ],
  },
  {
    slug: "com-tam-suon-trung",
    name: "Cơm tấm sườn trứng",
    description: "Cơm tấm với sườn heo nướng, trứng và mỡ hành.",
    priceMin: 35_000,
    priceMax: 85_000,
    spicyLevel: 15,
    sweetLevel: 35,
    sourLevel: 20,
    saltyLevel: 60,
    aliases: ["Cơm tấm sườn trứng", "Broken rice with pork and egg"],
    ingredients: [
      { code: "RICE", isPrimary: true },
      { code: "PORK", isPrimary: true },
      { code: "EGG", isPrimary: true },
      { code: "FISH_SAUCE", isPrimary: false },
      { code: "SCALLION_OIL", isPrimary: false },
    ],
    allergens: [
      { code: "EGG", presence: AllergenPresence.CONTAINS },
      { code: "FISH", presence: AllergenPresence.CONTAINS },
    ],
  },
] as const;

const restaurants = [
  {
    googlePlaceId: "seed:pho-saigon-central",
    name: "Phở Sài Gòn Central (Seed)",
    address: "Quận 1, Thành phố Hồ Chí Minh",
    latitude: "10.776889",
    longitude: "106.700806",
    rating: "4.4",
    ratingCount: 128,
    priceLevel: 2,
    dishes: [{ slug: "pho-bo", price: 65_000 }],
  },
  {
    googlePlaceId: "seed:quan-an-viet-central",
    name: "Quán Ăn Việt Central (Seed)",
    address: "Quận 3, Thành phố Hồ Chí Minh",
    latitude: "10.782333",
    longitude: "106.687603",
    rating: "4.2",
    ratingCount: 86,
    priceLevel: 2,
    dishes: [
      { slug: "bun-cha", price: 55_000 },
      { slug: "goi-cuon-tom-thit", price: 45_000 },
    ],
  },
  {
    googlePlaceId: "seed:com-tam-neighborhood",
    name: "Cơm Tấm Khu Phố (Seed)",
    address: "Quận Bình Thạnh, Thành phố Hồ Chí Minh",
    latitude: "10.803883",
    longitude: "106.696426",
    rating: "4.3",
    ratingCount: 64,
    priceLevel: 1,
    dishes: [
      { slug: "com-tam-suon-trung", price: 55_000 },
      { slug: "banh-mi-thit", price: 30_000 },
    ],
  },
] as const;

function normalizeLookupText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("vi")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

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

async function seedDishKnowledgeBase(): Promise<void> {
  const vietnameseCuisine = await prisma.cuisine.findUniqueOrThrow({
    where: { code: "VIETNAMESE" },
  });

  for (const item of ingredients) {
    await prisma.ingredient.upsert({
      where: { code: item.code },
      update: { name: item.name },
      create: item,
    });
  }

  const ingredientByCode = new Map(
    (
      await prisma.ingredient.findMany({
        where: { code: { in: ingredients.map((item) => item.code) } },
      })
    ).map((item) => [item.code, item]),
  );
  const allergenByCode = new Map(
    (
      await prisma.allergen.findMany({
        where: { code: { in: allergens.map((item) => item.code) } },
      })
    ).map((item) => [item.code, item]),
  );

  for (const item of dishes) {
    const dish = await prisma.dish.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        description: item.description,
        cuisineId: vietnameseCuisine.id,
        priceMin: item.priceMin,
        priceMax: item.priceMax,
        spicyLevel: item.spicyLevel,
        sweetLevel: item.sweetLevel,
        sourLevel: item.sourLevel,
        saltyLevel: item.saltyLevel,
        verificationStatus: VerificationStatus.REVIEWED,
      },
      create: {
        slug: item.slug,
        name: item.name,
        description: item.description,
        cuisineId: vietnameseCuisine.id,
        priceMin: item.priceMin,
        priceMax: item.priceMax,
        spicyLevel: item.spicyLevel,
        sweetLevel: item.sweetLevel,
        sourLevel: item.sourLevel,
        saltyLevel: item.saltyLevel,
        verificationStatus: VerificationStatus.REVIEWED,
      },
    });

    for (const alias of item.aliases) {
      const normalizedAlias = normalizeLookupText(alias);
      await prisma.dishAlias.upsert({
        where: { dishId_normalizedAlias: { dishId: dish.id, normalizedAlias } },
        update: { alias },
        create: { dishId: dish.id, alias, normalizedAlias },
      });
    }

    for (const mapping of item.ingredients) {
      const ingredient = ingredientByCode.get(mapping.code);
      if (!ingredient) {
        throw new Error(`Không tìm thấy nguyên liệu seed: ${mapping.code}`);
      }

      await prisma.dishIngredient.upsert({
        where: { dishId_ingredientId: { dishId: dish.id, ingredientId: ingredient.id } },
        update: { isPrimary: mapping.isPrimary },
        create: {
          dishId: dish.id,
          ingredientId: ingredient.id,
          isPrimary: mapping.isPrimary,
        },
      });
    }

    for (const mapping of item.allergens) {
      const allergen = allergenByCode.get(mapping.code);
      if (!allergen) {
        throw new Error(`Không tìm thấy dị nguyên seed: ${mapping.code}`);
      }

      await prisma.dishAllergen.upsert({
        where: { dishId_allergenId: { dishId: dish.id, allergenId: allergen.id } },
        update: {
          presence: mapping.presence,
          verificationStatus: VerificationStatus.REVIEWED,
          evidenceSource: `DB03 curated seed recipe composition: ${item.name}`,
          verifiedAt: null,
        },
        create: {
          dishId: dish.id,
          allergenId: allergen.id,
          presence: mapping.presence,
          verificationStatus: VerificationStatus.REVIEWED,
          evidenceSource: `DB03 curated seed recipe composition: ${item.name}`,
        },
      });
    }
  }

  console.log(`Đã seed ${ingredients.length} ingredients và ${dishes.length} Vietnamese dishes`);
}

async function seedRestaurants(): Promise<void> {
  const dishBySlug = new Map(
    (
      await prisma.dish.findMany({
        where: { slug: { in: dishes.map((item) => item.slug) } },
      })
    ).map((item) => [item.slug, item]),
  );
  const placesDataUpdatedAt = new Date("2026-09-18T00:00:00.000Z");

  for (const item of restaurants) {
    const restaurant = await prisma.restaurant.upsert({
      where: { googlePlaceId: item.googlePlaceId },
      update: {
        name: item.name,
        address: item.address,
        latitude: item.latitude,
        longitude: item.longitude,
        rating: item.rating,
        ratingCount: item.ratingCount,
        priceLevel: item.priceLevel,
        businessStatus: RestaurantBusinessStatus.OPERATIONAL,
        placesDataUpdatedAt,
      },
      create: {
        googlePlaceId: item.googlePlaceId,
        name: item.name,
        address: item.address,
        latitude: item.latitude,
        longitude: item.longitude,
        rating: item.rating,
        ratingCount: item.ratingCount,
        priceLevel: item.priceLevel,
        businessStatus: RestaurantBusinessStatus.OPERATIONAL,
        placesDataUpdatedAt,
      },
    });

    for (const menuItem of item.dishes) {
      const dish = dishBySlug.get(menuItem.slug);
      if (!dish) {
        throw new Error(`Không tìm thấy món seed cho restaurant: ${menuItem.slug}`);
      }

      await prisma.restaurantDish.upsert({
        where: {
          restaurantId_dishId: { restaurantId: restaurant.id, dishId: dish.id },
        },
        update: {
          price: menuItem.price,
          isAvailable: true,
          source: `DB04 development seed menu: ${item.name}`,
          verifiedAt: placesDataUpdatedAt,
        },
        create: {
          restaurantId: restaurant.id,
          dishId: dish.id,
          price: menuItem.price,
          isAvailable: true,
          source: `DB04 development seed menu: ${item.name}`,
          verifiedAt: placesDataUpdatedAt,
        },
      });
    }
  }

  console.log(
    `Đã seed ${restaurants.length} restaurants và ${restaurants.flatMap((item) => item.dishes).length} restaurant-dish mappings`,
  );
}

async function main(): Promise<void> {
  await seedCatalogs();
  await seedDishKnowledgeBase();
  await seedRestaurants();

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
