// Platform-level fallback storage provider built from R2_* environment
// variables. Used when a site has no per-site storage configuration.
export const FALLBACK_STORAGE_PROVIDER = Symbol("FALLBACK_STORAGE_PROVIDER");

// Storage configuration is persisted as site settings under these keys. The
// secret is stored encrypted; the SettingsService ignores these keys.
export const STORAGE_SETTING_KEYS = {
  provider: "storage.provider",
  accountId: "storage.accountId",
  accessKeyId: "storage.accessKeyId",
  bucket: "storage.bucket",
  publicBaseUrl: "storage.publicBaseUrl",
  secret: "storage.secret",
} as const;
