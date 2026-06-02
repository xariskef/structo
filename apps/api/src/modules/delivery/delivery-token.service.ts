import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { DELIVERY_READ_SCOPE } from "@structo/contracts";

import { CryptoService } from "../auth/crypto.service.js";
import { DatabaseService } from "../database/database.service.js";

export interface ResolvedDeliveryToken {
  token: { id: string };
  site: { id: string; key: string };
}

@Injectable()
export class DeliveryTokenService {
  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(CryptoService)
    private readonly cryptoService: CryptoService,
  ) {}

  async resolve(rawToken: string): Promise<ResolvedDeliveryToken> {
    if (!rawToken.startsWith("stk_")) {
      throw new UnauthorizedException("Invalid delivery token.");
    }
    const token = await this.db.client.siteApiToken.findUnique({
      where: { tokenHash: this.cryptoService.hashToken(rawToken) },
      include: { site: { select: { id: true, key: true, status: true } } },
    });
    if (
      !token ||
      token.revokedAt !== null ||
      (token.expiresAt !== null && token.expiresAt <= new Date()) ||
      token.site.status !== "ACTIVE" ||
      !token.scopes.includes(DELIVERY_READ_SCOPE)
    ) {
      throw new UnauthorizedException("Invalid delivery token.");
    }
    return {
      token: { id: token.id },
      site: { id: token.site.id, key: token.site.key },
    };
  }

  async touchLastUsed(tokenId: string): Promise<void> {
    const cutoff = new Date(Date.now() - 60_000);
    await this.db.client.siteApiToken.updateMany({
      where: {
        id: tokenId,
        OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: cutoff } }],
      },
      data: { lastUsedAt: new Date() },
    });
  }
}
