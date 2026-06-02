import { Module } from "@nestjs/common";
import { createR2StorageProviderFromEnv } from "@structo/storage";

import { AuthorizationModule } from "../authorization/authorization.module.js";
import { SiteStorageController } from "./site-storage.controller.js";
import { SiteStorageService } from "./site-storage.service.js";
import { FALLBACK_STORAGE_PROVIDER } from "./site-storage.tokens.js";
import { StorageResolver } from "./storage-resolver.service.js";

@Module({
  imports: [AuthorizationModule],
  controllers: [SiteStorageController],
  providers: [
    SiteStorageService,
    StorageResolver,
    {
      provide: FALLBACK_STORAGE_PROVIDER,
      useFactory: createR2StorageProviderFromEnv,
    },
  ],
  exports: [StorageResolver],
})
export class SiteStorageModule {}
