import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  SiteStorageStatus,
  UpdateSiteStorageInput,
} from "@structo/contracts";
import { isR2EnvConfigured, StorageProviderError } from "@structo/storage";
import { randomUUID } from "node:crypto";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";
import { assertSafePublicBaseUrl } from "./public-url-policy.js";
import { encryptSecret, loadStorageEncryptionKey } from "./secret-cipher.js";
import { STORAGE_SETTING_KEYS } from "./site-storage.tokens.js";
import {
  StorageResolver,
  type SiteStorageConfig,
} from "./storage-resolver.service.js";

@Injectable()
export class SiteStorageService {
  private readonly key: Buffer | null = loadStorageEncryptionKey();

  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
    @Inject(StorageResolver)
    private readonly storageResolver: StorageResolver,
  ) {}

  async getStatus(userId: string, siteId: string): Promise<SiteStorageStatus> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_settings",
    );
    return this.readStatus(siteId);
  }

  async update(
    userId: string,
    siteId: string,
    input: UpdateSiteStorageInput,
  ): Promise<SiteStorageStatus> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_settings",
    );

    if (!this.key) {
      throw new ServiceUnavailableException(
        "The server is missing STORAGE_ENCRYPTION_KEY; storage credentials cannot be stored.",
      );
    }

    // Secret is write-only: reuse the stored one when the client omits it.
    const existing = await this.storageResolver.loadConfig(siteId);
    const secretAccessKey = input.secretAccessKey ?? existing?.secretAccessKey;
    if (!secretAccessKey) {
      throw new BadRequestException("A secret access key is required.");
    }

    const config: SiteStorageConfig = {
      accountId: input.accountId,
      accessKeyId: input.accessKeyId,
      bucket: input.bucket,
      publicBaseUrl: input.publicBaseUrl,
      secretAccessKey,
    };

    // Reject credentials that cannot actually write to the bucket.
    await this.validate(siteId, config);

    const site = await this.db.client.site.findUniqueOrThrow({
      where: { id: siteId },
      select: { organizationId: true },
    });
    const encrypted = encryptSecret(secretAccessKey, this.key);
    const entries: [string, string][] = [
      [STORAGE_SETTING_KEYS.provider, input.provider],
      [STORAGE_SETTING_KEYS.accountId, input.accountId],
      [STORAGE_SETTING_KEYS.accessKeyId, input.accessKeyId],
      [STORAGE_SETTING_KEYS.bucket, input.bucket],
      [STORAGE_SETTING_KEYS.publicBaseUrl, input.publicBaseUrl],
      [STORAGE_SETTING_KEYS.secret, encrypted],
    ];

    await this.db.client.$transaction([
      ...entries.map(([key, value]) =>
        this.db.client.siteSetting.upsert({
          where: { siteId_key: { siteId, key } },
          create: { siteId, key, value },
          update: { value },
        }),
      ),
      this.db.client.auditLog.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          actorId: userId,
          action: "site.storage.update",
          entityType: "Site",
          entityId: siteId,
          metadata: { provider: input.provider, bucket: input.bucket },
        },
      }),
    ]);

    return this.readStatus(siteId);
  }

  async clear(userId: string, siteId: string): Promise<SiteStorageStatus> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_settings",
    );
    const site = await this.db.client.site.findUniqueOrThrow({
      where: { id: siteId },
      select: { organizationId: true },
    });

    await this.db.client.$transaction([
      this.db.client.siteSetting.deleteMany({
        where: { siteId, key: { in: Object.values(STORAGE_SETTING_KEYS) } },
      }),
      this.db.client.auditLog.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          actorId: userId,
          action: "site.storage.clear",
          entityType: "Site",
          entityId: siteId,
          metadata: {},
        },
      }),
    ]);

    return this.readStatus(siteId);
  }

  private async readStatus(siteId: string): Promise<SiteStorageStatus> {
    const rows = await this.db.client.siteSetting.findMany({
      where: { siteId, key: { in: Object.values(STORAGE_SETTING_KEYS) } },
    });
    const map = new Map(rows.map((row) => [row.key, row.value]));
    const accountId = map.get(STORAGE_SETTING_KEYS.accountId) ?? null;
    const accessKeyId = map.get(STORAGE_SETTING_KEYS.accessKeyId) ?? null;
    const bucket = map.get(STORAGE_SETTING_KEYS.bucket) ?? null;
    const publicBaseUrl = map.get(STORAGE_SETTING_KEYS.publicBaseUrl) ?? null;
    const secretSet = Boolean(map.get(STORAGE_SETTING_KEYS.secret));
    const configured =
      map.get(STORAGE_SETTING_KEYS.provider) === "r2" &&
      Boolean(accountId && accessKeyId && bucket && publicBaseUrl && secretSet);

    return {
      configured,
      usingFallback: !configured && isR2EnvConfigured(),
      provider: configured ? "r2" : null,
      accountId,
      accessKeyId,
      bucket,
      publicBaseUrl,
      secretSet,
    };
  }

  private async validate(
    siteId: string,
    config: SiteStorageConfig,
  ): Promise<void> {
    // Reject publicBaseUrl that points directly at an R2 S3-API endpoint.
    // Those are private and can never serve public URLs.
    if (/\.r2\.cloudflarestorage\.com(\/|$)/i.test(config.publicBaseUrl)) {
      throw new BadRequestException(
        "publicBaseUrl must be a public-facing URL, not the R2 S3 API endpoint.",
      );
    }
    await assertSafePublicBaseUrl(config.publicBaseUrl);

    const provider = this.storageResolver.buildProvider(config);
    const key = `sites/${siteId}/.structo-storage-check-${randomUUID()}`;
    try {
      await provider.putObject({
        key,
        body: new Uint8Array([0x6f, 0x6b]),
        contentType: "text/plain",
      });
    } catch (error: unknown) {
      throw new BadRequestException(
        `Could not write to the configured bucket: ${this.reason(error)}`,
      );
    }

    // Verify that the publicBaseUrl is actually reachable so mis-configured
    // URLs are caught during setup rather than at delivery time.
    const probeUrl = `${config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    try {
      const res = await fetch(probeUrl, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        await provider.deleteObject(key).catch(() => undefined);
        throw new BadRequestException(
          `publicBaseUrl is not publicly accessible (HTTP ${res.status}). ` +
            "Ensure the bucket is publicly readable and the URL is correct.",
        );
      }
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      await provider.deleteObject(key).catch(() => undefined);
      throw new BadRequestException(
        `Could not reach publicBaseUrl: ${this.reason(error)}`,
      );
    }

    await provider.deleteObject(key).catch(() => undefined);
  }

  private reason(error: unknown): string {
    if (error instanceof StorageProviderError || error instanceof Error) {
      return error.message;
    }
    return "unknown error";
  }
}
