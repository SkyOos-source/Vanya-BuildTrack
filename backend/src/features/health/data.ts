import { prisma } from "../../prisma";

export async function healthStatus() {
  await prisma.$queryRaw`SELECT 1`;
  const database = process.env.DATABASE_URL?.startsWith("file:") ? "sqlite" : "postgresql";
  return { status: "ok", data: "live", database };
}
