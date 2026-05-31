import { z } from "zod";

const slug = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const createSiteSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug,
});

export const organizationInvitationSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  role: z.enum(["OWNER", "ADMIN", "ANALYST"]),
});

export const siteInvitationSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  role: z.enum(["SITE_ADMIN", "EDITOR", "AUTHOR", "VIEWER"]),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(32).max(256),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type OrganizationInvitationInput = z.infer<
  typeof organizationInvitationSchema
>;
export type SiteInvitationInput = z.infer<typeof siteInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
