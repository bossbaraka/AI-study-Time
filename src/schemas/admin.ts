import { z } from "zod";

/** Administration-portal form schemas (translation-key messages, as usual). */

export const createInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "auth.errors.required")
    .email("auth.errors.email")
    .max(254, "auth.errors.email"),
  role: z.enum(["student", "guardian"]),
  nationalId: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, "auth.errors.nationalIdFormat")
    .or(z.literal("")),
  note: z.string().trim().max(200, "admin.invitations.noteMax"),
  expiresInDays: z.coerce.number().int().min(1).max(90),
});

export type CreateInvitationValues = z.infer<typeof createInvitationSchema>;
