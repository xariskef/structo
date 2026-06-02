import assert from "node:assert/strict";
import test from "node:test";

import { StorageResolver } from "../dist/modules/site-storage/storage-resolver.service.js";
import {
  encryptSecret,
  loadStorageEncryptionKey,
} from "../dist/modules/site-storage/secret-cipher.js";

const HEX_KEY = "c".repeat(64);

const STORAGE_SETTING_KEYS = {
  provider: "storage.provider",
  accountId: "storage.accountId",
  accessKeyId: "storage.accessKeyId",
  bucket: "storage.bucket",
  publicBaseUrl: "storage.publicBaseUrl",
  secret: "storage.secret",
};

const fallback = {
  putObject() {
    return Promise.resolve({ key: "k", url: "https://fallback.example.com/k" });
  },
  deleteObject() {
    return Promise.resolve();
  },
};

function makePerSiteRows(siteId) {
  const key = Buffer.from(HEX_KEY, "hex");
  const encrypted = encryptSecret("per-site-secret", key);
  return [
    { siteId, key: STORAGE_SETTING_KEYS.provider, value: "r2" },
    { siteId, key: STORAGE_SETTING_KEYS.accountId, value: "acct-1" },
    { siteId, key: STORAGE_SETTING_KEYS.accessKeyId, value: "key-1" },
    { siteId, key: STORAGE_SETTING_KEYS.bucket, value: "my-bucket" },
    {
      siteId,
      key: STORAGE_SETTING_KEYS.publicBaseUrl,
      value: "https://pub.example.com",
    },
    { siteId, key: STORAGE_SETTING_KEYS.secret, value: encrypted },
  ];
}

test("getForSite returns the fallback provider when there are no storage settings", async () => {
  const db = {
    client: {
      siteSetting: {
        findMany() {
          return Promise.resolve([]);
        },
      },
    },
  };
  const resolver = new StorageResolver(db, fallback);
  const provider = await resolver.getForSite("site-a");
  assert.strictEqual(provider, fallback);
});

test("getForSite returns the fallback when STORAGE_ENCRYPTION_KEY is absent", async () => {
  const siteId = "site-b";
  const db = {
    client: {
      siteSetting: {
        findMany() {
          return Promise.resolve(makePerSiteRows(siteId));
        },
      },
    },
  };
  // Do not set env var — resolver reads from process.env at construction time.
  delete process.env.STORAGE_ENCRYPTION_KEY;
  const resolver = new StorageResolver(db, fallback);
  const provider = await resolver.getForSite(siteId);
  assert.strictEqual(provider, fallback);
});

test("getForSite returns a per-site provider when all rows and key are present", async () => {
  process.env.STORAGE_ENCRYPTION_KEY = HEX_KEY;
  const siteId = "site-c";
  const db = {
    client: {
      siteSetting: {
        findMany() {
          return Promise.resolve(makePerSiteRows(siteId));
        },
      },
    },
  };
  const resolver = new StorageResolver(db, fallback);
  const provider = await resolver.getForSite(siteId);
  assert.notStrictEqual(provider, fallback);
  // Reset env
  delete process.env.STORAGE_ENCRYPTION_KEY;
});

test("loadConfig returns null when rows are missing required fields", async () => {
  const db = {
    client: {
      siteSetting: {
        findMany() {
          // Only provider row — the rest are absent.
          return Promise.resolve([
            {
              siteId: "site-d",
              key: STORAGE_SETTING_KEYS.provider,
              value: "r2",
            },
          ]);
        },
      },
    },
  };
  process.env.STORAGE_ENCRYPTION_KEY = HEX_KEY;
  const resolver = new StorageResolver(db, fallback);
  const config = await resolver.loadConfig("site-d");
  assert.equal(config, null);
  delete process.env.STORAGE_ENCRYPTION_KEY;
});
