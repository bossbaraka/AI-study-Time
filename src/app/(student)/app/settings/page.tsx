"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { SectionBlock } from "@/components/layout/section-block";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { useLogout } from "@/features/auth/hooks/use-auth";
import { AUTH_ROUTES } from "@/features/auth/constants/auth.constants";
import { useStudent } from "@/features/journey/hooks/use-journey";
import { useI18n, useT, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";


const settingsSchema = z.object({
  name: z.string().min(3, "auth.errors.nameMin"),
  email: z.string().email("auth.errors.email"),
});

type SettingsValues = z.infer<typeof settingsSchema>;

type ThemeChoice = "dark" | "light" | "system";

export default function SettingsPage() {
  const t = useT();
  const router = useRouter();
  const logout = useLogout();
  const { locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const studentQuery = useStudent();
  const [saved, setSaved] = useState(false);
  const [notifyPrefs, setNotifyPrefs] = useState({
    mission: true,
    delay: true,
    mentor: false,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (studentQuery.data) {
      reset({ name: studentQuery.data.fullName, email: studentQuery.data.email });
    }
  }, [studentQuery.data, reset]);

  if (studentQuery.isLoading) return <PageSkeleton blocks={2} />;
  if (studentQuery.isError || !studentQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void studentQuery.refetch()}
      />
    );
  }

  const onSubmit = handleSubmit(async () => {
    // Account service seam: PATCH /api/me in production.
    await new Promise((r) => setTimeout(r, 400));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  });

  const themeChoices: ThemeChoice[] = ["dark", "light", "system"];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("settings.title")} />

      {/* Appearance */}
      <SectionBlock label={t("settings.appearance")}>
        <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5">
          <div>
            <p className="text-sm font-medium">{t("settings.theme")}</p>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label={t("settings.theme")}>
              {themeChoices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={theme === choice}
                  onClick={() => setTheme(choice)}
                  className={cn(
                    "rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:shadow-focus focus-visible:outline-none",
                    theme === choice
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`settings.theme.${choice}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">{t("settings.language")}</p>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label={t("settings.language")}>
              {SUPPORTED_LOCALES.map((code: Locale) => (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={locale === code}
                  onClick={() => setLocale(code)}
                  className={cn(
                    "rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:shadow-focus focus-visible:outline-none",
                    locale === code
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`settings.language.${code}`)}
                </button>
              ))}
            </div>
            <div className="mt-2 lg:hidden">
              <LanguageSwitch />
            </div>
          </div>
        </div>
      </SectionBlock>

      {/* Account */}
      <SectionBlock label={t("settings.account")}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <InputField
            label={t("settings.name")}
            autoComplete="name"
            error={errors.name ? t("auth.errors.nameMin") : null}
            {...register("name")}
          />
          <InputField
            label={t("settings.email")}
            type="email"
            autoComplete="email"
            error={errors.email ? t("auth.errors.email") : null}
            {...register("email")}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!isDirty}>
              {t("common.save")}
            </Button>
            {saved && (
              <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success">
                <Check className="size-4" aria-hidden="true" />
                {t("settings.saved")}
              </p>
            )}
          </div>
        </form>
      </SectionBlock>

      {/* Notification preferences */}
      <SectionBlock label={t("settings.notifications")}>
        <div className="flex flex-col rounded-lg border border-border bg-surface">
          {(
            [
              { key: "mission", label: t("settings.notifyMission") },
              { key: "delay", label: t("settings.notifyDelay") },
              { key: "mentor", label: t("settings.notifyMentor") },
            ] as const
          ).map((pref, i) => (
            <label
              key={pref.key}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-4 p-4",
                i > 0 && "border-t border-border",
              )}
            >
              <span className="text-sm font-medium">{pref.label}</span>
              <input
                type="checkbox"
                className="size-4 accent-[rgb(var(--primary))]"
                checked={notifyPrefs[pref.key]}
                onChange={(e) =>
                  setNotifyPrefs((p) => ({ ...p, [pref.key]: e.target.checked }))
                }
              />
            </label>
          ))}
        </div>
      </SectionBlock>

      {/* Guardian */}
      <SectionBlock label={t("settings.guardian")}>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-5">
          <ShieldCheck className="size-5 shrink-0 text-info" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("settings.guardianLinked")}</p>
          {studentQuery.data.guardianLinked && <Badge tone="info" className="ms-auto">{t("common.achieved")}</Badge>}
        </div>
      </SectionBlock>

      {/* Session — centralized logout: clears session + all cached student data */}
      <SectionBlock label={t("settings.danger")}>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t("settings.signOutHint")}</p>
          <Button
            variant="outline"
            className="shrink-0"
            disabled={logout.isPending}
            onClick={async () => {
              await logout.mutateAsync();
              router.replace(AUTH_ROUTES.login);
            }}
          >
            {logout.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
            {t("settings.signOut")}
          </Button>
        </div>
      </SectionBlock>
    </div>
  );
}
