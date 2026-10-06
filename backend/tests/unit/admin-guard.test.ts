import { expect, it } from "vitest";
import { assertAdminRemains } from "../../src/modules/admin/admin.users.js";
it("prevents disabling the final administrator while allowing other moderation", () => {
  expect(() => assertAdminRemains("ADMIN", "ACTIVE", "DISABLED", 1)).toThrow("cuối cùng");
  expect(() => assertAdminRemains("ADMIN", "ACTIVE", "DISABLED", 0)).toThrow();
  expect(() => assertAdminRemains("ADMIN", "ACTIVE", "DISABLED", 2)).not.toThrow();
  expect(() => assertAdminRemains("ADMIN", "DISABLED", "ACTIVE", 0)).not.toThrow();
  expect(() => assertAdminRemains("USER", "ACTIVE", "DISABLED", 1)).not.toThrow();
});
