import { describe, expect, it } from "vitest";
import { Prisma, type PrismaClient } from "../../src/generated/prisma/client.js";
import { serializableWrite } from "../../src/common/security/transaction-retry.js";
function adapterConflict() {
  const error = new Error("TransactionWriteConflict", {
    cause: { kind: "TransactionWriteConflict", originalCode: "40001" },
  });
  error.name = "DriverAdapterError";
  return error;
}
describe("bounded transaction retry at PostgreSQL commit", () => {
  it("recognizes raw-query serialization/deadlock SQL states without retrying access failures", async () => {
    for (const code of ["40001", "40P01", "42501"]) {
      for (const meta of [
        { code },
        {
          driverAdapterError: {
            cause: {
              kind: code === "42501" ? "AccessDenied" : "TransactionWriteConflict",
              originalCode: code,
            },
          },
        },
      ]) {
        const error = new Prisma.PrismaClientKnownRequestError("private-query-failure", {
          code: "P2010",
          clientVersion: "test",
          meta,
        });
        let attempts = 0;
        const prisma = {
          $transaction: async () => {
            if (++attempts === 1) throw error;
            return "committed";
          },
        } as unknown as PrismaClient;
        if (code === "42501") {
          await expect(serializableWrite(prisma, async () => null)).rejects.toBe(error);
          expect(attempts).toBe(1);
        } else {
          expect(await serializableWrite(prisma, async () => null)).toBe("committed");
          expect(attempts).toBe(2);
        }
      }
    }
  });
  it("retries an adapter serialization conflict and returns only the successful result", async () => {
    let attempts = 0;
    const prisma = {
      $transaction: async () => {
        if (++attempts === 1) throw adapterConflict();
        return "committed";
      },
    } as unknown as PrismaClient;
    expect(await serializableWrite(prisma, async () => "unused")).toBe("committed");
    expect(attempts).toBe(2);
  });
  it("bounds serialization retries and does not retry an unrelated driver failure", async () => {
    let attempts = 0;
    const prisma = {
      $transaction: async () => {
        attempts++;
        throw adapterConflict();
      },
    } as unknown as PrismaClient;
    await expect(serializableWrite(prisma, async () => null)).rejects.toMatchObject({
      code: "WRITE_CONFLICT",
    });
    expect(attempts).toBe(3);
    const denied = new Error("Permission denied", {
      cause: { kind: "AccessDenied", originalCode: "42501" },
    });
    denied.name = "DriverAdapterError";
    attempts = 0;
    const unavailable = {
      $transaction: async () => {
        attempts++;
        throw denied;
      },
    } as unknown as PrismaClient;
    await expect(serializableWrite(unavailable, async () => null)).rejects.toBe(denied);
    expect(attempts).toBe(1);
  });
});
