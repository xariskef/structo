// Dev/ops helper to grant or revoke Structo platform operator access.
//
// Platform operator access is intentionally NOT granted during registration.
// Run this against a built database package (pnpm --filter @structo/database build):
//
//   pnpm --filter @structo/database db:grant-operator <email>
//   pnpm --filter @structo/database db:grant-operator <email> --revoke
//
// Requires DATABASE_URL (read from the repo-root .env / .env.local, like the API).
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

import { createDatabaseClient } from "../dist/index.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
config({
  path: fileURLToPath(new URL("../../../.env.local", import.meta.url)),
  override: true,
});

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");

if (!email || email.startsWith("--")) {
  console.error(
    "Usage: pnpm --filter @structo/database db:grant-operator <email> [--revoke]",
  );
  process.exit(1);
}

const db = createDatabaseClient();

try {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    console.error(`No user found with email ${email}.`);
    process.exit(1);
  }

  if (revoke) {
    await db.platformOperatorAccess.deleteMany({ where: { userId: user.id } });
    console.log(`Revoked platform operator access for ${user.email}.`);
  } else {
    const access = await db.platformOperatorAccess.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    console.log(`Granted ${access.role} to ${user.email}.`);
  }
} finally {
  await db.$disconnect();
}
