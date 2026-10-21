// Curated culinary images with authentic Vietnamese food & beverage photography
export const DISH_PHOTO_REGISTRY = {
  // --- Họ Phở ---
  pho_tai_lan: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=600&auto=format&fit=crop&q=80",
  pho_sot_vang: "https://images.unsplash.com/photo-1594998893017-36147cbcae05?w=600&auto=format&fit=crop&q=80",
  pho_ga: "https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=600&auto=format&fit=crop&q=80",
  pho_bo: "/images/dishes/pho-bo.jpg",
  pho_cuon: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80",
  pho_xao: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80",

  // --- Họ Cơm ---
  com_tam: "/images/dishes/com-tam-suon-trung.jpg",
  com_rang_dua_bo: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&auto=format&fit=crop&q=80",
  com_ga_xoi_mo: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=80",
  com_nieu: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
  com_tho_bo: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80",

  // --- Họ Bún / Mì / Hủ tiếu ---
  bun_bo_hue: "/images/dishes/bun-bo-hue.jpg",
  bun_cha: "/images/dishes/bun-cha.jpg",
  bun_rieu: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80",
  bun_dau: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
  mi_quang: "/images/dishes/mi-quang.jpg",
  hu_tieu: "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=600&auto=format&fit=crop&q=80",
  banh_canh: "https://images.unsplash.com/photo-1555126634-323283e090fa?w=600&auto=format&fit=crop&q=80",

  // --- Đồ cuốn & Bánh truyền thống ---
  banh_mi: "/images/dishes/banh-mi-thit.jpg",
  banh_mi_chao: "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=600&auto=format&fit=crop&q=80",
  banh_cuon: "/images/dishes/banh-cuon.jpg",
  banh_xeo: "/images/dishes/banh-xeo.jpg",
  goi_cuon: "/images/dishes/goi-cuon-tom-thit.jpg",
  bo_luc_lac: "/images/dishes/bo-luc-lac.jpg",

  // --- Đồ uống & Trà sữa ---
  tra_sua: "/images/dishes/tra-sua-tran-chau.jpg",
  tra_dao: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80",
  tra_olong: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=600&auto=format&fit=crop&q=80",
  ca_phe_sua: "/images/dishes/ca-phe-sua-da.jpg",
  ca_phe_muoi: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80",
  bac_xiu: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&auto=format&fit=crop&q=80",
  sinh_to_bo: "/images/dishes/sinh-to-bo.jpg",
  nuoc_ep_cam: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop&q=80",
  nuoc_mia: "/images/dishes/nuoc-mia.jpg",
  che_khuc_bach: "/images/dishes/che-dau-xanh.jpg",

  // --- Ăn vặt & Quốc tế ---
  ga_ran: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80",
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80",
  sushi: "/images/dishes/sushi-set.jpg",
  lau_thai: "https://images.unsplash.com/photo-1547928576-a4a33237cbc3?w=600&auto=format&fit=crop&q=80",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80",
};

// Alternate gallery photos to avoid repeating the exact same photo when multiple places sell the same food
export const PHO_VARIANTS = [
  DISH_PHOTO_REGISTRY.pho_tai_lan,
  DISH_PHOTO_REGISTRY.pho_sot_vang,
  DISH_PHOTO_REGISTRY.pho_ga,
  DISH_PHOTO_REGISTRY.pho_bo,
  DISH_PHOTO_REGISTRY.pho_xao,
];

export const COM_VARIANTS = [
  DISH_PHOTO_REGISTRY.com_tam,
  DISH_PHOTO_REGISTRY.com_rang_dua_bo,
  DISH_PHOTO_REGISTRY.com_ga_xoi_mo,
  DISH_PHOTO_REGISTRY.com_nieu,
  DISH_PHOTO_REGISTRY.com_tho_bo,
];

export const BUN_VARIANTS = [
  DISH_PHOTO_REGISTRY.bun_bo_hue,
  DISH_PHOTO_REGISTRY.bun_cha,
  DISH_PHOTO_REGISTRY.bun_rieu,
  DISH_PHOTO_REGISTRY.bun_dau,
  DISH_PHOTO_REGISTRY.hu_tieu,
];

export const DRINK_VARIANTS = [
  DISH_PHOTO_REGISTRY.tra_dao,
  DISH_PHOTO_REGISTRY.tra_sua,
  DISH_PHOTO_REGISTRY.ca_phe_muoi,
  DISH_PHOTO_REGISTRY.ca_phe_sua,
  DISH_PHOTO_REGISTRY.bac_xiu,
  DISH_PHOTO_REGISTRY.sinh_to_bo,
  DISH_PHOTO_REGISTRY.nuoc_ep_cam,
];

// Smart Dish Photo Resolver: Never return the same photo for every pho or com
export function resolveDishImage(itemOrTitle, idOrSeed = "") {
  if (typeof itemOrTitle === "object" && itemOrTitle !== null) {
    if (
      itemOrTitle.photo &&
      typeof itemOrTitle.photo === "string" &&
      !itemOrTitle.photo.includes("pho-bo.jpg") &&
      !itemOrTitle.photo.includes("com-tam-suon-trung.jpg")
    ) {
      return itemOrTitle.photo;
    }
    if (
      itemOrTitle.image &&
      typeof itemOrTitle.image === "string" &&
      !itemOrTitle.image.includes("pho-bo.jpg") &&
      !itemOrTitle.image.includes("com-tam-suon-trung.jpg")
    ) {
      return itemOrTitle.image;
    }
  }

  const text = (
    typeof itemOrTitle === "string"
      ? itemOrTitle
      : `${itemOrTitle?.title || itemOrTitle?.name || ""} ${itemOrTitle?.dish || ""} ${itemOrTitle?.address || ""}`
  ).toLowerCase();

  const seed = String(idOrSeed || itemOrTitle?.id || text)
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // 1. Phở specific variants
  if (text.includes("tái lăn") || text.includes("xào lăn")) return DISH_PHOTO_REGISTRY.pho_tai_lan;
  if (text.includes("sốt vang") || text.includes("gân bò")) return DISH_PHOTO_REGISTRY.pho_sot_vang;
  if (text.includes("phở gà") || text.includes("gà đồi")) return DISH_PHOTO_REGISTRY.pho_ga;
  if (text.includes("phở cuốn")) return DISH_PHOTO_REGISTRY.pho_cuon;
  if (text.includes("phở xào") || text.includes("áp chảo")) return DISH_PHOTO_REGISTRY.pho_xao;
  if (text.includes("phở")) return PHO_VARIANTS[seed % PHO_VARIANTS.length];

  // 2. Cơm specific variants
  if (text.includes("dưa bò") || text.includes("cơm rang")) return DISH_PHOTO_REGISTRY.com_rang_dua_bo;
  if (text.includes("gà xối mỡ") || text.includes("gà luộc")) return DISH_PHOTO_REGISTRY.com_ga_xoi_mo;
  if (text.includes("cơm niêu") || text.includes("kho tộ")) return DISH_PHOTO_REGISTRY.com_nieu;
  if (text.includes("cơm thố") || text.includes("bò xào")) return DISH_PHOTO_REGISTRY.com_tho_bo;
  if (text.includes("cơm tấm") || text.includes("sườn bì")) return DISH_PHOTO_REGISTRY.com_tam;
  if (text.includes("cơm")) return COM_VARIANTS[seed % COM_VARIANTS.length];

  // 3. Bún, Mì, Hủ tiếu
  if (text.includes("bún bò") || text.includes("huế")) return DISH_PHOTO_REGISTRY.bun_bo_hue;
  if (text.includes("bún chả") || text.includes("hà nội")) return DISH_PHOTO_REGISTRY.bun_cha;
  if (text.includes("bún riêu") || text.includes("ốc")) return DISH_PHOTO_REGISTRY.bun_rieu;
  if (text.includes("đậu mắm tôm") || text.includes("bún đậu")) return DISH_PHOTO_REGISTRY.bun_dau;
  if (text.includes("mì quảng")) return DISH_PHOTO_REGISTRY.mi_quang;
  if (text.includes("hủ tiếu") || text.includes("nam vang")) return DISH_PHOTO_REGISTRY.hu_tieu;
  if (text.includes("bánh canh")) return DISH_PHOTO_REGISTRY.banh_canh;
  if (text.includes("bún") || text.includes("mì")) return BUN_VARIANTS[seed % BUN_VARIANTS.length];

  // 4. Bánh & Gỏi
  if (text.includes("bánh mì chảo")) return DISH_PHOTO_REGISTRY.banh_mi_chao;
  if (text.includes("bánh mì")) return DISH_PHOTO_REGISTRY.banh_mi;
  if (text.includes("bánh cuốn")) return DISH_PHOTO_REGISTRY.banh_cuon;
  if (text.includes("bánh xèo")) return DISH_PHOTO_REGISTRY.banh_xeo;
  if (text.includes("gỏi cuốn")) return DISH_PHOTO_REGISTRY.goi_cuon;
  if (text.includes("bò lúc lắc") || text.includes("steak")) return DISH_PHOTO_REGISTRY.bo_luc_lac;

  // 5. Đồ uống & Trà sữa
  if (text.includes("cà phê muối")) return DISH_PHOTO_REGISTRY.ca_phe_muoi;
  if (text.includes("bạc xỉu")) return DISH_PHOTO_REGISTRY.bac_xiu;
  if (text.includes("cà phê") || text.includes("cafe") || text.includes("coffee")) return DISH_PHOTO_REGISTRY.ca_phe_sua;
  if (text.includes("trà đào") || text.includes("cam sả")) return DISH_PHOTO_REGISTRY.tra_dao;
  if (text.includes("ô long") || text.includes("kem cheese")) return DISH_PHOTO_REGISTRY.tra_olong;
  if (text.includes("trà sữa") || text.includes("trân châu")) return DISH_PHOTO_REGISTRY.tra_sua;
  if (text.includes("sinh tố") || text.includes("bơ")) return DISH_PHOTO_REGISTRY.sinh_to_bo;
  if (text.includes("nước ép") || text.includes("cam cà rốt")) return DISH_PHOTO_REGISTRY.nuoc_ep_cam;
  if (text.includes("nước mía")) return DISH_PHOTO_REGISTRY.nuoc_mia;
  if (text.includes("chè")) return DISH_PHOTO_REGISTRY.che_khuc_bach;

  // 6. Fastfood & Ăn vặt
  if (text.includes("gà rán") || text.includes("chicken")) return DISH_PHOTO_REGISTRY.ga_ran;
  if (text.includes("pizza")) return DISH_PHOTO_REGISTRY.pizza;
  if (text.includes("sushi") || text.includes("sashimi") || text.includes("nhật")) return DISH_PHOTO_REGISTRY.sushi;
  if (text.includes("lẩu") || text.includes("thai")) return DISH_PHOTO_REGISTRY.lau_thai;
  if (text.includes("salad") || text.includes("healthy") || text.includes("chay")) return DISH_PHOTO_REGISTRY.salad;

  // Default fallback rotated by seed
  const fallbackList = [
    DISH_PHOTO_REGISTRY.pho_tai_lan,
    DISH_PHOTO_REGISTRY.com_tam,
    DISH_PHOTO_REGISTRY.bun_bo_hue,
    DISH_PHOTO_REGISTRY.banh_mi,
    DISH_PHOTO_REGISTRY.tra_dao,
    DISH_PHOTO_REGISTRY.com_rang_dua_bo,
  ];
  return fallbackList[seed % fallbackList.length];
}

// Generate full restaurant menus (like ShopeeFood / BeFood)
export function getRestaurantMenu(restaurant) {
  const name = restaurant?.name || "Quán Ăn";
  const lower = name.toLowerCase();

  // 1. Phở Specialty Shop
  if (lower.includes("phở")) {
    return [
      {
        id: "m_pho_1",
        name: "Phở Bò Tái Lăn Hà Nội (Đặc biệt)",
        description: "Bò tái lăn thơm nức mùi tỏi phi, nước dùng ngọt thanh hầm xương 12 tiếng.",
        price: 65000,
        category: "Món chính",
        image: DISH_PHOTO_REGISTRY.pho_tai_lan,
        isBestSeller: true,
      },
      {
        id: "m_pho_2",
        name: "Phở Bò Sốt Vang Gân Mềm",
        description: "Thịt nạm và gân bò hầm sốt vang đậm đà, dậy mùi quế hồi.",
        price: 75000,
        category: "Món chính",
        image: DISH_PHOTO_REGISTRY.pho_sot_vang,
        isBestSeller: true,
      },
      {
        id: "m_pho_3",
        name: "Phở Gà Đồi Lá Chanh",
        description: "Thịt gà ta thả vườn da giòn thịt ngọt, thái lá chanh bánh phở mềm.",
        price: 60000,
        category: "Món chính",
        image: DISH_PHOTO_REGISTRY.pho_ga,
      },
      {
        id: "m_pho_4",
        name: "Phở Bò Tái Nạm Gầu",
        description: "Bát phở truyền thống đầy đặn thịt bò tái mềm và gầu giòn thơm.",
        price: 70000,
        category: "Món chính",
        image: DISH_PHOTO_REGISTRY.pho_bo,
      },
      {
        id: "m_pho_5",
        name: "Phở Cuốn Ngũ Xã (Đĩa 6 cuốn)",
        description: "Bánh phở cuộn thịt bò xào, rau thơm, chấm mắm chua ngọt chuẩn vị.",
        price: 55000,
        category: "Món ăn kèm",
        image: DISH_PHOTO_REGISTRY.pho_cuon,
      },
      {
        id: "m_pho_6",
        name: "Quẩy Giòn Phố Cổ (Đĩa 3 chiếc)",
        description: "Quẩy nóng giòn rụm, nhúng nước dùng phở ăn kèm.",
        price: 10000,
        category: "Món ăn kèm",
        image: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=600&auto=format&fit=crop&q=80",
      },
      {
        id: "m_pho_7",
        name: "Trứng Gà Chần Nước Béo",
        description: "Trứng gà ta lòng đào chan nước dùng phở thơm lừng.",
        price: 12000,
        category: "Món ăn kèm",
        image: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600&auto=format&fit=crop&q=80",
      },
      {
        id: "m_pho_8",
        name: "Trà Đào Cam Sả Tươi",
        description: "Trà đào thơm ngát kết hợp cam tươi và sả thanh mát.",
        price: 35000,
        category: "Đồ uống",
        image: DISH_PHOTO_REGISTRY.tra_dao,
        isBestSeller: true,
      },
      {
        id: "m_pho_9",
        name: "Trà Đá Hoa Lài",
        description: "Ly trà đá ướp hoa lài truyền thống giải khát.",
        price: 5000,
        category: "Đồ uống",
        image: DISH_PHOTO_REGISTRY.nuoc_mia,
      },
    ];
  }

  // 2. Cơm Tấm / Quán Cơm
  if (lower.includes("cơm")) {
    return [
      {
        id: "m_com_1",
        name: "Cơm Tấm Sườn Bì Chả Đặc Biệt",
        description: "Miếng sườn cốt lết nướng than hoa mật ong, bì thắt sợi, chả trứng béo ngậy.",
        price: 58000,
        category: "Món chính",
        image: DISH_PHOTO_REGISTRY.com_tam,
        isBestSeller: true,
      },
      {
        id: "m_com_2",
        name: "Cơm Gà Xối Mỡ Giòn Da",
        description: "Đùi gà góc tư chiên xối mỡ da giòn rụm, cơm chiên cà chua hạt dẻo.",
        price: 65000,
        category: "Món chính",
        image: DISH_PHOTO_REGISTRY.com_ga_xoi_mo,
        isBestSeller: true,
      },
      {
        id: "m_com_3",
        name: "Cơm Rang Dưa Bò Giòn Hạt",
        description: "Cơm rang săn hạt, thịt bò mềm xào dưa chua thơm nức mùi tiêu.",
        price: 60000,
        category: "Món chính",
        image: DISH_PHOTO_REGISTRY.com_rang_dua_bo,
      },
      {
        id: "m_com_4",
        name: "Cơm Niêu Cá Bống Kho Tộ",
        description: "Cơm niêu cháy giòn đáy niêu ăn cùng cá kho tộ tiêu đen đậm đà.",
        price: 75000,
        category: "Món chính",
        image: DISH_PHOTO_REGISTRY.com_nieu,
      },
      {
        id: "m_com_5",
        name: "Canh Rong Biển Thịt Bằm",
        description: "Bát canh nóng thanh mát nấu cùng thịt nạc bằm và đậu hũ non.",
        price: 20000,
        category: "Món ăn kèm",
        image: "https://images.unsplash.com/photo-1547928576-a4a33237cbc3?w=600&auto=format&fit=crop&q=80",
      },
      {
        id: "m_com_6",
        name: "Sườn Nướng Thêm (1 Miếng)",
        description: "Sườn nướng mật ong mềm mọng nước dùng kèm mỡ hành tóp mỡ.",
        price: 28000,
        category: "Món ăn kèm",
        image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
      },
      {
        id: "m_com_7",
        name: "Cà Phê Muối Xứ Huế",
        description: "Cà phê pha phin truyền thống hòa quyện lớp kem muối béo ngậy đặc trưng.",
        price: 32000,
        category: "Đồ uống",
        image: DISH_PHOTO_REGISTRY.ca_phe_muoi,
        isBestSeller: true,
      },
      {
        id: "m_com_8",
        name: "Cà Phê Sữa Đá Sài Gòn",
        description: "Hương vị đậm đà nguyên bản từ hạt Robusta rang xay mộc.",
        price: 25000,
        category: "Đồ uống",
        image: DISH_PHOTO_REGISTRY.ca_phe_sua,
      },
    ];
  }

  // 3. Quán Thái / Châu Á / Đa dạng (Default phong phú như ShopeeFood)
  return [
    {
      id: "m_mix_1",
      name: "Bún Bò Huế Chả Cua Giò Heo",
      description: "Nước dùng ruốc thơm nồng đậm đà, thịt bò bắp hoa, chả cua giòn ngọt.",
      price: 65000,
      category: "Món chính",
      image: DISH_PHOTO_REGISTRY.bun_bo_hue,
      isBestSeller: true,
    },
    {
      id: "m_mix_2",
      name: "Bún Chả Nem Cua Bể Hàng Mành",
      description: "Chả nướng than hoa, nem cua bể giòn rụm, nước chấm đu đủ cà rốt.",
      price: 60000,
      category: "Món chính",
      image: DISH_PHOTO_REGISTRY.bun_cha,
      isBestSeller: true,
    },
    {
      id: "m_mix_3",
      name: "Bún Riêu Cua Bắp Bò Ốc Nhồi",
      description: "Riêu cua đồng thơm ngọt tự nhiên, cà chua tươi, ốc giòn sần sật.",
      price: 55000,
      category: "Món chính",
      image: DISH_PHOTO_REGISTRY.bun_rieu,
    },
    {
      id: "m_mix_4",
      name: "Cơm Gà Xối Mỡ Sốt Tỏi Ớt",
      description: "Gà giòn tan mọng nước, sốt tỏi ớt chua cay kích thích vị giác.",
      price: 62000,
      category: "Món chính",
      image: DISH_PHOTO_REGISTRY.com_ga_xoi_mo,
    },
    {
      id: "m_mix_5",
      name: "Gỏi Cuốn Tôm Thịt Nước Tương Bơ",
      description: "Bánh tráng dẻo cuốn tôm sú, thịt ba chỉ, hẹ tươi chấm sốt tương đậu phộng.",
      price: 45000,
      category: "Món ăn kèm",
      image: DISH_PHOTO_REGISTRY.goi_cuon,
    },
    {
      id: "m_mix_6",
      name: "Bánh Mì Chảo Xíu Mại Trứng Muối",
      description: "Pate gan thơm bùi, xíu mại sốt cà chua sền sệt, trứng ốp la lòng đào.",
      price: 48000,
      category: "Món chính",
      image: DISH_PHOTO_REGISTRY.banh_mi_chao,
    },
    {
      id: "m_mix_7",
      name: "Trà Sữa Trân Châu Đường Đen",
      description: "Trà sữa vị ô long nướng thơm lừng, trân châu nấu đường đen dẻo dai.",
      price: 38000,
      category: "Đồ uống",
      image: DISH_PHOTO_REGISTRY.tra_sua,
      isBestSeller: true,
    },
    {
      id: "m_mix_8",
      name: "Trà Đào Cam Sả Hạt Chia",
      description: "Miếng đào giòn ngọt ngào, cam sả thơm phức bổ sung hạt chia giải nhiệt.",
      price: 35000,
      category: "Đồ uống",
      image: DISH_PHOTO_REGISTRY.tra_dao,
    },
    {
      id: "m_mix_9",
      name: "Sinh Tố Bơ Sáp Dừa Tươi",
      description: "Bơ sáp Đắk Lắk dẻo quánh xay cùng sữa đặc và nước cốt dừa béo bùi.",
      price: 42000,
      category: "Đồ uống",
      image: DISH_PHOTO_REGISTRY.sinh_to_bo,
    },
  ];
}

// 36+ Curated Diverse Dishes for Discovery Page (no longer capped at 10!)
export const EXPANDED_DISCOVERY_DISHES = [
  // Nhóm Phở & Bún (6 món)
  {
    id: "cat_pho_tai_lan",
    title: "Phở Bò Tái Lăn Hà Nội",
    restaurantName: "Phở 24 Pasteur",
    price: 65000,
    priceMin: 60000,
    priceMax: 80000,
    distanceMeters: 450,
    rating: 4.8,
    ratingCount: 320,
    category: "noodle",
    image: DISH_PHOTO_REGISTRY.pho_tai_lan,
    reason: "Thịt bò lăn tỏi thơm nức, nước dùng ngọt thanh hợp gu ăn thanh đạm của bạn.",
  },
  {
    id: "cat_pho_sot_vang",
    title: "Phở Bò Sốt Vang Gân Mềm",
    restaurantName: "Phở Gia Truyền Bát Đàn",
    price: 75000,
    priceMin: 70000,
    priceMax: 90000,
    distanceMeters: 850,
    rating: 4.7,
    ratingCount: 450,
    category: "noodle",
    image: DISH_PHOTO_REGISTRY.pho_sot_vang,
    reason: "Sốt vang sóng sánh đậm đà, gân bò dẻo quánh kích thích vị giác trưa nay.",
  },
  {
    id: "cat_bun_bo_hue",
    title: "Bún Bò Huế Chả Cua Giò Heo",
    restaurantName: "Bún Bò Đông Ba",
    price: 60000,
    priceMin: 50000,
    priceMax: 75000,
    distanceMeters: 620,
    rating: 4.9,
    ratingCount: 512,
    category: "noodle",
    image: DISH_PHOTO_REGISTRY.bun_bo_hue,
    reason: "Vị cay the nhẹ nồng ấm, chả cua giòn dai chuẩn phong cách cố đô Huế.",
  },
  {
    id: "cat_bun_cha",
    title: "Bún Chả Nem Cua Bể Hà Nội",
    restaurantName: "Bún Chả Hàng Mành",
    price: 55000,
    priceMin: 50000,
    priceMax: 70000,
    distanceMeters: 900,
    rating: 4.6,
    ratingCount: 280,
    category: "noodle",
    image: DISH_PHOTO_REGISTRY.bun_cha,
    reason: "Chả nướng than hoa thơm lừng chấm cùng nước mắm chua ngọt thanh tao.",
  },
  {
    id: "cat_bun_rieu",
    title: "Bún Riêu Cua Ốc Bắp Bò",
    restaurantName: "Quán Ăn Việt Central",
    price: 50000,
    priceMin: 45000,
    priceMax: 65000,
    distanceMeters: 750,
    rating: 4.5,
    ratingCount: 190,
    category: "noodle",
    image: DISH_PHOTO_REGISTRY.bun_rieu,
    reason: "Riêu cua đồng béo ngậy tự nhiên, cà chua mát lành giải nhiệt hiệu quả.",
  },
  {
    id: "cat_hu_tieu",
    title: "Hủ Tiếu Nam Vang Tôm Mực",
    restaurantName: "Hủ Tiếu Nam Vang Đạt Thành",
    price: 65000,
    priceMin: 60000,
    priceMax: 85000,
    distanceMeters: 1100,
    rating: 4.7,
    ratingCount: 310,
    category: "noodle",
    image: DISH_PHOTO_REGISTRY.hu_tieu,
    reason: "Sợi hủ tiếu dai giòn xóc sốt tương đen, tôm sú tươi rói ngọt lịm.",
  },

  // Nhóm Món Cơm (6 món)
  {
    id: "cat_com_tam",
    title: "Cơm Tấm Sườn Bì Chả Trứng Ốp La",
    restaurantName: "Cơm Tấm Ba Ghiền",
    price: 55000,
    priceMin: 50000,
    priceMax: 80000,
    distanceMeters: 550,
    rating: 4.8,
    ratingCount: 890,
    category: "rice",
    image: DISH_PHOTO_REGISTRY.com_tam,
    reason: "Cốt lết ướp sả mật ong nướng vàng ươm, mỡ hành tóp mỡ giòn tan béo ngậy.",
  },
  {
    id: "cat_com_rang_dua_bo",
    title: "Cơm Rang Dưa Bò Giòn Hạt",
    restaurantName: "Cơm Rang Phố Cổ",
    price: 60000,
    priceMin: 55000,
    priceMax: 75000,
    distanceMeters: 780,
    rating: 4.6,
    ratingCount: 240,
    category: "rice",
    image: DISH_PHOTO_REGISTRY.com_rang_dua_bo,
    reason: "Hạt cơm rang vàng ruộm tơi xốp, thịt bò mềm hòa quyện dưa cải chua giòn.",
  },
  {
    id: "cat_com_ga_xoi_mo",
    title: "Cơm Gà Xối Mỡ Giòn Da Sốt Tỏi",
    restaurantName: "Cơm Gà Hải Nam",
    price: 62000,
    priceMin: 55000,
    priceMax: 70000,
    distanceMeters: 1200,
    rating: 4.7,
    ratingCount: 410,
    category: "rice",
    image: DISH_PHOTO_REGISTRY.com_ga_xoi_mo,
    reason: "Gà xối mỡ lớp da giòn rụm màu cánh gián, thịt bên trong ngọt mềm mọng nước.",
  },
  {
    id: "cat_com_nieu",
    title: "Cơm Niêu Cá Bống Kho Tộ",
    restaurantName: "Nhà Hàng Secret Garden",
    price: 75000,
    priceMin: 70000,
    priceMax: 110000,
    distanceMeters: 950,
    rating: 4.8,
    ratingCount: 620,
    category: "rice",
    image: DISH_PHOTO_REGISTRY.com_nieu,
    reason: "Cơm niêu cháy giòn đáy thố, cá kho kẹo tiêu cay the ấm nồng bữa trưa.",
  },
  {
    id: "cat_com_tho_bo",
    title: "Cơm Thố Bò Áp Chảo Tiêu Đen",
    restaurantName: "Cơm Thố Xá Xíu Bách Khoa",
    price: 65000,
    priceMin: 60000,
    priceMax: 80000,
    distanceMeters: 1400,
    rating: 4.6,
    ratingCount: 180,
    category: "rice",
    image: DISH_PHOTO_REGISTRY.com_tho_bo,
    reason: "Cơm thố gang giữ nóng lâu, bò áp chảo đậm vị tiêu đen thơm lừng.",
  },
  {
    id: "cat_bo_luc_lac",
    title: "Bò Lúc Lắc Khoai Tây Cơm Chiên",
    restaurantName: "Nhà Hàng Hương Lài",
    price: 85000,
    priceMin: 80000,
    priceMax: 120000,
    distanceMeters: 1300,
    rating: 4.7,
    ratingCount: 340,
    category: "rice",
    image: DISH_PHOTO_REGISTRY.bo_luc_lac,
    reason: "Thịt bò thăn mềm xào bơ tỏi ớt chuông, kèm khoai chiên giòn rụm.",
  },

  // Nhóm Đồ Uống & Trà Sữa (8 món)
  {
    id: "cat_tra_dao",
    title: "Trà Đào Cam Sả Hạt Chia Khổng Lồ",
    restaurantName: "The Coffee House Pasteur",
    price: 35000,
    priceMin: 30000,
    priceMax: 45000,
    distanceMeters: 300,
    rating: 4.9,
    ratingCount: 1200,
    category: "drink",
    image: DISH_PHOTO_REGISTRY.tra_dao,
    reason: "Thức uống quốc dân thanh mát, sả đập dập thơm lừng và đào giòn ngọt ngào.",
  },
  {
    id: "cat_ca_phe_muoi",
    title: "Cà Phê Muối Kem Béo Xứ Huế",
    restaurantName: "Cà Phê Muối Chú Long",
    price: 28000,
    priceMin: 25000,
    priceMax: 35000,
    distanceMeters: 400,
    rating: 4.9,
    ratingCount: 950,
    category: "drink",
    image: DISH_PHOTO_REGISTRY.ca_phe_muoi,
    reason: "Lớp kem muối sánh mịn mặn mặn béo ngậy trung hòa vị đắng êm ái của cà phê.",
  },
  {
    id: "cat_tra_sua",
    title: "Trà Sữa Trân Châu Đường Đen Kem Cheese",
    restaurantName: "TocoToco Tea & Coffee",
    price: 38000,
    priceMin: 35000,
    priceMax: 55000,
    distanceMeters: 500,
    rating: 4.7,
    ratingCount: 780,
    category: "drink",
    image: DISH_PHOTO_REGISTRY.tra_sua,
    reason: "Trân châu đường đen dẻo dai nóng hổi, hòa cùng trà sữa béo thơm nồng nàn.",
  },
  {
    id: "cat_bac_xiu",
    title: "Bạc Xỉu 3 Tầng Sữa Đá",
    restaurantName: "Cà Phê Sài Gòn Retro",
    price: 26000,
    priceMin: 22000,
    priceMax: 32000,
    distanceMeters: 350,
    rating: 4.8,
    ratingCount: 460,
    category: "drink",
    image: DISH_PHOTO_REGISTRY.bac_xiu,
    reason: "Ngọt ngào nhiều sữa ít cà phê, béo ngậy thích hợp cho người không quen uống đắng.",
  },
  {
    id: "cat_sinh_to_bo",
    title: "Sinh Tố Bơ Sáp Dừa Tươi Đặc Biệt",
    restaurantName: "Sinh Tố & Nước Ép 24/7",
    price: 40000,
    priceMin: 35000,
    priceMax: 50000,
    distanceMeters: 600,
    rating: 4.8,
    ratingCount: 390,
    category: "drink",
    image: DISH_PHOTO_REGISTRY.sinh_to_bo,
    reason: "Bơ sáp dẻo quánh xay mịn không đá dăm, béo thơm dinh dưỡng tuyệt vời.",
  },
  {
    id: "cat_nuoc_ep_cam",
    title: "Nước Ép Cam Cà Rốt Tươi Giàu Vitamin",
    restaurantName: "Juice Bar Healthy Clean",
    price: 35000,
    priceMin: 30000,
    priceMax: 45000,
    distanceMeters: 650,
    rating: 4.7,
    ratingCount: 210,
    category: "drink",
    image: DISH_PHOTO_REGISTRY.nuoc_ep_cam,
    reason: "Nước ép nguyên chất không thêm đường, sáng da và giải tỏa căng thẳng tức thì.",
  },
  {
    id: "cat_tra_olong",
    title: "Trà Ô Long Nướng Macchiato Kem Mặn",
    restaurantName: "Gong Cha Premium",
    price: 45000,
    priceMin: 40000,
    priceMax: 60000,
    distanceMeters: 700,
    rating: 4.8,
    ratingCount: 670,
    category: "drink",
    image: DISH_PHOTO_REGISTRY.tra_olong,
    reason: "Lớp váng sữa macchiato sánh đặc trên nền trà ô long rang mộc thơm thanh tao.",
  },
  {
    id: "cat_ca_phe_sua",
    title: "Cà Phê Sữa Đá Pha Phin Sài Gòn",
    restaurantName: "Highlands Coffee Landmark",
    price: 29000,
    priceMin: 25000,
    priceMax: 35000,
    distanceMeters: 250,
    rating: 4.6,
    ratingCount: 1500,
    category: "drink",
    image: DISH_PHOTO_REGISTRY.ca_phe_sua,
    reason: "Cà phê sữa đá kinh điển khởi đầu buổi chiều tỉnh táo và tràn đầy năng lượng.",
  },

  // Nhóm Bánh mì & Ăn vặt & Fastfood (6 món)
  {
    id: "cat_banh_mi_chao",
    title: "Bánh Mì Chảo Xíu Mại Pate Trứng Muối",
    restaurantName: "Bánh Mì Chảo Cột Điện",
    price: 45000,
    priceMin: 40000,
    priceMax: 60000,
    distanceMeters: 550,
    rating: 4.7,
    ratingCount: 380,
    category: "dessert",
    image: DISH_PHOTO_REGISTRY.banh_mi_chao,
    reason: "Nước sốt cà chua sền sệt chấm bánh mì giòn rụm, pate béo ngậy khó cưỡng.",
  },
  {
    id: "cat_banh_mi",
    title: "Bánh Mì Kẹp Thịt Nướng Đặc Biệt",
    restaurantName: "Bánh Mì Huỳnh Hoa",
    price: 35000,
    priceMin: 25000,
    priceMax: 58000,
    distanceMeters: 800,
    rating: 4.8,
    ratingCount: 2200,
    category: "dessert",
    image: DISH_PHOTO_REGISTRY.banh_mi,
    reason: "Vỏ bánh giòn tan ngập tràn thịt nguội, chả lụa và bơ tươi béo ngậy.",
  },
  {
    id: "cat_banh_cuon",
    title: "Bánh Cuốn Nóng Thịt Bằm Mộc Nhĩ",
    restaurantName: "Bánh Cuốn Tây Hồ",
    price: 40000,
    priceMin: 35000,
    priceMax: 50000,
    distanceMeters: 900,
    rating: 4.7,
    ratingCount: 420,
    category: "dessert",
    image: DISH_PHOTO_REGISTRY.banh_cuon,
    reason: "Bánh tráng mỏng tang mướt mát, hành phi giòn tan và chả quế nóng hổi.",
  },
  {
    id: "cat_banh_xeo",
    title: "Bánh Xèo Tôm Nhảy Miền Trung",
    restaurantName: "Bánh Xèo Mười Xiềm",
    price: 65000,
    priceMin: 55000,
    priceMax: 90000,
    distanceMeters: 1500,
    rating: 4.6,
    ratingCount: 310,
    category: "dessert",
    image: DISH_PHOTO_REGISTRY.banh_xeo,
    reason: "Vỏ bánh vàng ươm giòn rụm, cuộn bánh tráng và rau sống chấm mắm nêm đậm đà.",
  },
  {
    id: "cat_ga_ran",
    title: "Gà Rán Giòn Sốt Cay Tỏi Hàn Quốc",
    restaurantName: "Bonchon Chicken Central",
    price: 75000,
    priceMin: 70000,
    priceMax: 120000,
    distanceMeters: 950,
    rating: 4.8,
    ratingCount: 650,
    category: "dessert",
    image: DISH_PHOTO_REGISTRY.ga_ran,
    reason: "Lớp vỏ bột giòn tan đẫm sốt cay ngọt tỏi mật, thịt gà thơm mềm nóng hổi.",
  },
  {
    id: "cat_pizza",
    title: "Pizza Phô Mai Mozzarella 4 Vị",
    restaurantName: "Pizza 4P's Saigon Centre",
    price: 125000,
    priceMin: 110000,
    priceMax: 180000,
    distanceMeters: 800,
    rating: 4.9,
    ratingCount: 1800,
    category: "dessert",
    image: DISH_PHOTO_REGISTRY.pizza,
    reason: "Đế bánh nướng củi thơm lừng, ngập tràn phô mai béo ngậy kéo sợi hấp dẫn.",
  },

  // Nhóm Healthy & Chay (4 món)
  {
    id: "cat_salad",
    title: "Salad Ức Gà Nướng Sốt Mè Rang",
    restaurantName: "Eat Clean Salad Bar",
    price: 58000,
    priceMin: 50000,
    priceMax: 75000,
    distanceMeters: 600,
    rating: 4.7,
    ratingCount: 230,
    category: "healthy",
    image: DISH_PHOTO_REGISTRY.salad,
    reason: "Rau củ hữu cơ giòn mát, ức gà nướng thảo mộc ít calo giàu đạm.",
  },
  {
    id: "cat_pho_cuon",
    title: "Phở Cuốn Thanh Đạm Chấm Mắm Chua Ngọt",
    restaurantName: "Phở Cuốn Hương Mai",
    price: 55000,
    priceMin: 50000,
    priceMax: 65000,
    distanceMeters: 850,
    rating: 4.8,
    ratingCount: 410,
    category: "healthy",
    image: DISH_PHOTO_REGISTRY.pho_cuon,
    reason: "Món ăn thanh đạm cuốn nhiều rau xà lách, không dầu mỡ nhẹ bụng buổi trưa.",
  },
  {
    id: "cat_goi_cuon",
    title: "Gỏi Cuốn Tôm Thịt Nước Tương Đậu",
    restaurantName: "Quán Ăn Việt Healthy",
    price: 45000,
    priceMin: 40000,
    priceMax: 60000,
    distanceMeters: 500,
    rating: 4.6,
    ratingCount: 190,
    category: "healthy",
    image: DISH_PHOTO_REGISTRY.goi_cuon,
    reason: "Ít tinh bột, giàu đạm tôm thịt tươi, chấm tương bơ đậu phộng béo bùi.",
  },
  {
    id: "cat_nuoc_mia",
    title: "Nước Mía Tắc Cốt Dừa Giải Nhiệt",
    restaurantName: "Nước Mía Sạch Vườn Xanh",
    price: 15000,
    priceMin: 12000,
    priceMax: 25000,
    distanceMeters: 200,
    rating: 4.9,
    ratingCount: 600,
    category: "healthy",
    image: DISH_PHOTO_REGISTRY.nuoc_mia,
    reason: "Vị ngọt thanh tự nhiên từ cây mía kết hợp tắc chua nhẹ mát lạnh từng ngụm.",
  },
];
