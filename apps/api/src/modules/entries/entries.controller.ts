import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { createEntrySchema, updateEntrySchema } from "@structo/contracts";

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
  ) {
    return this.entriesService.list(user.id, siteId, contentTypeId);
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

  @Get("sites/:siteId/entries/:entryId/revisions")
  listRevisions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.entriesService.listRevisions(user.id, siteId, entryId);
  }
}
