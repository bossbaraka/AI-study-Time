"use client";

import { Check } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import type { AssessmentOption } from "@/types/assessment";

export interface OptionRadioListProps {
  options: AssessmentOption[];
  value: string | undefined;
  onChange: (optionId: string) => void;
  onBlur?: () => void;
  name: string;
  /** Accessible group label (rendered as the fieldset legend). */
  legend: string;
  error?: string | null;
  disabled?: boolean;
}

/**
 * Accessible single-select option list: real radio inputs inside a
 * labelled fieldset. Native keyboard behavior (arrows move + select),
 * visible focus via peer-focus-visible, errors announced with role=alert.
 */
export function OptionRadioList({
  options,
  value,
  onChange,
  onBlur,
  name,
  legend,
  error,
  disabled,
}: OptionRadioListProps) {
  const errorId = useId();

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
    >
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => {
        const isSelected = value === option.id;
        return (
          <label
            key={option.id}
            className={cn(
              "relative flex cursor-pointer items-center justify-between gap-3 rounded-md border px-4 py-3",
              "transition-colors",
              isSelected
                ? "border-primary/50 bg-primary/10"
                : "border-border bg-surface hover:border-border-strong",
              "has-[:focus-visible]:shadow-focus",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={isSelected}
              onChange={() => onChange(option.id)}
              onBlur={onBlur}
              className="peer size-4 shrink-0 accent-primary focus-visible:outline-none"
            />
            <span
              className={cn(
                "flex-1 text-sm text-start",
                isSelected ? "font-medium text-primary" : "text-foreground",
              )}
            >
              {option.label}
            </span>
            {isSelected && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
          </label>
        );
      })}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger-foreground">
          {error}
        </p>
      )}
    </fieldset>
  );
}
