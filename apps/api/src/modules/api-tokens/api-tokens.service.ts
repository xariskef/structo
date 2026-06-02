import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DELIVERY_READ_SCOPE,
  type CreateSiteApiTokenInput,
  type SiteApiTokenCreated,
  type SiteApiTokenSummary,
} from "@structo/contracts";

import { AuthorizationService } from "../authorization/authorization.service.js";
import { CryptoService } from "../auth/crypto.service.js";
import { DatabaseService } from "../database/database.service.js";

type TokenRow = {
  id: string;
  name: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class ApiTokensService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
    @Inject(CryptoService)
    private readonly cryptoService: CryptoService,
  ) {}

  async list(userId: string, siteId: string): Promise<SiteApiTokenSummary[]> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_api_tokens",
    );
    await this.findSite(siteId);
    const tokens = await this.db.client.siteApiToken.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
    });
    return tokens.map((token) => this.toSummary(token));
  }

  async create(
    userId: string,
    siteId: string,
    input: CreateSiteApiTokenInput,
  ): Promise<SiteApiTokenCreated> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_api_tokens",
    );
    const site = await this.findSite(siteId);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt !== null && expiresAt <= new Date()) {
      throw new BadRequestException("Token expiry must be in the future.");
    }
    const rawToken = `stk_${this.cryptoService.createToken()}`;

    const created = await this.db.client.$transaction(async (transaction) => {
      const token = await transaction.siteApiToken.create({
        data: {
          siteId,
          name: input.name,
          tokenHash: this.cryptoService.hashToken(rawToken),
          scopes: [DELIVERY_READ_SCOPE],
          expiresAt,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          actorId: userId,
          action: "api_token.create",
          entityType: "SiteApiToken",
          entityId: token.id,
          metadata: { name: token.name, scopes: token.scopes },
        },
      });
      return token;
    });

    return { ...this.toSummary(created), token: rawToken };
  }

  async revoke(userId: string, siteId: string, tokenId: string): Promise<void> {
    await this.authorizationService.assertSitePermission(
      userId,
      siteId,
      "site.manage_api_tokens",
    );
    const [site, token] = await Promise.all([
      this.findSite(siteId),
      this.db.client.siteApiToken.findUnique({ where: { id: tokenId } }),
    ]);
    if (!token || token.siteId !== siteId) {
      throw new NotFoundException("API token not found.");
    }

    await this.db.client.$transaction([
      this.db.client.siteApiToken.update({
        where: { id: tokenId },
        data: { revokedAt: new Date() },
      }),
      this.db.client.auditLog.create({
        data: {
          organizationId: site.organizationId,
          siteId,
          actorId: userId,
          action: "api_token.revoke",
          entityType: "SiteApiToken",
          entityId: tokenId,
          metadata: { name: token.name },
        },
      }),
    ]);
  }

  private async findSite(siteId: string): Promise<{ organizationId: string }> {
    const site = await this.db.client.site.findUnique({
      where: { id: siteId },
      select: { organizationId: true },
    });
    if (!site) {
      throw new NotFoundException("Site not found.");
    }
    return site;
  }

  private toSummary(token: TokenRow): SiteApiTokenSummary {
    return {
      id: token.id,
      name: token.name,
      scopes: token.scopes,
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      expiresAt: token.expiresAt?.toISOString() ?? null,
      revokedAt: token.revokedAt?.toISOString() ?? null,
      createdAt: token.createdAt.toISOString(),
    };
  }
}
