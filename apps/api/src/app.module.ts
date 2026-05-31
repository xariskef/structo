import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuthModule } from "./modules/auth/auth.module.js";
import { SessionAuthGuard } from "./modules/auth/session-auth.guard.js";
import { DatabaseModule } from "./modules/database/database.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { InvitationsModule } from "./modules/invitations/invitations.module.js";
import { OrganizationsModule } from "./modules/organizations/organizations.module.js";
import { SitesModule } from "./modules/sites/sites.module.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    AuthModule,
    HealthModule,
    InvitationsModule,
    OrganizationsModule,
    SitesModule,
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
