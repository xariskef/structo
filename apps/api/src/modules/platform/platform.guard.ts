import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";

import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { AuthorizationService } from "../authorization/authorization.service.js";

/**
 * Gate for /platform routes. Runs after the global session guard, so the user
 * is already authenticated; here we require an explicit, standalone platform
 * operator grant. Tenant roles never satisfy this check.
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authenticatedUser) {
      throw new ForbiddenException("Platform operator access is required.");
    }

    await this.authorizationService.assertPlatformOperator(
      request.authenticatedUser.id,
    );

    return true;
  }
}
