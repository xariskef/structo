import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

config({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
});

config({
  path: fileURLToPath(new URL("../../.env.local", import.meta.url)),
  override: true,
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
