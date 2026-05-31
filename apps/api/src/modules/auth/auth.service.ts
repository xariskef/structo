import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma, UserStatus } from "@structo/database";
import type {
  LoginInput,
  RegisterInvitedMemberInput,
  RegisterOwnerInput,
} from "@structo/contracts";

import { DatabaseService } from "../database/database.service.js";
import { SESSION_DURATION_MS } from "./auth.constants.js";
import type { AuthenticatedUser } from "./auth.types.js";
import { CryptoService } from "./crypto.service.js";

interface SessionResult {
  token: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(CryptoService)
    private readonly cryptoService: CryptoService,
  ) {}

  async registerOwner(input: RegisterOwnerInput): Promise<SessionResult> {
    const passwordHash = await this.cryptoService.hashPassword(input.password);

    try {
      const user = await this.databaseService.client.$transaction(
        async (tx) => {
          const createdUser = await tx.user.create({
            data: {
              email: input.email,
              name: input.name,
              passwordCredential: {
                create: {
                  passwordHash,
                },
              },
            },
          });

          await tx.organization.create({
            data: {
              name: input.organizationName,
              slug: input.organizationSlug,
              createdById: createdUser.id,
              memberships: {
                create: {
                  userId: createdUser.id,
                  role: "OWNER",
                },
              },
            },
          });

          return createdUser;
        },
      );

      return this.createSession(user);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          "Email or organization slug already exists.",
        );
      }

      throw error;
    }
  }

  async registerInvitedMember(
    input: RegisterInvitedMemberInput,
  ): Promise<SessionResult> {
    const passwordHash = await this.cryptoService.hashPassword(input.password);
    const tokenHash = this.cryptoService.hashToken(input.invitationToken);
    const now = new Date();

    try {
      const user = await this.databaseService.client.$transaction(
        async (tx) => {
          const invitation = await tx.invitation.findUnique({
            where: { tokenHash },
          });

          if (
            !invitation ||
            invitation.acceptedAt ||
            invitation.expiresAt <= now ||
            invitation.email !== input.email
          ) {
            throw new UnauthorizedException(
              "Invitation is invalid or expired.",
            );
          }

          const createdUser = await tx.user.create({
            data: {
              email: input.email,
              name: input.name,
              passwordCredential: {
                create: {
                  passwordHash,
                },
              },
            },
          });

          await this.acceptInvitationForUser(
            tx,
            invitation,
            createdUser.id,
            now,
          );

          return createdUser;
        },
      );

      return this.createSession(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("Unable to create invited member.");
      }

      throw error;
    }
  }

  async login(input: LoginInput): Promise<SessionResult> {
    const user = await this.databaseService.client.user.findUnique({
      where: { email: input.email },
      include: { passwordCredential: true },
    });

    if (
      !user?.passwordCredential ||
      user.status !== UserStatus.ACTIVE ||
      !(await this.cryptoService.verifyPassword(
        user.passwordCredential.passwordHash,
        input.password,
      ))
    ) {
      throw new UnauthorizedException("Email or password is invalid.");
    }

    return this.createSession(user);
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }

    await this.databaseService.client.authSession.deleteMany({
      where: {
        tokenHash: this.cryptoService.hashToken(token),
      },
    });
  }

  async resolveSession(token: string): Promise<AuthenticatedUser> {
    const tokenHash = this.cryptoService.hashToken(token);
    const session = await this.databaseService.client.authSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !session ||
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException();
    }

    await this.databaseService.client.authSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    return this.toAuthenticatedUser(session.user);
  }

  private async createSession(user: AuthenticatedUser): Promise<SessionResult> {
    const token = this.cryptoService.createToken();

    await this.databaseService.client.authSession.create({
      data: {
        userId: user.id,
        tokenHash: this.cryptoService.hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
      },
    });

    return {
      token,
      user: this.toAuthenticatedUser(user),
    };
  }

  private toAuthenticatedUser(user: AuthenticatedUser): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  private async acceptInvitationForUser(
    tx: Prisma.TransactionClient,
    invitation: {
      id: string;
      organizationId: string;
      siteId: string | null;
      organizationRole: "OWNER" | "ADMIN" | "ANALYST" | null;
      siteRole: "SITE_ADMIN" | "EDITOR" | "AUTHOR" | "VIEWER" | null;
    },
    userId: string,
    acceptedAt: Date,
  ): Promise<void> {
    if (invitation.siteId && invitation.siteRole) {
      await tx.siteMembership.create({
        data: {
          siteId: invitation.siteId,
          userId,
          role: invitation.siteRole,
        },
      });
    } else if (invitation.organizationRole) {
      await tx.organizationMembership.create({
        data: {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.organizationRole,
        },
      });
    } else {
      throw new UnauthorizedException("Invitation is invalid.");
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt },
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}
