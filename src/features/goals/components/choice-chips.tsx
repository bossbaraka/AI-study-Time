"use client";

import { Check } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface ChoiceChipsProps {
  /** Accessible group label; rendered visibly as the section heading. */
  legend: string;
  options: readonly ChoiceOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name: string;
  error?: string | null;
  disabled?: boolean;
}

/**
 * Single-select chip group — real radio inputs (arrow-key navigation,
 * screen-reader semantics) styled as calm chips. Focus is visible via
 * has-[:focus-visible]; selection is never colour-only (check icon).
 */
export function ChoiceChips({
  legend,
  options,
  value,
  onChange,
  onBlur,
  name,
  error,
  disabled,
}: ChoiceChipsProps) {
  const errorId = useId();

  return (
    <fieldset
      className="flex flex-col gap-2.5"
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
    >
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors",
                "has-[:focus-visible]:shadow-focus",
                isSelected
                  ? "border-primary/50 bg-primary/10 font-medium text-primary"
                  : "border-border bg-surface text-foreground hover:border-border-strong",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
                onBlur={onBlur}
                className="sr-only"
              />
              {isSelected && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
              {option.label}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger-foreground">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export interface ToggleChipsProps {
  legend: string;
  options: readonly ChoiceOption[];
  values: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
}

/** Multi-select chip group — toggle buttons with aria-pressed. */
export function ToggleChips({ legend, options, values, onToggle, disabled }: ToggleChipsProps) {
  return (
    <fieldset className="flex flex-col gap-2.5" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isOn = values.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isOn}
              onClick={() => onToggle(option.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors",
                "focus-visible:shadow-focus focus-visible:outline-none",
                isOn
                  ? "border-primary/50 bg-primary/10 font-medium text-primary"
                  : "border-border bg-surface text-foreground hover:border-border-strong",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              {isOn && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
