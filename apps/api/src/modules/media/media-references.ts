import { BadRequestException } from "@nestjs/common";
import { collectMediaAssetIds, type FieldDefinition } from "@structo/field-kit";

import type { DatabaseService } from "../database/database.service.js";

export async function assertSiteMediaAssets(
  db: DatabaseService,
  siteId: string,
  fields: FieldDefinition[],
  data: Record<string, unknown>,
): Promise<void> {
  const ids = collectMediaAssetIds(fields, data);
  if (ids.length === 0) return;
  const count = await db.client.mediaAsset.count({
    where: { siteId, id: { in: ids } },
  });
  if (count !== ids.length) {
    throw new BadRequestException(
      "Some media assets do not belong to this site.",
    );
  }
}
