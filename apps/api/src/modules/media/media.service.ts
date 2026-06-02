import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  MEDIA_MAX_UPLOAD_BYTES,
  type MediaAssetSummary,
  type UpdateMediaAssetInput,
} from "@structo/contracts";
import { StorageProviderError } from "@structo/storage";
import { randomUUID } from "node:crypto";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";
import { StorageResolver } from "../site-storage/storage-resolver.service.js";
import {
  assertAllowedMediaFile,
  extensionForMimeType,
  readImageDimensions,
  type UploadedMediaFile,
} from "./media-file.js";

type MediaAssetRow = {
  id: string;
  siteId: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  caption: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class MediaService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
    @Inject(StorageResolver)
    private readonly storageResolver: StorageResolver,
  ) {}

  async list(userId: string, siteId: string): Promise<MediaAssetSummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.view",
    );
    await this.findSite(siteId);
    const assets = await this.db.client.mediaAsset.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
    });
    return assets.map((asset) => this.toSummary(asset));
  }

  async upload(
    userId: string,
    siteId: string,
    file?: UploadedMediaFile,
  ): Promise<MediaAssetSummary> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_media",
    );
    const site = await this.findSite(siteId);
    if (!file || file.size === 0) {
      throw new BadRequestException("Choose a file to upload.");
    }
    if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
      throw new BadRequestException("Media uploads cannot exceed 10 MB.");
    }
    const mimeType = assertAllowedMediaFile(file);
    const dimensions = readImageDimensions(file.buffer, mimeType);
    const storageKey = this.storageKey(siteId, extensionForMimeType(mimeType));
    const storage = await this.storageResolver.getForSite(siteId);
    const stored = await storage
      .putObject({ key: storageKey, body: file.buffer, contentType: mimeType })
      .catch((error: unknown) => this.throwStorageError(error));

    try {
      const asset = await this.db.client.$transaction(async (transaction) => {
        const created = await transaction.mediaAsset.create({
          data: {
            siteId,
            storageProvider: "r2",
            storageKey: stored.key,
            url: stored.url,
            filename: this.filename(file.originalname),
            mimeType,
            size: file.size,
            width: dimensions?.width ?? null,
            height: dimensions?.height ?? null,
            createdById: userId,
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: site.organizationId,
            siteId,
            actorId: userId,
            action: "media.upload",
            entityType: "MediaAsset",
            entityId: created.id,
            metadata: {
              filename: created.filename,
              mimeType: created.mimeType,
              size: created.size,
            },
          },
        });
        return created;
      });
      return this.toSummary(asset);
    } catch (error: unknown) {
      await storage.deleteObject(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async update(
    userId: string,
    siteId: string,
    assetId: string,
    input: UpdateMediaAssetInput,
  ): Promise<MediaAssetSummary> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_media",
    );
    const [site, asset] = await Promise.all([
      this.findSite(siteId),
      this.findAsset(assetId, siteId),
    ]);
    const updated = await this.db.client.$transaction(async (transaction) => {
      const next = await transaction.mediaAsset.update({
        where: { id: asset.id },
        data: input,
      });
      await transaction.auditLog.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          actorId: userId,
          action: "media.update",
          entityType: "MediaAsset",
          entityId: asset.id,
          metadata: { updatedFields: Object.keys(input) },
        },
      });
      return next;
    });
    return this.toSummary(updated);
  }

  async remove(userId: string, siteId: string, assetId: string): Promise<void> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_media",
    );
    const [site, asset] = await Promise.all([
      this.findSite(siteId),
      this.findAsset(assetId, siteId),
    ]);
    await this.assertNotReferenced(siteId, asset.id);
    const storage = await this.storageResolver.getForSite(siteId);
    await storage
      .deleteObject(asset.storageKey)
      .catch((error: unknown) => this.throwStorageError(error));
    await this.db.client.$transaction([
      this.db.client.mediaAsset.delete({ where: { id: asset.id } }),
      this.db.client.auditLog.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          actorId: userId,
          action: "media.delete",
          entityType: "MediaAsset",
          entityId: asset.id,
          metadata: { filename: asset.filename },
        },
      }),
    ]);
  }

  private async findSite(siteId: string): Promise<{ organizationId: string }> {
    const site = await this.db.client.site.findUnique({
      where: { id: siteId },
      select: { organizationId: true },
    });
    if (!site) throw new NotFoundException("Site not found.");
    return site;
  }

  private async findAsset(assetId: string, siteId: string) {
    const asset = await this.db.client.mediaAsset.findUnique({
      where: { id: assetId },
    });
    if (!asset || asset.siteId !== siteId) {
      throw new NotFoundException("Media asset not found.");
    }
    return asset;
  }

  private async assertNotReferenced(siteId: string, assetId: string) {
    const [entries, terms, publishedRevisions] = await Promise.all([
      this.db.client.contentEntry.findMany({
        where: { siteId },
        select: { data: true },
      }),
      this.db.client.taxonomyTerm.findMany({
        where: { siteId },
        select: { data: true },
      }),
      // Also check the published snapshot data so that a media asset that has
      // been removed from the draft but is still referenced by the live snapshot
      // cannot be deleted until the entry is re-published or unpublished.
      this.db.client.contentEntry.findMany({
        where: { siteId, publishedRevisionId: { not: null } },
        select: { publishedRevision: { select: { data: true } } },
      }),
    ]);
    const snapshotData = publishedRevisions
      .map((e) => e.publishedRevision)
      .filter(Boolean) as { data: unknown }[];
    if (
      [...entries, ...terms, ...snapshotData].some(({ data }) =>
        this.containsReference(data, assetId),
      )
    ) {
      throw new BadRequestException(
        "Remove this media asset from content before deleting it.",
      );
    }
  }

  private containsReference(value: unknown, assetId: string): boolean {
    if (value === assetId) return true;
    if (Array.isArray(value)) {
      return value.some((item) => this.containsReference(item, assetId));
    }
    if (typeof value === "object" && value !== null) {
      return Object.values(value).some((item) =>
        this.containsReference(item, assetId),
      );
    }
    return false;
  }

  private storageKey(siteId: string, extension: string): string {
    const now = new Date();
    return [
      "sites",
      siteId,
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      `${randomUUID()}.${extension}`,
    ].join("/");
  }

  private filename(value: string): string {
    const cleaned = value
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      ?.replace(/[^\w.\- ]+/g, "_")
      .trim();
    return (cleaned || "upload").slice(0, 255);
  }

  private toSummary(asset: MediaAssetRow): MediaAssetSummary {
    return {
      id: asset.id,
      siteId: asset.siteId,
      url: asset.url,
      filename: asset.filename,
      mimeType: asset.mimeType,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      alt: asset.alt,
      caption: asset.caption,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }

  private throwStorageError(error: unknown): never {
    if (error instanceof StorageProviderError) {
      throw new ServiceUnavailableException(error.message);
    }
    throw error;
  }
}
