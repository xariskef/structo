import type { Request } from "express";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthenticatedRequest extends Request {
  authenticatedUser?: AuthenticatedUser;
}
