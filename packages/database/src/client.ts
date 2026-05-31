import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "./generated/prisma/client.js";

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  return databaseUrl;
}

export function createDatabaseClient(): PrismaClient {
  const adapter = new PrismaNeon({
    connectionString: getDatabaseUrl(),
  });

  return new PrismaClient({ adapter });
}
