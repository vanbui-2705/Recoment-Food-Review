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
      const retry =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || (retryUnique && error.code === "P2002"));
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
