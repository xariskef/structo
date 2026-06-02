import { Inject, Injectable, Logger } from "@nestjs/common";
import { R2StorageProvider, type StorageProvider } from "@structo/storage";

import { DatabaseService } from "../database/database.service.js";
import { decryptSecret, loadStorageEncryptionKey } from "./secret-cipher.js";
import {
  FALLBACK_STORAGE_PROVIDER,
  STORAGE_SETTING_KEYS,
} from "./site-storage.tokens.js";

export interface SiteStorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

/**
 * Resolves the storage provider for a site: its own configured R2 bucket when
 * present, otherwise the platform-level env fallback. Media upload/delete go
 * through this so each site can bring its own bucket.
 */
@Injectable()
export class StorageResolver {
  private readonly logger = new Logger(StorageResolver.name);
  private readonly key: Buffer | null = loadStorageEncryptionKey();

  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(FALLBACK_STORAGE_PROVIDER)
    private readonly fallback: StorageProvider,
  ) {}

  buildProvider(config: SiteStorageConfig): StorageProvider {
    return new R2StorageProvider(config);
  }

  async getForSite(siteId: string): Promise<StorageProvider> {
    const config = await this.loadConfig(siteId);
    return config ? this.buildProvider(config) : this.fallback;
  }

  async loadConfig(siteId: string): Promise<SiteStorageConfig | null> {
    const rows = await this.db.client.siteSetting.findMany({
      where: { siteId, key: { in: Object.values(STORAGE_SETTING_KEYS) } },
    });
    const map = new Map(rows.map((row) => [row.key, row.value]));
    const accountId = map.get(STORAGE_SETTING_KEYS.accountId);
    const accessKeyId = map.get(STORAGE_SETTING_KEYS.accessKeyId);
    const bucket = map.get(STORAGE_SETTING_KEYS.bucket);
    const publicBaseUrl = map.get(STORAGE_SETTING_KEYS.publicBaseUrl);
    const secret = map.get(STORAGE_SETTING_KEYS.secret);

    if (
      map.get(STORAGE_SETTING_KEYS.provider) !== "r2" ||
      !accountId ||
      !accessKeyId ||
      !bucket ||
      !publicBaseUrl ||
      !secret
    ) {
      return null;
    }

    if (!this.key) {
      this.logger.warn(
        `Site ${siteId} has storage configured but STORAGE_ENCRYPTION_KEY is unset; using the platform fallback.`,
      );
      return null;
    }

    try {
      return {
        accountId,
        accessKeyId,
        bucket,
        publicBaseUrl,
        secretAccessKey: decryptSecret(secret, this.key),
      };
    } catch (error) {
      this.logger.error(
        `Failed to decrypt storage secret for site ${siteId}; using the platform fallback. ${
          error instanceof Error ? error.message : ""
        }`,
      );
      return null;
    }
  }
}
