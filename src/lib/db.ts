// Server-only (Node.js runtime). Do NOT import from Edge middleware.
// A single shared PrismaClient — guarded against dev hot-reload creating many clients.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
