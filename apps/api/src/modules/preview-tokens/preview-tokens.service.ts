import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type CreatePreviewTokenInput,
  type PreviewTokenCreated,
  type PreviewTokenSummary,
} from "@structo/contracts";

import { CryptoService } from "../auth/crypto.service.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { DatabaseService } from "../database/database.service.js";

/** Raw token prefix — distinguishes preview tokens from delivery (stk_) tokens. */
const PREFIX = "stp_";

type TokenRow = {
  id: string;
  label: string;
  entryId: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class PreviewTokensService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
    @Inject(CryptoService)
    private readonly cryptoService: CryptoService,
  ) {}

  // -------------------------------------------------------------------------
  // Management endpoints
  // -------------------------------------------------------------------------

  async list(userId: string, siteId: string): Promise<PreviewTokenSummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_preview_tokens",
    );
    const site = await this.findSite(siteId);
    const tokens = await this.db.client.previewToken.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
    });
    return tokens.map((t) => this.toSummary(t, siteId, site.key));
  }

  async create(
    userId: string,
    siteId: string,
    input: CreatePreviewTokenInput,
  ): Promise<PreviewTokenCreated> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_preview_tokens",
    );
    const site = await this.findSite(siteId);

    const expiresAt = new Date(input.expiresAt);
    if (expiresAt <= new Date()) {
      throw new BadRequestException("Preview token expiry must be in the future.");
    }

    // Validate entry scope if provided
    if (input.entryId) {
      const entry = await this.db.client.contentEntry.findUnique({
        where: { id: input.entryId },
        select: { siteId: true },
      });
      if (!entry || entry.siteId !== siteId) {
        throw new NotFoundException("Content entry not found.");
      }
    }

    const rawToken = `${PREFIX}${this.cryptoService.createToken()}`;
    const tokenHash = this.cryptoService.hashToken(rawToken);

    const created = await this.db.client.$transaction(async (tx) => {
      const token = await tx.previewToken.create({
        data: {
          siteId,
          entryId: input.entryId ?? null,
          tokenHash,
          label: input.label,
          expiresAt,
          createdById: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          actorId: userId,
          action: "preview_token.create",
          entityType: "PreviewToken",
          entityId: token.id,
          metadata: { label: token.label, entryId: token.entryId },
        },
      });
      return token;
    });

    return {
      ...this.toSummary(created, siteId, site.key),
      token: rawToken,
    };
  }

  async revoke(
    userId: string,
    siteId: string,
    tokenId: string,
  ): Promise<void> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_preview_tokens",
    );
    const [site, token] = await Promise.all([
      this.findSite(siteId),
      this.db.client.previewToken.findUnique({ where: { id: tokenId } }),
    ]);
    if (!token || token.siteId !== siteId) {
      throw new NotFoundException("Preview token not found.");
    }
    if (token.revokedAt !== null) {
      // Idempotent — already revoked
      return;
    }

    await this.db.client.$transaction([
      this.db.client.previewToken.update({
        where: { id: tokenId },
        data: { revokedAt: new Date() },
      }),
      this.db.client.auditLog.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          actorId: userId,
          action: "preview_token.revoke",
          entityType: "PreviewToken",
          entityId: tokenId,
          metadata: { label: token.label },
        },
      }),
    ]);
  }

  // -------------------------------------------------------------------------
  // Preview delivery guard support
  // -------------------------------------------------------------------------

  /**
   * Resolve a raw preview token string into its resolved site + optional entry
   * scope. Called by `PreviewTokenGuard`.
   */
  async resolve(
    rawToken: string,
  ): Promise<{ siteId: string; entryId: string | null }> {
    if (!rawToken.startsWith(PREFIX)) {
      throw new NotFoundException("Preview token not found.");
    }
    const tokenHash = this.cryptoService.hashToken(rawToken);
    const token = await this.db.client.previewToken.findUnique({
      where: { tokenHash },
      select: {
        siteId: true,
        entryId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
    if (
      !token ||
      token.revokedAt !== null ||
      token.expiresAt <= new Date()
    ) {
      throw new NotFoundException("Preview token not found.");
    }
    return { siteId: token.siteId, entryId: token.entryId };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async findSite(
    siteId: string,
  ): Promise<{ organizationId: string; key: string }> {
    const site = await this.db.client.site.findUnique({
      where: { id: siteId },
      select: { organizationId: true, key: true },
    });
    if (!site) throw new NotFoundException("Site not found.");
    return site;
  }

  private toSummary(
    token: TokenRow,
    siteId: string,
    siteKey: string,
  ): PreviewTokenSummary {
    // The summary does not include the raw token — only the created response
    // extends this with the one-time `token` field.
    return {
      id: token.id,
      label: token.label,
      entryId: token.entryId,
      expiresAt: token.expiresAt.toISOString(),
      revokedAt: token.revokedAt?.toISOString() ?? null,
      createdAt: token.createdAt.toISOString(),
      previewUrl: this.buildPreviewUrl(siteKey, token.entryId),
    };
  }

  /**
   * Returns the base URL that a consumer can append `?preview=<token>` to.
   * The admin frontend or SDK substitutes the actual token value.
   * Format: `/preview/<siteKey>[/<entryId>]`
   */
  private buildPreviewUrl(siteKey: string, entryId: string | null): string {
    return entryId
      ? `/preview/${siteKey}/entries/${entryId}`
      : `/preview/${siteKey}`;
  }
}
