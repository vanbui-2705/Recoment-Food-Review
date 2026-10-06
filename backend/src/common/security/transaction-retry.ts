import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../errors/app-error.js";

export async function serializableWrite<T>(
  prisma: PrismaClient,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  retryUnique = false,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: "Serializable" });
    } catch (error) {
      const cause =
        error instanceof Error
          ? (error.cause as { kind?: unknown; originalCode?: unknown } | undefined)
          : undefined;
      const adapterConflict =
        error instanceof Error &&
        error.name === "DriverAdapterError" &&
        cause?.kind === "TransactionWriteConflict" &&
        ["40001", "40P01"].includes(String(cause.originalCode));
      const rawCause =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2010"
          ? (
              error.meta?.driverAdapterError as
                { cause?: { kind?: unknown; originalCode?: unknown } } | undefined
            )?.cause
          : undefined;
      const retry =
        adapterConflict ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2034" ||
            (error.code === "P2010" &&
              (["40001", "40P01"].includes(String(error.meta?.code)) ||
                (rawCause?.kind === "TransactionWriteConflict" &&
                  ["40001", "40P01"].includes(String(rawCause.originalCode))))) ||
            (retryUnique && error.code === "P2002")));
      if (!retry) throw error;
      if (attempt === 2)
        throw new AppError(
          409,
          "WRITE_CONFLICT",
          "Dữ liệu đang được cập nhật; hãy thử lại bằng cùng mã thao tác",
        );
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
  throw new Error("Unreachable transaction retry state");
}
