import { PrismaClient } from "@prisma/client";

export const databaseProvider = process.env.DATABASE_PROVIDER === "postgresql" ? "postgresql" : "sqlite";
export const prisma = new PrismaClient();
