import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuthModule } from "./modules/auth/auth.module.js";
import { SessionAuthGuard } from "./modules/auth/session-auth.guard.js";
import { DatabaseModule } from "./modules/database/database.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { ContentTypesModule } from "./modules/content-types/content-types.module.js";
import { EntriesModule } from "./modules/entries/entries.module.js";
import { InvitationsModule } from "./modules/invitations/invitations.module.js";
import { OrganizationsModule } from "./modules/organizations/organizations.module.js";
import { SettingsModule } from "./modules/settings/settings.module.js";
import { NavigationModule } from "./modules/navigation/navigation.module.js";
import { SitesModule } from "./modules/sites/sites.module.js";
import { TaxonomiesModule } from "./modules/taxonomies/taxonomies.module.js";
import { ApiTokensModule } from "./modules/api-tokens/api-tokens.module.js";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module.js";
import { DeliveryModule } from "./modules/delivery/delivery.module.js";
import { MediaModule } from "./modules/media/media.module.js";
import { PlatformModule } from "./modules/platform/platform.module.js";
import { SiteStorageModule } from "./modules/site-storage/site-storage.module.js";
import { PreviewTokensModule } from "./modules/preview-tokens/preview-tokens.module.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    HealthModule,
    ContentTypesModule,
    EntriesModule,
    InvitationsModule,
    OrganizationsModule,
    SettingsModule,
    NavigationModule,
    SitesModule,
    TaxonomiesModule,
    ApiTokensModule,
    AuditLogsModule,
    DeliveryModule,
    SiteStorageModule,
    MediaModule,
    PlatformModule,
    PreviewTokensModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
  ],
})
export class AppModule {}
