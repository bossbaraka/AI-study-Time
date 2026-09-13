import Link from "next/link";
import type { ReactNode } from "react";
import { DoveMark, Wordmark } from "@/components/layout/wordmark";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { JOURNEY_STAGES } from "@/constants/journey";

/**
 * Auth layout: official split screen. Left — the navy brand band with
 * the journey spine (the product philosophy at the door). Right —
 * the form on paper.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="brand-edge flex min-h-dvh">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-navy p-10 lg:flex xl:w-[45%]">
        <DoveMark className="pointer-events-none absolute -end-10 bottom-16 size-64 text-white/[0.05]" />
        <Link href="/" aria-label="Mureeh home" className="relative">
          <Wordmark tone="onDark" />
        </Link>
        <div className="relative">
          <p className="font-display text-2xl font-semibold leading-snug tracking-tight text-white">
            A managed learning journey —
            <br />
            not another study app.
          </p>
          <ol className="mt-8 flex flex-wrap gap-x-2 gap-y-2" aria-hidden="true">
            {JOURNEY_STAGES.map((stage, i) => (
              <li
                key={stage}
                className="rounded-xs border border-white/15 bg-white/10 px-2 py-1 text-2xs font-medium capitalize text-white/75"
              >
                {String(i + 1).padStart(2, "0")} · {stage}
              </li>
            ))}
          </ol>
        </div>
        <p className="relative text-xs leading-relaxed text-white/45">
          Understand → Diagnose → Goal → Commit → Roadmap → Execute → Measure → Correct → Master → Achieve
        </p>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Link href="/" className="lg:hidden" aria-label="Mureeh home">
            <Wordmark compact />
          </Link>
          <LanguageSwitch />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
