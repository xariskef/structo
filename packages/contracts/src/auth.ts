import { z } from "zod";

const password = z.string().min(12).max(128);
const slug = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const registerOwnerSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password,
  name: z.string().trim().min(2).max(100),
  organizationName: z.string().trim().min(2).max(100),
  organizationSlug: slug,
});

export const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password,
});

export const registerInvitedMemberSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password,
  name: z.string().trim().min(2).max(100),
  invitationToken: z.string().min(32).max(256),
});

export type RegisterOwnerInput = z.infer<typeof registerOwnerSchema>;
export type RegisterInvitedMemberInput = z.infer<
  typeof registerInvitedMemberSchema
>;
export type LoginInput = z.infer<typeof loginSchema>;
