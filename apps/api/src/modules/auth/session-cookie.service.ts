import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";

import {
  PRODUCTION_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "./auth.constants.js";

@Injectable()
export class SessionCookieService {
  read(request: Request): string | undefined {
    const cookies = request.headers.cookie?.split(";") ?? [];
    const cookieName = this.cookieName;

    for (const cookie of cookies) {
      const [name, ...valueParts] = cookie.trim().split("=");

      if (name === cookieName) {
        return decodeURIComponent(valueParts.join("="));
      }
    }

    return undefined;
  }

  set(response: Response, token: string): void {
    response.cookie(this.cookieName, token, {
      httpOnly: true,
      path: "/",
      sameSite: "strict",
      secure: this.isProduction,
    });
  }

  clear(response: Response): void {
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      path: "/",
      sameSite: "strict",
      secure: this.isProduction,
    });
  }

  private get cookieName(): string {
    return this.isProduction
      ? PRODUCTION_SESSION_COOKIE_NAME
      : SESSION_COOKIE_NAME;
  }

  private get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  }
}
