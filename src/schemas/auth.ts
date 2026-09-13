import { z } from "zod";
import { PASSWORD_DENYLIST, PASSWORD_POLICY } from "@/features/auth/constants/auth.constants";

/**
 * Centralized auth validation.
 *
 * Conventions:
 * - Messages are translation keys resolved by `resolveZodMessage` —
 *   schemas never embed human copy and raw Zod issues never reach users.
 * - Payload shapes mirror `src/types/auth.ts` exactly (satisfies checks).
 */

const emailField = z
  .string()
  .trim()
  .min(1, "auth.errors.required")
  .email("auth.errors.email")
  .max(254, "auth.errors.email");

/** Policy-aware password: length + letters + numbers, denylist rejected. */
const passwordField = z
  .string()
  .min(1, "auth.errors.required")
  .min(PASSWORD_POLICY.minLength, "auth.errors.passwordMin")
  .max(PASSWORD_POLICY.maxLength, "auth.errors.passwordMin")
  .refine(
    (value) =>
      !(PASSWORD_POLICY.requireLetter && PASSWORD_POLICY.requireNumber) ||
      (/[a-zA-Z]/.test(value) && /[0-9]/.test(value)),
    "auth.errors.passwordComplexity",
  )
  .refine(
    (value) => !PASSWORD_DENYLIST.includes(value.toLowerCase()),
    "auth.errors.passwordCommon",
  );

/**
 * Login accepts any non-empty password: policy enforcement belongs to
 * registration/reset. Re-validating policy at login would leak which
 * passwords could never have been registered.
 */
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "auth.errors.required"),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "auth.errors.nameMin")
      .max(80, "auth.errors.nameMin"),
    email: emailField,
    role: z.enum(["student", "guardian"]),
    password: passwordField,
    confirmPassword: z.string().min(1, "auth.errors.required"),
    /** Institutional invitation code — issued by the administration portal. */
    inviteCode: z
      .string()
      .trim()
      .min(6, "auth.errors.invitationInvalid")
      .max(24, "auth.errors.invitationInvalid"),
    /** Optional national identifier — digits only, uniqueness enforced server-side. */
    nationalId: z
      .string()
      .trim()
      .regex(/^\d{8,14}$/, "auth.errors.nationalIdFormat")
      .or(z.literal(""))
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "auth.errors.passwordMatch",
  });

export const registerApiSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "auth.errors.nameMin")
    .max(80, "auth.errors.nameMin"),
  email: emailField,
  role: z.enum(["student", "guardian"]),
  password: passwordField,
  inviteCode: z
    .string()
    .trim()
    .min(6, "auth.errors.invitationInvalid")
    .max(24, "auth.errors.invitationInvalid"),
  nationalId: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, "auth.errors.nationalIdFormat")
    .or(z.literal(""))
    .optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

/** Reset: token comes from the emailed link, password must meet policy. */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "auth.errors.tokenInvalid"),
    password: passwordField,
    confirmPassword: z.string().min(1, "auth.errors.required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "auth.errors.passwordMatch",
  });

export const resendVerificationSchema = z.object({
  email: emailField,
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ResendVerificationValues = z.infer<typeof resendVerificationSchema>;

/* Compile-time guarantee that form shapes match the service payloads. */
type _LoginMatchesPayload = LoginValues extends
  import("@/types/auth").LoginPayload
  ? true
  : never;
type _ForgotMatchesPayload = ForgotPasswordValues extends
  import("@/types/auth").ForgotPasswordPayload
  ? true
  : never;
export type SchemaContractChecks = [_LoginMatchesPayload, _ForgotMatchesPayload];

/**
 * Resolve a Zod issue message: translation keys are translated,
 * anything else passes through untouched.
 */
export function resolveZodMessage(
  message: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  return /^[a-z]+\.[a-zA-Z.]+$/.test(message) ? t(message) : message;
}
