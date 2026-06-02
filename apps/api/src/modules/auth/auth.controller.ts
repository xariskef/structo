import { Body, Controller, Get, Inject, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  loginSchema,
  registerInvitedMemberSchema,
  registerOwnerSchema,
} from "@structo/contracts";
import type { Request, Response } from "express";

import { parseInput } from "../../common/validation/parse-input.js";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { CurrentUser } from "./current-user.decorator.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedUser } from "./auth.types.js";
import { Public } from "./public.decorator.js";
import { SessionCookieService } from "./session-cookie.service.js";

const AUTH_THROTTLE_LIMIT = process.env.NODE_ENV === "test" ? 1_000 : 5;

@Controller("manage/auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(SessionCookieService)
    private readonly sessionCookieService: SessionCookieService,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Public()
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: 60_000 } })
  @Post("register")
  async registerOwner(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.registerOwner(
      parseInput(registerOwnerSchema, body),
    );

    this.sessionCookieService.set(response, result.token);

    return { user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: 60_000 } })
  @Post("register-invited")
  async registerInvitedMember(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.registerInvitedMember(
      parseInput(registerInvitedMemberSchema, body),
    );

    this.sessionCookieService.set(response, result.token);

    return { user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: AUTH_THROTTLE_LIMIT, ttl: 60_000 } })
  @Post("login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(parseInput(loginSchema, body));

    this.sessionCookieService.set(response, result.token);

    return { user: result.user };
  }

  @Post("logout")
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(this.sessionCookieService.read(request));
    this.sessionCookieService.clear(response);

    return { success: true };
  }

  @Get("me")
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    const platformRole = await this.authorizationService.getPlatformRole(
      user.id,
    );

    return {
      user,
      platformOperator: platformRole ? { role: platformRole } : null,
    };
  }
}
