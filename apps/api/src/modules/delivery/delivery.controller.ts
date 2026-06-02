import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { deliveryEntriesQuerySchema } from "@structo/contracts";

import { parseInput } from "../../common/validation/parse-input.js";
import { Public } from "../auth/public.decorator.js";
import { CurrentDeliverySite } from "./current-delivery-site.decorator.js";
import {
  DeliveryTokenGuard,
  type DeliverySiteContext,
} from "./delivery-token.guard.js";
import { DeliveryService } from "./delivery.service.js";

@Public()
@UseGuards(DeliveryTokenGuard)
@Controller("delivery/sites/:siteKey")
export class DeliveryController {
  constructor(
    @Inject(DeliveryService)
    private readonly deliveryService: DeliveryService,
  ) {}

  @Get("settings")
  settings(@CurrentDeliverySite() site: DeliverySiteContext) {
    return this.deliveryService.getSettings(site.id);
  }

  @Get("content-types")
  contentTypes(@CurrentDeliverySite() site: DeliverySiteContext) {
    return this.deliveryService.listContentTypes(site.id);
  }

  @Get("content-types/:typeSlug")
  contentType(
    @CurrentDeliverySite() site: DeliverySiteContext,
    @Param("typeSlug") typeSlug: string,
  ) {
    return this.deliveryService.getContentType(site.id, typeSlug);
  }

  @Get("content-types/:typeSlug/entries")
  entries(
    @CurrentDeliverySite() site: DeliverySiteContext,
    @Param("typeSlug") typeSlug: string,
    @Query() query: unknown,
  ) {
    return this.deliveryService.listEntries(
      site.id,
      typeSlug,
      parseInput(deliveryEntriesQuerySchema, query),
    );
  }

  @Get("content-types/:typeSlug/entries/:entrySlug")
  entry(
    @CurrentDeliverySite() site: DeliverySiteContext,
    @Param("typeSlug") typeSlug: string,
    @Param("entrySlug") entrySlug: string,
  ) {
    return this.deliveryService.getEntry(site.id, typeSlug, entrySlug);
  }

  @Get("navigation-menus")
  menus(@CurrentDeliverySite() site: DeliverySiteContext) {
    return this.deliveryService.listMenus(site.id);
  }

  @Get("navigation-menus/:menuKey")
  menu(
    @CurrentDeliverySite() site: DeliverySiteContext,
    @Param("menuKey") menuKey: string,
  ) {
    return this.deliveryService.getMenu(site.id, menuKey);
  }
}
