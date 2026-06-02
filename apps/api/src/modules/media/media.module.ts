import { Module } from "@nestjs/common";
import { createR2StorageProviderFromEnv } from "@structo/storage";

import { AuthorizationModule } from "../authorization/authorization.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { MediaController } from "./media.controller.js";
import { MediaService } from "./media.service.js";
import { STORAGE_PROVIDER } from "./media.tokens.js";

@Module({
  imports: [DatabaseModule, AuthorizationModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: STORAGE_PROVIDER,
      useFactory: createR2StorageProviderFromEnv,
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
