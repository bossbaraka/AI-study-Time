"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BrainCircuit, CheckCircle2, Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TextAreaField } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/states";
import { useT } from "@/lib/i18n/provider";
import { useAnswerRecall } from "@/features/learning/hooks/use-learning";
import { cn, percent } from "@/lib/utils";
import type { ConfidenceLevel, RecallCard } from "@/types/domain";

type Phase = "prompt" | "answer" | "reveal" | "rate";

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["low", "medium", "high"];

/**
 * Active recall session.
 * The flow enforces retrieval before reveal:
 * prompt → write answer → check against reference → rate confidence.
 * Confidence adjusts the spaced-repetition interval (service-side).
 */
export function RecallSession({ cards }: { cards: RecallCard[] }) {
  const t = useT();
  const answerRecall = useAnswerRecall();

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("prompt");
  const [draft, setDraft] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const [ratedCount, setRatedCount] = useState(0);

  const card = cards[index];
  const sessionTotal = cards.length;

  const isChoiceMode = card?.mode === "multiple-choice";
  const isWriteMode = useMemo(
    () => card !== undefined && !isChoiceMode,
    [card, isChoiceMode],
  );

  if (!card) {
    return (
      <div className="flex flex-col gap-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5 rounded-xl border border-success/30 bg-surface p-10 text-center"
        >
          <span className="flex size-14 items-center justify-center rounded-full border border-success/40 bg-success-subtle text-success">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{t("recall.sessionDone.title")}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("recall.sessionDone.body", { count: ratedCount })}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  const reveal = () => setPhase("reveal");
  const rate = async (confidence: ConfidenceLevel) => {
    await answerRecall.mutateAsync({ cardId: card.id, confidence });
    setRatedCount((c) => c + 1);
    setDraft("");
    setChoice(null);
    setPhase("prompt");
    setIndex((i) => i + 1);
  };

  const choiceCorrect = isChoiceMode && choice === card.correctChoiceIndex;

  return (
    <div className="flex flex-col gap-5">
      {/* Session progress */}
      <div className="flex items-center gap-3">
        <Progress value={percent(index, sessionTotal)} size="sm" className="flex-1" />
        <span className="tabular text-xs font-medium text-muted-foreground">
          {index + 1} / {sessionTotal}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.article
          key={card.id + phase}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="rounded-xl border border-border bg-surface p-6 sm:p-8"
          aria-label={t(`recall.mode.${card.mode}`)}
        >
          <header className="flex flex-wrap items-center justify-between gap-2">
            <Badge tone="primary">
              <BrainCircuit className="size-3" aria-hidden="true" />
              {t(`recall.mode.${card.mode}`)}
            </Badge>
            <span className="text-2xs text-muted-foreground">
              {t("recall.instructions")}
            </span>
          </header>

          <h2 className="mt-5 text-lg font-semibold leading-snug tracking-tight sm:text-xl">
            {card.prompt}
          </h2>

          {/* PROMPT phase — retrieval before reveal */}
          {phase === "prompt" && (
            <div className="mt-6 flex flex-col gap-4">
              {isWriteMode && (
                <TextAreaField
                  label={t("recall.yourAnswer")}
                  hideLabel
                  rows={5}
                  placeholder={t("recall.writeAnswer")}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              )}
              {isChoiceMode && (
                <div role="radiogroup" aria-label={card.prompt} className="flex flex-col gap-2">
                  {(card.choices ?? []).map((option, i) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={choice === i}
                      onClick={() => setChoice(i)}
                      className={cn(
                        "rounded-md border px-4 py-3 text-start text-sm transition-colors focus-visible:shadow-focus focus-visible:outline-none",
                        choice === i
                          ? "border-primary/50 bg-primary/10 font-medium text-primary"
                          : "border-border bg-background hover:border-border-strong",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                {isWriteMode ? (
                  <Button onClick={() => setPhase("answer")} disabled={draft.trim().length === 0}>
                    {t("recall.checkAnswer")}
                  </Button>
                ) : (
                  <Button onClick={reveal} disabled={choice === null}>
                    {t("recall.checkAnswer")}
                  </Button>
                )}
                <Button variant="ghost" onClick={reveal}>
                  <Eye className="size-4" aria-hidden="true" />
                  {t("recall.showAnswer")}
                </Button>
              </div>
            </div>
          )}

          {/* ANSWER phase — self-check against reference */}
          {phase === "answer" && (
            <div className="mt-6 flex flex-col gap-4">
              <div className="rounded-md border border-border bg-background p-4">
                <p className="micro-label">{t("recall.yourAnswer")}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{draft}</p>
              </div>
              <Button onClick={reveal} className="w-fit">
                {t("recall.showAnswer")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}

          {/* REVEAL phase — reference answer + correctness for choices */}
          {phase === "reveal" && (
            <div className="mt-6 flex flex-col gap-4">
              {isChoiceMode && (
                <p
                  role="status"
                  className={cn(
                    "rounded-md border px-4 py-2.5 text-sm font-medium",
                    choiceCorrect
                      ? "border-success/30 bg-success-subtle text-success-foreground"
                      : "border-warning/30 bg-warning-subtle text-warning-foreground",
                  )}
                >
                  {choiceCorrect ? t("tests.result.correct") : t("tests.result.incorrect")}
                </p>
              )}
              <div className="rounded-md border border-info/25 bg-info-subtle p-4">
                <p className="micro-label !text-info-foreground">{t("recall.reference")}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-info-foreground">
                  {card.referenceAnswer}
                </p>
              </div>
              <Button onClick={() => setPhase("rate")} className="w-fit">
                {t("recall.rateConfidence")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}

          {/* RATE phase — confidence drives the interval, no childish scoring */}
          {phase === "rate" && (
            <fieldset className="mt-6">
              <legend className="text-sm font-medium">{t("recall.rateConfidence")}</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {CONFIDENCE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    disabled={answerRecall.isPending}
                    onClick={() => void rate(level)}
                    className={cn(
                      "rounded-md border px-4 py-3 text-sm font-medium transition-colors focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60",
                      level === "high" && "border-success/40 bg-success-subtle text-success-foreground hover:border-success",
                      level === "medium" && "border-info/40 bg-info-subtle text-info-foreground hover:border-info",
                      level === "low" && "border-warning/40 bg-warning-subtle text-warning-foreground hover:border-warning",
                    )}
                  >
                    {t(`recall.confidence.${level}`)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </motion.article>
      </AnimatePresence>
    </div>
  );
}

export function RecallEmpty({ onBrowse }: { onBrowse?: () => void }) {
  const t = useT();
  return (
    <EmptyState
      icon={BrainCircuit}
      title={t("recall.empty.title")}
      body={t("recall.empty.body")}
      actionLabel={onBrowse ? t("nav.learning") : undefined}
      onAction={onBrowse}
    />
  );
}
