import { Module } from "@nestjs/common";

import { AuthorizationModule } from "../authorization/authorization.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { TaxonomiesController } from "./taxonomies.controller.js";
import { TaxonomiesService } from "./taxonomies.service.js";

@Module({
  imports: [DatabaseModule, AuthorizationModule],
  controllers: [TaxonomiesController],
  providers: [TaxonomiesService],
})
export class TaxonomiesModule {}
