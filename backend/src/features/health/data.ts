import { prisma } from "../../prisma";

export async function healthStatus() {
  await prisma.$queryRaw`SELECT 1`;
  return { status: "ok", data: "live", database: "postgresql" };
}
