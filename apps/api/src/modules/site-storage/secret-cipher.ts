import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

/**
 * Load the 32-byte AES key used to encrypt per-site storage secrets at rest.
 * Accepts 64 hex chars or base64. Returns null when unset so the platform-level
 * env fallback still works without configuring per-site secrets.
 */
export function loadStorageEncryptionKey(
  env: NodeJS.ProcessEnv = process.env,
): Buffer | null {
  const raw = env.STORAGE_ENCRYPTION_KEY;
  if (!raw) {
    return null;
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "STORAGE_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64).",
    );
  }
  return key;
}

export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    data.toString("base64"),
  ].join(":");
}

export function decryptSecret(ciphertext: string, key: Buffer): string {
  const [version, ivB64, tagB64, dataB64] = ciphertext.split(":");
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted storage secret.");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
