"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  RotateCcw,
  Timer,
} from "lucide-react";
import { JOURNEY_STAGES } from "@/constants/journey";
import { Button } from "@/components/ui/button";
import { DoveMark, Wordmark } from "@/components/layout/wordmark";
import { useI18n, useT } from "@/lib/i18n/provider";
import { LanguageSwitch } from "@/components/layout/language-switch";

/**
 * Marketing surface. Communicates the product philosophy:
 * a managed journey, locked destination, adaptive execution.
 */
export default function MarketingPage() {
  const t = useT();
  const { direction } = useI18n();
  const Arrow = direction === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-dvh bg-background">
      <header className="brand-edge sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Wordmark />
          <nav aria-label="Marketing" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#journey" className="transition-colors hover:text-foreground">{t("marketing.nav.journey")}</a>
            <a href="#rules" className="transition-colors hover:text-foreground">{t("marketing.nav.product")}</a>
            <Link href="/app/subscription" className="transition-colors hover:text-foreground">{t("marketing.nav.pricing")}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">{t("marketing.nav.signIn")}</Button>
            </Link>
            <Link href="/sign-up" className="hidden sm:block">
              <Button size="sm">{t("marketing.nav.getStarted")}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* Hero */}
        <section className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <DoveMark className="pointer-events-none absolute -end-4 top-10 hidden size-56 text-brand-blue/5 lg:block" />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <p className="micro-label">{t("marketing.hero.eyebrow")}</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              {t("marketing.hero.title")}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("marketing.hero.subtitle")}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/assessment">
                <Button size="lg">
                  {t("marketing.hero.cta")}
                  <Arrow className="size-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="#journey">
                <Button size="lg" variant="secondary">{t("marketing.hero.secondary")}</Button>
              </Link>
            </div>
          </motion.div>

          {/* Journey spine preview */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="mt-16 rounded-xl border border-border bg-surface p-5 sm:p-7"
            aria-label={t("marketing.journey.title")}
          >
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
              {JOURNEY_STAGES.map((stage, i) => (
                <li key={stage} className="flex items-center gap-2">
                  <span
                    className={
                      i <= 5
                        ? "rounded-sm border border-primary/30 bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary"
                        : "rounded-sm border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {t(`marketing.stage.${stage}`)}
                  </span>
                  {i < JOURNEY_STAGES.length - 1 && (
                    <Arrow className="size-3.5 text-muted-foreground/50" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </motion.div>
        </section>

        {/* Journey */}
        <section id="journey" className="border-t border-border bg-surface/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("marketing.journey.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("marketing.journey.subtitle")}
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {JOURNEY_STAGES.map((stage, i) => (
                <div key={stage} className="rounded-lg border border-border bg-surface p-4">
                  <span className="tabular text-2xs font-semibold text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-1.5 text-sm font-semibold">{t(`marketing.stage.${stage}`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Product rules */}
        <section id="rules" className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("marketing.pillars.title")}
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {[
                { icon: Lock, title: t("marketing.pillar1.title"), body: t("marketing.pillar1.body") },
                { icon: Check, title: t("marketing.pillar2.title"), body: t("marketing.pillar2.body") },
                { icon: RotateCcw, title: t("marketing.pillar3.title"), body: t("marketing.pillar3.body") },
                { icon: Timer, title: t("marketing.pillar4.title"), body: t("marketing.pillar4.body") },
              ].map((pillar) => (
                <div
                  key={pillar.title}
                  className="flex gap-4 rounded-lg border border-border bg-surface p-5"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                    <pillar.icon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{pillar.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {pillar.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA — official navy band */}
        <section className="bg-brand-navy text-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
            <DoveMark className="size-10 text-white" />
            <h2 className="max-w-2xl text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              {t("marketing.cta.title")}
            </h2>
            <Link href="/assessment">
              <Button size="lg" className="bg-white text-brand-navy hover:bg-white/90">
                {t("marketing.cta.button")}
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <Wordmark compact />
          <p>© {new Date().getFullYear()} {t("product.name")}. {t("marketing.footer.rights")}</p>
        </div>
      </footer>
    </div>
  );
}
