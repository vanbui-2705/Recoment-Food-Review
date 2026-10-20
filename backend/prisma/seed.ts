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
  { code: "FISH", name: "Cá" },
  { code: "SEAWEED", name: "Rong biển" },
  { code: "MILK", name: "Sữa" },
  { code: "COFFEE", name: "Cà phê" },
  { code: "TEA", name: "Trà" },
  { code: "TAPIOCA_PEARL", name: "Trân châu" },
  { code: "SUGARCANE", name: "Mía" },
  { code: "AVOCADO", name: "Bơ" },
  { code: "MUNG_BEAN", name: "Đậu xanh" },
] as const;

const dishes = [
  {
    slug: "pho-bo",
    name: "Phở bò",
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/pho-bo.jpg",
    imageAttribution: "Vyacheslav Argenberg · CC BY 4.0 · Wikimedia Commons",
    mealPeriods: ["BREAKFAST", "LUNCH", "DINNER"],
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
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/banh-mi-thit.jpg",
    imageAttribution: "Junyu-K · CC BY-SA 4.0 · Wikimedia Commons",
    mealPeriods: ["BREAKFAST", "LUNCH", "DINNER"],
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
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/bun-cha.jpg",
    imageAttribution: "Larry · CC BY-SA 2.0 · Wikimedia Commons",
    mealPeriods: ["LUNCH", "DINNER"],
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
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/goi-cuon-tom-thit.jpg",
    imageAttribution: "N509FZ · CC BY-SA 4.0 · Wikimedia Commons",
    mealPeriods: ["LUNCH", "DINNER", "SNACK"],
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
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/com-tam-suon-trung.jpg",
    imageAttribution: "Christopher Crouzet · CC BY-SA 4.0 · Wikimedia Commons",
    mealPeriods: ["BREAKFAST", "LUNCH", "DINNER"],
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
  {
    slug: "banh-xeo-tom-thit",
    name: "Bánh xèo tôm thịt",
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/banh-xeo.jpg",
    imageAttribution: "Kent Wang · CC BY-SA 2.0 · Wikimedia Commons",
    mealPeriods: ["LUNCH", "DINNER"],
    description: "Bánh xèo giòn với tôm, thịt, giá và rau sống.",
    priceMin: 70_000,
    priceMax: 140_000,
    spicyLevel: 10,
    sweetLevel: 30,
    sourLevel: 20,
    saltyLevel: 45,
    aliases: ["Bánh xèo tôm thịt", "Vietnamese savory pancake"],
    ingredients: [
      { code: "RICE", isPrimary: true },
      { code: "SHRIMP", isPrimary: true },
      { code: "PORK", isPrimary: false },
      { code: "FRESH_HERBS", isPrimary: false },
    ],
    allergens: [{ code: "SHELLFISH", presence: AllergenPresence.CONTAINS }],
  },
  {
    slug: "bo-luc-lac",
    name: "Bò lúc lắc",
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/bo-luc-lac.jpg",
    imageAttribution: "Alexandersingh9 · CC0 · Wikimedia Commons",
    mealPeriods: ["LUNCH", "DINNER"],
    description: "Thịt bò áp chảo dùng với cơm, trứng và rau ăn kèm.",
    priceMin: 140_000,
    priceMax: 280_000,
    spicyLevel: 10,
    sweetLevel: 25,
    sourLevel: 15,
    saltyLevel: 50,
    aliases: ["Bò lúc lắc", "Shaking beef"],
    ingredients: [
      { code: "BEEF", isPrimary: true },
      { code: "RICE", isPrimary: false },
      { code: "EGG", isPrimary: false },
    ],
    allergens: [{ code: "EGG", presence: AllergenPresence.MAY_CONTAIN }],
  },
  {
    slug: "sushi-set-dac-biet",
    name: "Sushi set đặc biệt",
    cuisineCode: "JAPANESE",
    imageUrl: "/images/dishes/sushi-set.jpg",
    imageAttribution: "Alpha · CC BY-SA 2.0 · Wikimedia Commons",
    mealPeriods: ["LUNCH", "DINNER"],
    description: "Set nigiri và maki nhiều loại dành cho một bữa ăn đặc biệt.",
    priceMin: 280_000,
    priceMax: 480_000,
    spicyLevel: 5,
    sweetLevel: 20,
    sourLevel: 15,
    saltyLevel: 45,
    aliases: ["Sushi set", "Assorted sushi"],
    ingredients: [
      { code: "RICE", isPrimary: true },
      { code: "FISH", isPrimary: true },
      { code: "SHRIMP", isPrimary: false },
      { code: "SEAWEED", isPrimary: false },
    ],
    allergens: [
      { code: "FISH", presence: AllergenPresence.CONTAINS },
      { code: "SHELLFISH", presence: AllergenPresence.MAY_CONTAIN },
    ],
  },
  {
    slug: "wagyu-yakiniku-rolls",
    name: "Wagyu yakiniku cuộn",
    cuisineCode: "JAPANESE",
    imageUrl: "/images/dishes/wagyu-yakiniku-rolls.jpg",
    imageAttribution: "Alpha · CC BY-SA 2.0 · Wikimedia Commons",
    mealPeriods: ["DINNER"],
    description: "Bò Wagyu nướng cuộn kiểu Nhật cho dịp hẹn hò hoặc kỷ niệm.",
    priceMin: 450_000,
    priceMax: 900_000,
    spicyLevel: 5,
    sweetLevel: 25,
    sourLevel: 10,
    saltyLevel: 50,
    aliases: ["Wagyu yakiniku cuộn", "Wagyu yakiniku rolls"],
    ingredients: [
      { code: "BEEF", isPrimary: true },
      { code: "SOY_SAUCE", isPrimary: false },
    ],
    allergens: [{ code: "SOY", presence: AllergenPresence.CONTAINS }],
  },
  {
    slug: "bun-bo-hue",
    name: "Bún bò Huế",
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/bun-bo-hue.jpg",
    imageAttribution: "Avlxyz · CC BY-SA 2.0 · Wikimedia Commons",
    mealPeriods: ["BREAKFAST", "LUNCH", "DINNER"],
    description: "Bún sợi lớn với nước dùng sả, thịt bò và chả Huế.",
    priceMin: 45_000,
    priceMax: 95_000,
    spicyLevel: 55,
    sweetLevel: 20,
    sourLevel: 15,
    saltyLevel: 60,
    aliases: ["Bún bò Huế", "Hue beef noodle soup"],
    ingredients: [
      { code: "RICE_NOODLE", isPrimary: true },
      { code: "BEEF", isPrimary: true },
      { code: "FISH_SAUCE", isPrimary: false },
      { code: "FRESH_HERBS", isPrimary: false },
    ],
    allergens: [{ code: "FISH", presence: AllergenPresence.CONTAINS }],
  },
  {
    slug: "banh-cuon-nong",
    name: "Bánh cuốn nóng",
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/banh-cuon.jpg",
    imageAttribution: "Lưu Ly · Public domain · Wikimedia Commons",
    mealPeriods: ["BREAKFAST", "LUNCH", "DINNER"],
    description: "Bánh bột gạo hấp mỏng cuộn thịt, mộc nhĩ và dùng cùng nước mắm.",
    priceMin: 30_000,
    priceMax: 70_000,
    spicyLevel: 10,
    sweetLevel: 25,
    sourLevel: 20,
    saltyLevel: 50,
    aliases: ["Bánh cuốn", "Steamed rice rolls"],
    ingredients: [
      { code: "RICE", isPrimary: true },
      { code: "PORK", isPrimary: true },
      { code: "FISH_SAUCE", isPrimary: false },
    ],
    allergens: [{ code: "FISH", presence: AllergenPresence.CONTAINS }],
  },
  {
    slug: "mi-quang-tom-thit",
    name: "Mì Quảng tôm thịt",
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/mi-quang.jpg",
    imageAttribution: "SauceSupreme · CC BY 2.0 · Wikimedia Commons",
    mealPeriods: ["BREAKFAST", "LUNCH", "DINNER"],
    description: "Mì Quảng với tôm, thịt, rau sống, bánh đa và nước dùng đậm vị.",
    priceMin: 45_000,
    priceMax: 100_000,
    spicyLevel: 35,
    sweetLevel: 25,
    sourLevel: 15,
    saltyLevel: 60,
    aliases: ["Mì Quảng", "Quang Nam turmeric noodles"],
    ingredients: [
      { code: "RICE_NOODLE", isPrimary: true },
      { code: "SHRIMP", isPrimary: true },
      { code: "PORK", isPrimary: false },
      { code: "PEANUT", isPrimary: false },
    ],
    allergens: [
      { code: "SHELLFISH", presence: AllergenPresence.CONTAINS },
      { code: "PEANUT", presence: AllergenPresence.CONTAINS },
    ],
  },
  {
    slug: "che-dau-xanh",
    name: "Chè đậu xanh",
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/che-dau-xanh.jpg",
    imageAttribution: "Hoangkid · CC BY-SA 4.0 · Wikimedia Commons",
    mealPeriods: ["SNACK", "LUNCH", "DINNER"],
    description: "Món chè ngọt thanh từ đậu xanh, thường dùng lạnh hoặc ấm.",
    priceMin: 20_000,
    priceMax: 50_000,
    spicyLevel: 0,
    sweetLevel: 75,
    sourLevel: 0,
    saltyLevel: 5,
    aliases: ["Chè đậu xanh", "Mung bean sweet soup"],
    ingredients: [{ code: "MUNG_BEAN", isPrimary: true }],
    allergens: [],
  },
  {
    slug: "ca-phe-sua-da",
    name: "Cà phê sữa đá",
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/ca-phe-sua-da.jpg",
    imageAttribution: "ePi.Longo · CC BY-SA 2.0 · Wikimedia Commons",
    mealPeriods: ["BREAKFAST", "LUNCH", "SNACK"],
    description: "Cà phê phin đậm pha cùng sữa đặc và đá.",
    priceMin: 25_000,
    priceMax: 65_000,
    spicyLevel: 0,
    sweetLevel: 60,
    sourLevel: 10,
    saltyLevel: 5,
    aliases: ["Cà phê sữa đá", "Vietnamese iced milk coffee"],
    ingredients: [
      { code: "COFFEE", isPrimary: true },
      { code: "MILK", isPrimary: true },
    ],
    allergens: [{ code: "MILK", presence: AllergenPresence.CONTAINS }],
  },
  {
    slug: "tra-sua-tran-chau",
    name: "Trà sữa trân châu",
    cuisineCode: "CHINESE",
    imageUrl: "/images/dishes/tra-sua-tran-chau.jpg",
    imageAttribution: "Pixabay contributor · CC0 · Wikimedia Commons",
    mealPeriods: ["LUNCH", "DINNER", "SNACK"],
    description: "Trà sữa dùng cùng trân châu dai, có thể điều chỉnh độ ngọt và đá.",
    priceMin: 30_000,
    priceMax: 85_000,
    spicyLevel: 0,
    sweetLevel: 75,
    sourLevel: 5,
    saltyLevel: 5,
    aliases: ["Trà sữa trân châu", "Bubble milk tea"],
    ingredients: [
      { code: "TEA", isPrimary: true },
      { code: "MILK", isPrimary: true },
      { code: "TAPIOCA_PEARL", isPrimary: false },
    ],
    allergens: [{ code: "MILK", presence: AllergenPresence.CONTAINS }],
  },
  {
    slug: "nuoc-mia-tac",
    name: "Nước mía tắc",
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/nuoc-mia.jpg",
    imageAttribution: "Chainwit · CC BY 4.0 · Wikimedia Commons",
    mealPeriods: ["BREAKFAST", "LUNCH", "DINNER", "SNACK"],
    description: "Nước mía ép dùng lạnh với tắc tạo vị ngọt và chua nhẹ.",
    priceMin: 15_000,
    priceMax: 40_000,
    spicyLevel: 0,
    sweetLevel: 80,
    sourLevel: 25,
    saltyLevel: 0,
    aliases: ["Nước mía", "Sugarcane juice"],
    ingredients: [{ code: "SUGARCANE", isPrimary: true }],
    allergens: [],
  },
  {
    slug: "sinh-to-bo",
    name: "Sinh tố bơ",
    cuisineCode: "VIETNAMESE",
    imageUrl: "/images/dishes/sinh-to-bo.jpg",
    imageAttribution: "Chiigsss2005 · CC BY 4.0 · Wikimedia Commons",
    mealPeriods: ["BREAKFAST", "LUNCH", "DINNER", "SNACK"],
    description: "Bơ xay mịn cùng sữa và đá, phù hợp cho bữa phụ.",
    priceMin: 30_000,
    priceMax: 70_000,
    spicyLevel: 0,
    sweetLevel: 55,
    sourLevel: 5,
    saltyLevel: 5,
    aliases: ["Sinh tố bơ", "Avocado smoothie"],
    ingredients: [
      { code: "AVOCADO", isPrimary: true },
      { code: "MILK", isPrimary: true },
    ],
    allergens: [{ code: "MILK", presence: AllergenPresence.CONTAINS }],
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
  const cuisineByCode = new Map(
    (await prisma.cuisine.findMany()).map((cuisine) => [cuisine.code, cuisine]),
  );

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
    const cuisine = cuisineByCode.get(item.cuisineCode);
    if (!cuisine) throw new Error(`Không tìm thấy cuisine seed: ${item.cuisineCode}`);
    const existing = await prisma.dish.findUnique({ where: { slug: item.slug } });
    // Re-running development seed must never overwrite editorial or merchant evidence.
    if (
      existing?.verificationStatus === VerificationStatus.VERIFIED ||
      (existing?.evidenceSource && !existing.evidenceSource.startsWith("Rec-Food reference seed"))
    )
      continue;
    const dish = await prisma.dish.upsert({
      where: { slug: item.slug },
      update: {
        evidenceSource:
          "Rec-Food reference seed v1: recipe composition; price and taste are estimates, not a merchant menu",
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        imageAttribution: item.imageAttribution,
        cuisineId: cuisine.id,
        priceMin: item.priceMin,
        priceMax: item.priceMax,
        spicyLevel: item.spicyLevel,
        sweetLevel: item.sweetLevel,
        sourLevel: item.sourLevel,
        saltyLevel: item.saltyLevel,
        mealPeriods: item.mealPeriods,
        verificationStatus: VerificationStatus.REVIEWED,
      },
      create: {
        evidenceSource:
          "Rec-Food reference seed v1: recipe composition; price and taste are estimates, not a merchant menu",
        slug: item.slug,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        imageAttribution: item.imageAttribution,
        cuisineId: cuisine.id,
        priceMin: item.priceMin,
        priceMax: item.priceMax,
        spicyLevel: item.spicyLevel,
        sweetLevel: item.sweetLevel,
        sourLevel: item.sourLevel,
        saltyLevel: item.saltyLevel,
        mealPeriods: item.mealPeriods,
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

  console.log(`Đã seed ${ingredients.length} ingredients và ${dishes.length} curated dishes`);
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
  if (process.env.NODE_ENV !== "production") {
    await seedDishKnowledgeBase();
    await seedRestaurants();
  }

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
