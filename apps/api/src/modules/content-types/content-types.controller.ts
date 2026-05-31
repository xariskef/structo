import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  createContentTypeSchema,
  updateContentTypeSchema,
} from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { ContentTypesService } from "./content-types.service.js";

@Controller("manage")
export class ContentTypesController {
  constructor(
    @Inject(ContentTypesService)
    private readonly contentTypesService: ContentTypesService,
  ) {}

  @Get("sites/:siteId/content-types")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
  ) {
    return this.contentTypesService.list(user.id, siteId);
  }

  @Post("sites/:siteId/content-types")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Body() body: unknown,
  ) {
    return this.contentTypesService.create(
      user.id,
      siteId,
      parseInput(createContentTypeSchema, body),
    );
  }

  @Get("sites/:siteId/content-types/:contentTypeId")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("contentTypeId") contentTypeId: string,
  ) {
    return this.contentTypesService.get(user.id, siteId, contentTypeId);
  }

  @Patch("sites/:siteId/content-types/:contentTypeId")
  @HttpCode(200)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("contentTypeId") contentTypeId: string,
    @Body() body: unknown,
  ) {
    return this.contentTypesService.update(
      user.id,
      siteId,
      contentTypeId,
      parseInput(updateContentTypeSchema, body),
    );
  }

  @Post("sites/:siteId/content-types/:contentTypeId/activate")
  @HttpCode(200)
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("contentTypeId") contentTypeId: string,
  ) {
    return this.contentTypesService.activate(user.id, siteId, contentTypeId);
  }

  @Post("sites/:siteId/content-types/:contentTypeId/archive")
  @HttpCode(200)
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("contentTypeId") contentTypeId: string,
  ) {
    return this.contentTypesService.archive(user.id, siteId, contentTypeId);
  }
}
