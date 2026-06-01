import { Module } from "@nestjs/common";

import { AuthorizationModule } from "../authorization/authorization.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { EntriesModule } from "../entries/entries.module.js";
import { ContentTypesController } from "./content-types.controller.js";
import { ContentTypesService } from "./content-types.service.js";

@Module({
  imports: [DatabaseModule, AuthorizationModule, EntriesModule],
  controllers: [ContentTypesController],
  providers: [ContentTypesService],
})
export class ContentTypesModule {}
