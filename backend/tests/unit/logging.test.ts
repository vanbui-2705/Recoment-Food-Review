import { expect, it } from "vitest";
import { safeError, safeRequest } from "../../src/common/observability/logging.js";
it("omits authorization, raw query, internal errors, stack and database arguments", () => {
  const error = Object.assign(new Error("api-key-secret and password hash"), {
    code: "P2002",
    query: "private profile",
    name: "PrismaClientKnownRequestError",
  });
  expect(safeError(error)).toEqual({
    type: "PrismaClientKnownRequestError",
    code: "P2002",
    message: "Internal error",
    stack: "",
  });
  expect(
    safeRequest({ id: "request-1", method: "GET", url: "/api/search?q=allergy&key=secret" }),
  ).toEqual({ id: "request-1", method: "GET", url: "/api/search" });
  expect(safeError({ name: "user private text", code: "raw secret text" })).toEqual({
    type: "UnhandledError",
    code: "UNEXPECTED_ERROR",
    message: "Internal error",
    stack: "",
  });
});
