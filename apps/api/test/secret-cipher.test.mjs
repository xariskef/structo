import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptSecret,
  encryptSecret,
  loadStorageEncryptionKey,
} from "../dist/modules/site-storage/secret-cipher.js";

// 64 hex = 32 bytes
const HEX_KEY = "a".repeat(64);
// same 32 bytes as base64
const B64_KEY = Buffer.from(HEX_KEY, "hex").toString("base64");

test("loadStorageEncryptionKey returns null when env var is absent", () => {
  const key = loadStorageEncryptionKey({});
  assert.equal(key, null);
});

test("loadStorageEncryptionKey accepts a 64-character hex string", () => {
  const key = loadStorageEncryptionKey({ STORAGE_ENCRYPTION_KEY: HEX_KEY });
  assert.ok(key instanceof Buffer);
  assert.equal(key.length, 32);
});

test("loadStorageEncryptionKey accepts base64-encoded 32 bytes", () => {
  const key = loadStorageEncryptionKey({ STORAGE_ENCRYPTION_KEY: B64_KEY });
  assert.ok(key instanceof Buffer);
  assert.equal(key.length, 32);
});

test("loadStorageEncryptionKey rejects a hex value that decodes to the wrong length", () => {
  assert.throws(
    () =>
      loadStorageEncryptionKey({
        STORAGE_ENCRYPTION_KEY: "ab".repeat(16), // 16 bytes — too short
      }),
    (error) => error instanceof Error,
  );
});

test("loadStorageEncryptionKey rejects base64 that decodes to the wrong length", () => {
  assert.throws(
    () =>
      loadStorageEncryptionKey({
        // 16 random bytes in base64 (24 chars with padding)
        STORAGE_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64"),
      }),
    (error) => error instanceof Error,
  );
});

test("encrypt then decrypt round-trip returns the original plaintext", () => {
  const key = Buffer.from(HEX_KEY, "hex");
  const plaintext = "super-secret-access-key";
  const ciphertext = encryptSecret(plaintext, key);
  assert.equal(typeof ciphertext, "string");
  assert.ok(ciphertext.startsWith("v1:"), "ciphertext should start with v1:");
  const recovered = decryptSecret(ciphertext, key);
  assert.equal(recovered, plaintext);
});

test("decrypt with a different key throws", () => {
  const keyA = Buffer.from(HEX_KEY, "hex");
  const keyB = Buffer.from("b".repeat(64), "hex");
  const ciphertext = encryptSecret("secret", keyA);
  assert.throws(
    () => decryptSecret(ciphertext, keyB),
    (error) => error instanceof Error,
  );
});

test("decrypt with a malformed ciphertext throws", () => {
  const key = Buffer.from(HEX_KEY, "hex");
  assert.throws(
    () => decryptSecret("not-a-valid-ciphertext", key),
    (error) => error instanceof Error,
  );
});
