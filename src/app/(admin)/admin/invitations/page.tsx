"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useDateTimeFormatter } from "@/features/admin/lib/format";
import {
  useAdminInvitations,
  useCreateInvitation,
  useRevokeInvitation,
} from "@/features/admin/hooks/use-admin";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import { createInvitationSchema, type CreateInvitationValues } from "@/schemas/admin";
import { resolveZodMessage } from "@/schemas/auth";

const INVITE_STATUS_TONE = {
  pending: "warning",
  accepted: "success",
  revoked: "neutral",
} as const;

/**
 * Invitations register — the front door of the official system.
 * Accounts exist only through codes issued here; each code is single-use,
 * email-bound and time-bound.
 */
export default function AdminInvitationsPage() {
  const t = useT();
  const format = useDateTimeFormatter();
  const { data: invitations, isPending } = useAdminInvitations();
  const create = useCreateInvitation();
  const revoke = useRevokeInvitation();
  const [createdCode, setCreatedCode] = useState<{ email: string; code: string } | null>(null);
  const [actionError, setActionError] = useState(false);
  const [copied, setCopied] = useState(false);

  const form = useForm<CreateInvitationValues>({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: { role: "student", nationalId: "", note: "", expiresInDays: 14 },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setActionError(false);
    try {
      const result = await create.mutateAsync({
        email: values.email,
        role: values.role,
        nationalId: values.nationalId || undefined,
        note: values.note || undefined,
        expiresInDays: values.expiresInDays,
      });
      setCreatedCode({ email: values.email, code: result.code });
      setCopied(false);
      form.reset(form.getValues()); // Keep the chosen role/expiry; clear the email.
      form.setValue("email", "");
    } catch {
      setActionError(true);
    }
  });

  const copyCode = () => {
    if (!createdCode) return;
    void navigator.clipboard?.writeText(createdCode.code).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <section aria-labelledby="invitations-title" className="flex flex-col gap-6">
      <h1 id="invitations-title" className="text-2xl font-semibold tracking-tight">
        {t("admin.invitations.title")}
      </h1>

      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
      >
        <p className="micro-label">{t("admin.invitations.formLabel")}</p>
        {actionError && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger-foreground"
          >
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            {t("admin.actionFailed")}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label={t("admin.invitations.email")}
            type="email"
            autoComplete="off"
            aria-invalid={form.formState.errors.email ? true : undefined}
            error={
              form.formState.errors.email
                ? resolveZodMessage(form.formState.errors.email.message ?? "", t)
                : null
            }
            {...form.register("email")}
          />
          <InputField
            label={t("admin.invitations.expiresInDays")}
            type="number"
            inputMode="numeric"
            aria-invalid={form.formState.errors.expiresInDays ? true : undefined}
            error={
              form.formState.errors.expiresInDays
                ? resolveZodMessage(form.formState.errors.expiresInDays.message ?? "", t)
                : null
            }
            {...form.register("expiresInDays")}
          />
          <InputField
            label={t("admin.invitations.nationalId")}
            hint={t("admin.invitations.nationalIdHint")}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={form.formState.errors.nationalId ? true : undefined}
            error={
              form.formState.errors.nationalId
                ? resolveZodMessage(form.formState.errors.nationalId.message ?? "", t)
                : null
            }
            {...form.register("nationalId")}
          />
          <InputField
            label={t("admin.invitations.note")}
            hint={t("admin.invitations.noteHint")}
            autoComplete="off"
            aria-invalid={form.formState.errors.note ? true : undefined}
            error={
              form.formState.errors.note
                ? resolveZodMessage(form.formState.errors.note.message ?? "", t)
                : null
            }
            {...form.register("note")}
          />
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium">{t("auth.role")}</legend>
          <div className="flex gap-2" role="radiogroup" aria-label={t("auth.role")}>
            {(["student", "guardian"] as const).map((role) => {
              const selected = form.watch("role") === role;
              return (
                <button
                  key={role}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => form.setValue("role", role)}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:shadow-focus focus-visible:outline-none",
                    selected
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-input bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {selected && <Check className="size-3.5" aria-hidden="true" />}
                  {t(`auth.role.${role}`)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            {t("admin.invitations.create")}
          </Button>
        </div>
      </form>

      {createdCode && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
        >
          <p className="text-sm">
            {t("admin.invitations.created")} — <span dir="ltr">{createdCode.email}</span>
          </p>
          <code
            dir="ltr"
            className="rounded-sm border border-border bg-surface px-2.5 py-1 font-mono text-sm font-semibold tracking-wider"
          >
            {createdCode.code}
          </code>
          <Button size="sm" variant="secondary" onClick={copyCode}>
            {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copied ? t("admin.invitations.copied") : t("admin.invitations.copy")}
          </Button>
        </div>
      )}

      {isPending ? (
        <PageSkeleton />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t("admin.invitations.caption")}</caption>
            <thead>
              <tr className="border-b border-border">
                {[
                  t("admin.invitations.col.code"),
                  t("admin.invitations.col.email"),
                  t("admin.invitations.col.role"),
                  t("admin.invitations.col.status"),
                  t("admin.invitations.col.expires"),
                  t("admin.invitations.col.actions"),
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="px-3 py-2.5 text-start text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(invitations ?? []).map((invite) => (
                <tr key={invite.id} className="border-b border-border/60 last:border-b-0 align-middle">
                  <th scope="row" className="px-3 py-2.5 text-start font-normal">
                    <code dir="ltr" className="font-mono text-xs tracking-wider">
                      {invite.code}
                    </code>
                  </th>
                  <td className="px-3 py-2.5" dir="ltr">
                    <span className="block">{invite.email}</span>
                    {invite.note && (
                      <span className="block text-xs text-muted-foreground">{invite.note}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{t(`admin.role.${invite.role}`)}</td>
                  <td className="px-3 py-2.5">
                    <Badge
                      tone={
                        INVITE_STATUS_TONE[invite.status as keyof typeof INVITE_STATUS_TONE] ??
                        "neutral"
                      }
                    >
                      {t(`admin.invitations.status.${invite.status}`)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{format(invite.expiresAt)}</td>
                  <td className="px-3 py-2.5">
                    {invite.status === "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(invite.id)}
                      >
                        {t("admin.invitations.revoke")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
