"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, Send, Sparkles, User } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import {
  useMentorMessages,
  useSendMentorMessage,
} from "@/features/intelligence/hooks/use-intelligence";
import { cn } from "@/lib/utils";

/**
 * Mentor conversation. Contextual suggestion chips are part of the
 * product: the mentor always knows the journey state and offers
 * journey-shaped actions, not open-ended chat.
 */
export function MentorChat() {
  const t = useT();
  const messagesQuery = useMentorMessages();
  const sendMessage = useSendMentorMessage();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sendMessage.isPending]);

  const submit = async (content: string) => {
    const trimmed = content.trim();
    if (trimmed.length === 0 || sendMessage.isPending) return;
    setDraft("");
    await sendMessage.mutateAsync(trimmed);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(draft);
  };

  const lastSuggestions = [...messages].reverse().find((m) => m.suggestions)?.suggestions ?? [];

  return (
    <div className="flex h-[calc(100dvh-16rem)] min-h-[420px] flex-col overflow-hidden rounded-xl border border-border bg-surface lg:h-[calc(100dvh-13rem)]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6" role="log" aria-live="polite" aria-label={t("mentor.title")}>
        <ul className="mx-auto flex max-w-3xl flex-col gap-4">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.li
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className={cn("flex gap-3", message.role === "student" && "flex-row-reverse")}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
                    message.role === "mentor"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {message.role === "mentor" ? <Bot className="size-4" /> : <User className="size-4" />}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg border px-4 py-3 text-sm leading-relaxed sm:max-w-[75%]",
                    message.role === "mentor"
                      ? "border-border bg-background"
                      : "border-primary/25 bg-primary/10",
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>

          {sendMessage.isPending && (
            <li className="flex gap-3" aria-label={t("mentor.thinking")}>
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                <Bot className="size-4" aria-hidden="true" />
              </span>
              <span className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                {t("mentor.thinking")}
              </span>
            </li>
          )}
        </ul>
      </div>

      {/* Contextual actions — journey-shaped, not open-ended */}
      {lastSuggestions.length > 0 && !sendMessage.isPending && (
        <div className="border-t border-border px-4 py-2.5 sm:px-6">
          <ul className="mx-auto flex max-w-3xl flex-wrap gap-1.5" aria-label={t("mentor.context")}>
            {lastSuggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => void submit(suggestion)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:shadow-focus focus-visible:outline-none"
                >
                  <Sparkles className="size-3" aria-hidden="true" />
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={onSubmit} className="border-t border-border p-4 sm:p-5">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <label htmlFor="mentor-input" className="sr-only">
            {t("mentor.inputPlaceholder")}
          </label>
          <textarea
            id="mentor-input"
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit(draft);
              }
            }}
            placeholder={t("mentor.inputPlaceholder")}
            className="max-h-32 min-h-10 flex-1 resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:shadow-focus focus-visible:outline-none"
          />
          <Button type="submit" size="icon" className="size-10 shrink-0" disabled={draft.trim().length === 0} aria-label={t("mentor.send")}>
            <Send aria-hidden="true" />
          </Button>
        </div>
      </form>
    </div>
  );
}
