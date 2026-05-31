import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { CryptoService } from "./crypto.service.js";
import { SessionCookieService } from "./session-cookie.service.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, CryptoService, SessionCookieService],
  exports: [AuthService, CryptoService, SessionCookieService],
})
export class AuthModule {}
