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
} from "@nestjs/common";
import {
  createNavigationMenuSchema,
  updateNavigationMenuSchema,
} from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { NavigationService } from "./navigation.service.js";

@Controller("manage")
export class NavigationController {
  constructor(
    @Inject(NavigationService)
    private readonly navigationService: NavigationService,
  ) {}

  @Get("sites/:siteId/navigation-menus")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
  ) {
    return this.navigationService.list(user.id, siteId);
  }

  @Post("sites/:siteId/navigation-menus")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Body() body: unknown,
  ) {
    return this.navigationService.create(
      user.id,
      siteId,
      parseInput(createNavigationMenuSchema, body),
    );
  }

  @Get("sites/:siteId/navigation-link-targets")
  linkTargets(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
  ) {
    return this.navigationService.linkTargets(user.id, siteId);
  }

  @Get("sites/:siteId/navigation-menus/:menuId")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("menuId") menuId: string,
  ) {
    return this.navigationService.get(user.id, siteId, menuId);
  }

  @Patch("sites/:siteId/navigation-menus/:menuId")
  @HttpCode(200)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("menuId") menuId: string,
    @Body() body: unknown,
  ) {
    return this.navigationService.update(
      user.id,
      siteId,
      menuId,
      parseInput(updateNavigationMenuSchema, body),
    );
  }

  @Delete("sites/:siteId/navigation-menus/:menuId")
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("siteId") siteId: string,
    @Param("menuId") menuId: string,
  ) {
    return this.navigationService.remove(user.id, siteId, menuId);
  }
}
