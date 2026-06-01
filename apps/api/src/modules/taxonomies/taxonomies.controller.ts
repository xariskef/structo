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
  Put,
  Query,
} from "@nestjs/common";
import {
  assignTaxonomyTermsSchema,
  createTaxonomyTermSchema,
  taxonomyDefinitionQuerySchema,
  updateTaxonomyDefinitionSchema,
  updateTaxonomyTermSchema,
} from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { TaxonomiesService } from "./taxonomies.service.js";

@Controller("manage")
export class TaxonomiesController {
  constructor(
    @Inject(TaxonomiesService)
    private readonly taxonomiesService: TaxonomiesService,
  ) {}

  @Get("sites/:siteId/taxonomy-definitions")
  listDefinitions(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Query("scope") scope?: string,
    @Query("contentTypeId") contentTypeId?: string,
  ) {
    return this.taxonomiesService.listDefinitions(
      user.id,
      siteId,
      parseInput(taxonomyDefinitionQuerySchema, { scope, contentTypeId }),
    );
  }

  @Patch("sites/:siteId/taxonomy-definitions/:definitionId")
  @HttpCode(200)
  updateDefinition(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("definitionId") definitionId: string,
    @Body() body: unknown,
  ) {
    return this.taxonomiesService.updateDefinition(
      user.id,
      siteId,
      definitionId,
      parseInput(updateTaxonomyDefinitionSchema, body),
    );
  }

  @Get("sites/:siteId/taxonomy-definitions/:definitionId/terms")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("definitionId") definitionId: string,
  ) {
    return this.taxonomiesService.list(user.id, siteId, definitionId);
  }

  @Post("sites/:siteId/taxonomy-definitions/:definitionId/terms")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("definitionId") definitionId: string,
    @Body() body: unknown,
  ) {
    return this.taxonomiesService.create(
      user.id,
      siteId,
      definitionId,
      parseInput(createTaxonomyTermSchema, body),
    );
  }

  @Patch("sites/:siteId/taxonomy-terms/:termId")
  @HttpCode(200)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("termId") termId: string,
    @Body() body: unknown,
  ) {
    return this.taxonomiesService.update(
      user.id,
      siteId,
      termId,
      parseInput(updateTaxonomyTermSchema, body),
    );
  }

  @Delete("sites/:siteId/taxonomy-terms/:termId")
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("termId") termId: string,
  ) {
    return this.taxonomiesService.remove(user.id, siteId, termId);
  }

  @Get("sites/:siteId/entries/:entryId/available-taxonomy-terms")
  listAvailableForEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.taxonomiesService.listAvailableForEntry(
      user.id,
      siteId,
      entryId,
    );
  }

  @Get("sites/:siteId/entries/:entryId/taxonomy-terms")
  listEntryTerms(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.taxonomiesService.listEntryTerms(user.id, siteId, entryId);
  }

  @Put("sites/:siteId/entries/:entryId/taxonomy-terms")
  @HttpCode(200)
  assignEntryTerms(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("entryId") entryId: string,
    @Body() body: unknown,
  ) {
    return this.taxonomiesService.assignEntryTerms(
      user.id,
      siteId,
      entryId,
      parseInput(assignTaxonomyTermsSchema, body),
    );
  }
}
