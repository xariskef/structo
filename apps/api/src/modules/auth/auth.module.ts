import { Module } from "@nestjs/common";

import { AuthorizationModule } from "../authorization/authorization.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { CryptoService } from "./crypto.service.js";
import { SessionCookieService } from "./session-cookie.service.js";

@Module({
  imports: [AuthorizationModule],
  controllers: [AuthController],
  providers: [AuthService, CryptoService, SessionCookieService],
  exports: [AuthService, CryptoService, SessionCookieService],
})
export class AuthModule {}
