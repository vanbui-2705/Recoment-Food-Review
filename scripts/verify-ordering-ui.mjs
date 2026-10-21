import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = "C:/Users/bui van/.gemini/antigravity/brain/cc897ff2-5803-4948-9e82-7b6ad70f7e3a";

async function main() {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  // Mock authenticated session
  await page.addInitScript(() => {
    localStorage.setItem("eatwise_access_token", "test-token");
    localStorage.setItem(
      "eatwise_user_profile",
      JSON.stringify({
        displayName: "Nguyễn Tuấn Kiên",
        areaLabel: "Cầu Giấy, Hà Nội",
        latitude: 21.0315,
        longitude: 105.7895,
      })
    );
  });

  console.log("Navigating to today discovery page...");
  await page.goto("http://localhost:5173/#today", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // If on login page, click "User Test" quick login
  const quickLoginBtn = page.getByRole("button", { name: /User Test/i });
  if (await quickLoginBtn.isVisible()) {
    console.log("Logging in via User Test...");
    await quickLoginBtn.click();
    await page.waitForTimeout(600);
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    console.log("Submitted login, waiting for dashboard...");
    await page.waitForTimeout(3500);
  }

  // Screenshot 1: Discovery Page with Diverse Menu
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "discovery-diversified-menu.png"),
    fullPage: false,
  });
  console.log("Screenshot 1: discovery-diversified-menu.png saved.");

  // Click on "Đặt món" on the first secondary card
  const orderButtons = page.getByRole("button", { name: "Đặt món" });
  if ((await orderButtons.count()) > 0) {
    await orderButtons.first().click();
    await page.waitForTimeout(1000);

    // Screenshot 2: Dish Customizer Modal
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "dish-customizer-modal.png"),
    });
    console.log("Screenshot 2: dish-customizer-modal.png saved.");

    // Select Size L, Extra topping, and confirm Add to Cart
    const sizeLBtn = page.getByRole("button", { name: /Size L/i });
    if (await sizeLBtn.isVisible()) {
      await sizeLBtn.click();
    }
    // Click Add to Cart button
    const addBtn = page.locator('button:has-text("Thêm vào giỏ")');
    if (await addBtn.isVisible()) {
      console.log("Clicking Thêm vào giỏ...");
      await addBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  // Open Cart Drawer via floating cart button
  const cartPill = page.locator('button[aria-label*="Giỏ hàng"]').first();
  if (await cartPill.isVisible()) {
    console.log("Opening Cart Drawer...");
    await cartPill.click();
    await page.waitForTimeout(1500);

    // Screenshot 3: Cart Drawer
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "cart-drawer.png"),
    });
    console.log("Screenshot 3: cart-drawer.png saved.");

    // Click on Checkout button
    const checkoutBtn = page.locator('button:has-text("Tiến hành đặt hàng")');
    if (await checkoutBtn.isVisible()) {
      console.log("Opening Checkout Modal...");
      await checkoutBtn.click();
      await page.waitForTimeout(1500);

      // Toggle VietQR to show QR banking code
      const qrToggle = page.getByText(/VietQR Banking/i);
      if (await qrToggle.isVisible()) {
        console.log("Toggling VietQR...");
        await qrToggle.click();
        await page.waitForTimeout(1200);
      }

      // Screenshot 4: Checkout Modal with VietQR
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, "checkout-modal-vietqr.png"),
      });
      console.log("Screenshot 4: checkout-modal-vietqr.png saved.");

      // Click on "Đặt đơn ngay"
      const placeOrderBtn = page.locator('button:has-text("Đặt đơn ngay")');
      if (await placeOrderBtn.isVisible()) {
        console.log("Submitting order...");
        await placeOrderBtn.click();
        await page.waitForTimeout(3000);

        // Screenshot 5: Order Tracking Modal with Live Stepper
        await page.screenshot({
          path: path.join(ARTIFACT_DIR, "order-tracking-modal.png"),
        });
        console.log("Screenshot 5: order-tracking-modal.png saved.");

        // Close order tracking modal
        const closeTrackingBtn = page.locator('button:has-text("Đóng cửa sổ theo dõi")');
        if (await closeTrackingBtn.isVisible()) {
          await closeTrackingBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  }

  // Ensure cart drawer is closed before moving to Map
  const closeCartBtn = page.locator('button[aria-label="Đóng giỏ hàng"]');
  if (await closeCartBtn.isVisible()) {
    await closeCartBtn.click();
    await page.waitForTimeout(500);
  }

  // Test Restaurant Storefront Modal on Map Page
  console.log("Navigating to Map page...");
  await page.goto("http://localhost:5173/#map", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const storefrontBtn = page.locator('button:has-text("Menu & Đặt món")').first();
  if (await storefrontBtn.isVisible()) {
    console.log("Opening Storefront Modal...");
    await storefrontBtn.click();
    await page.waitForTimeout(2000);

    // Screenshot 6: ShopeeFood/BeFood style Restaurant Storefront Modal
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "restaurant-storefront-modal.png"),
    });
    console.log("Screenshot 6: restaurant-storefront-modal.png saved.");
  }

  await browser.close();
  console.log("All ordering verification tests completed!");
}

main().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
