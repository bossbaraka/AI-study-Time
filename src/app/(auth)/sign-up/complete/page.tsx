"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

/**
 * Post-registration confirmation (gateway flow): the institutional
 * invitation already served as verification, so the account is ready —
 * this page closes the loop without signing the student in silently.
 */
export default function RegisterCompletePage() {
  const t = useT();
  return (
    <div className="flex flex-col items-start gap-5 rounded-lg border border-border bg-surface p-6 shadow-sm">
      <span className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("auth.registerComplete.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("auth.registerComplete.body")}
        </p>
      </div>
      <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
        {t("auth.registerComplete.cta")}
      </Link>
    </div>
  );
}
