import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  bulkEntriesSchema,
  createEntrySchema,
  scheduleEntrySchema,
  updateEntrySchema,
  type EntryStatus,
} from "@structo/contracts";

const ENTRY_STATUSES: EntryStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
];

import { parseInput } from "../../common/validation/parse-input.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { EntriesService } from "./entries.service.js";

@Controller("manage")
export class EntriesController {
  constructor(
    @Inject(EntriesService)
    private readonly entriesService: EntriesService,
  ) {}

  @Get("sites/:siteId/entries")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Query("contentTypeId") contentTypeId?: string,
    @Query("status") status?: string,
  ) {
    const parsedStatus = ENTRY_STATUSES.find((s) => s === status);
    return this.entriesService.list(
      user.id,
      siteId,
      contentTypeId,
      parsedStatus,
    );
  }

  @Post("sites/:siteId/entries")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Body() body: unknown,
  ) {
    return this.entriesService.create(
      user.id,
      siteId,
      parseInput(createEntrySchema, body),
    );
  }

  @Post("sites/:siteId/entries/bulk")
  @HttpCode(200)
  bulk(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Body() body: unknown,
  ) {
    return this.entriesService.bulk(
      user.id,
      siteId,
      parseInput(bulkEntriesSchema, body),
    );
  }

  // Get-or-create the single item backing a single page.
  @Post("sites/:siteId/content-types/:contentTypeId/single")
  @HttpCode(200)
  resolveSingle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("contentTypeId") contentTypeId: string,
  ) {
    return this.entriesService.getOrCreateSingle(
      user.id,
      siteId,
      contentTypeId,
    );
  }

  @Get("sites/:siteId/entries/:entryId")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.entriesService.get(user.id, siteId, entryId);
  }

  @Patch("sites/:siteId/entries/:entryId")
  @HttpCode(200)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
    @Body() body: unknown,
  ) {
    return this.entriesService.update(
      user.id,
      siteId,
      entryId,
      parseInput(updateEntrySchema, body),
    );
  }

  @Post("sites/:siteId/entries/:entryId/publish")
  @HttpCode(200)
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.entriesService.publish(user.id, siteId, entryId);
  }

  @Post("sites/:siteId/entries/:entryId/unpublish")
  @HttpCode(200)
  unpublish(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.entriesService.unpublish(user.id, siteId, entryId);
  }

  @Post("sites/:siteId/entries/:entryId/archive")
  @HttpCode(200)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.entriesService.archive(user.id, siteId, entryId);
  }

  @Post("sites/:siteId/entries/:entryId/duplicate")
  @HttpCode(200)
  duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.entriesService.duplicate(user.id, siteId, entryId);
  }

  @Post("sites/:siteId/entries/:entryId/schedule")
  @HttpCode(200)
  schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
    @Body() body: unknown,
  ) {
    return this.entriesService.schedule(
      user.id,
      siteId,
      entryId,
      parseInput(scheduleEntrySchema, body),
    );
  }

  @Delete("sites/:siteId/entries/:entryId")
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.entriesService.remove(user.id, siteId, entryId);
  }

  @Get("sites/:siteId/entries/:entryId/revisions")
  listRevisions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.entriesService.listRevisions(user.id, siteId, entryId);
  }
}
