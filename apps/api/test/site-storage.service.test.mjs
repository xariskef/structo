import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException } from "@nestjs/common";

import { SiteStorageService } from "../dist/modules/site-storage/site-storage.service.js";

const HEX_KEY = "d".repeat(64);

const STORAGE_SETTING_KEYS = {
  provider: "storage.provider",
  accountId: "storage.accountId",
  accessKeyId: "storage.accessKeyId",
  bucket: "storage.bucket",
  publicBaseUrl: "storage.publicBaseUrl",
  secret: "storage.secret",
};

function authorization() {
  return { assertSitePermission() {} };
}

/**
 * Build a minimal Prisma-like client mock. The `findMany` for `siteSetting`
 * powers both `storageResolver.loadConfig` (when called from update) and
 * `readStatus`.  Pass `rows` to control what it returns.
 */
function createClient({ rows = [], upserts = [], auditCreates = [] } = {}) {
  const client = {
    $transaction: (arg) =>
      typeof arg === "function"
        ? arg(client)
        : Promise.all(arg.map((p) => Promise.resolve(p))),

    site: {
      findUniqueOrThrow() {
        return Promise.resolve({ organizationId: "org-a" });
      },
    },
    siteSetting: {
      findMany() {
        return Promise.resolve(rows);
      },
      upsert(args) {
        upserts.push(args);
        return Promise.resolve(args.create);
      },
      deleteMany(args) {
        return Promise.resolve({ count: 0 });
      },
    },
    auditLog: {
      create(args) {
        auditCreates.push(args);
        return Promise.resolve({});
      },
    },
  };
  return client;
}

function makeStorageResolver(overrides = {}) {
  return {
    loadConfig() {
      return Promise.resolve(null);
    },
    buildProvider() {
      return {
        putObject() {
          return Promise.resolve({ key: "k", url: "https://r2.example.com/k" });
        },
        deleteObject() {
          return Promise.resolve();
        },
      };
    },
    ...overrides,
  };
}

const SAMPLE_INPUT = {
  provider: "r2",
  accountId: "acct-1",
  accessKeyId: "key-id-1",
  secretAccessKey: "secret-value",
  bucket: "my-bucket",
  publicBaseUrl: "https://pub.example.com",
};

/** Stubs globalThis.fetch to return HTTP 200 for the duration of the callback. */
async function withFetchOk(fn) {
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve({ ok: true, status: 200 });
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

test("getStatus does not include the secret access key in the response", async () => {
  process.env.STORAGE_ENCRYPTION_KEY = HEX_KEY;
  const client = createClient();
  const service = new SiteStorageService(
    { client },
    authorization(),
    makeStorageResolver(),
  );

  const status = await service.getStatus("user-a", "site-a");

  assert.equal(typeof status.secretSet, "boolean");
  assert.equal("secretAccessKey" in status, false);
  assert.equal(status.configured, false);
  delete process.env.STORAGE_ENCRYPTION_KEY;
});

test("update encrypts and upserts all 6 rows plus writes the audit event", async () => {
  process.env.STORAGE_ENCRYPTION_KEY = HEX_KEY;

  const upserts = [];
  const auditCreates = [];
  const client = createClient({ upserts, auditCreates });

  const service = new SiteStorageService(
    { client },
    authorization(),
    makeStorageResolver(),
  );

  await withFetchOk(() => service.update("user-a", "site-a", SAMPLE_INPUT));

  assert.equal(upserts.length, 6, "should upsert 6 site-setting rows");

  const keys = upserts.map((u) => u.where.siteId_key.key);
  assert.ok(keys.includes(STORAGE_SETTING_KEYS.provider));
  assert.ok(keys.includes(STORAGE_SETTING_KEYS.accountId));
  assert.ok(keys.includes(STORAGE_SETTING_KEYS.accessKeyId));
  assert.ok(keys.includes(STORAGE_SETTING_KEYS.bucket));
  assert.ok(keys.includes(STORAGE_SETTING_KEYS.publicBaseUrl));
  assert.ok(keys.includes(STORAGE_SETTING_KEYS.secret));

  // The stored secret must NOT be the plaintext.
  const secretUpsert = upserts.find(
    (u) => u.where.siteId_key.key === STORAGE_SETTING_KEYS.secret,
  );
  assert.notEqual(secretUpsert.create.value, SAMPLE_INPUT.secretAccessKey);

  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "site.storage.update");

  delete process.env.STORAGE_ENCRYPTION_KEY;
});

test("update reuses the stored secret when the client omits it", async () => {
  process.env.STORAGE_ENCRYPTION_KEY = HEX_KEY;

  // Simulate an existing stored config with an encrypted secret.
  const { encryptSecret } =
    await import("../dist/modules/site-storage/secret-cipher.js");
  const existingKey = Buffer.from(HEX_KEY, "hex");
  const encrypted = encryptSecret("existing-secret", existingKey);

  const upserts = [];
  const client = createClient({ upserts });

  const resolver = makeStorageResolver({
    loadConfig() {
      return Promise.resolve({
        accountId: "acct-1",
        accessKeyId: "key-id-1",
        secretAccessKey: "existing-secret",
        bucket: "my-bucket",
        publicBaseUrl: "https://pub.example.com",
      });
    },
  });

  const service = new SiteStorageService({ client }, authorization(), resolver);

  // Omit secretAccessKey from the input.
  const { secretAccessKey: _omitted, ...inputWithoutSecret } = SAMPLE_INPUT;
  await withFetchOk(() => service.update("user-a", "site-a", inputWithoutSecret));

  const secretUpsert = upserts.find(
    (u) => u.where.siteId_key.key === STORAGE_SETTING_KEYS.secret,
  );
  assert.ok(secretUpsert, "should still upsert the secret row");
  // The stored value must not be plaintext.
  assert.notEqual(secretUpsert.create.value, "existing-secret");

  delete process.env.STORAGE_ENCRYPTION_KEY;
});

test("update throws BadRequestException when credential validation fails", async () => {
  process.env.STORAGE_ENCRYPTION_KEY = HEX_KEY;

  const client = createClient();
  const resolver = makeStorageResolver({
    buildProvider() {
      return {
        putObject() {
          return Promise.reject(new Error("Access denied"));
        },
        deleteObject() {
          return Promise.resolve();
        },
      };
    },
  });

  const service = new SiteStorageService({ client }, authorization(), resolver);

  await assert.rejects(
    service.update("user-a", "site-a", SAMPLE_INPUT),
    (error) => error instanceof BadRequestException,
  );

  delete process.env.STORAGE_ENCRYPTION_KEY;
});

test("update rejects publicBaseUrl that is an R2 S3 API endpoint", async () => {
  process.env.STORAGE_ENCRYPTION_KEY = HEX_KEY;

  const client = createClient();
  const service = new SiteStorageService(
    { client },
    authorization(),
    makeStorageResolver(),
  );

  await assert.rejects(
    service.update("user-a", "site-a", {
      ...SAMPLE_INPUT,
      publicBaseUrl: "https://abc123.r2.cloudflarestorage.com/my-bucket",
    }),
    (error) => error instanceof BadRequestException,
  );

  delete process.env.STORAGE_ENCRYPTION_KEY;
});
