"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string | null;
  hint?: string;
}

/**
 * Password input with an accessible visibility toggle.
 * - toggle is a real <button> with aria-pressed and a localized label
 * - error is announced via aria-invalid + aria-describedby
 * - logical properties (ps/pe) keep it RTL-correct
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const t = useT();
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const toggleId = `${inputId}-toggle`;
    const [visible, setVisible] = useState(false);

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
          {hint && (
            <span id={hintId} className="text-2xs text-muted-foreground">
              {hint}
            </span>
          )}
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-muted-foreground">
            <Lock className="size-4" aria-hidden="true" />
          </span>
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={cn(
              "h-11 w-full rounded-md border bg-surface ps-9 pe-11 text-sm text-foreground shadow-xs transition-colors",
              "placeholder:text-muted-foreground/70",
              "focus-visible:border-ring focus-visible:shadow-focus focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-60",
              error ? "border-danger" : "border-input",
              className,
            )}
            {...props}
          />
          <button
            id={toggleId}
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? t("auth.password.hide") : t("auth.password.show")}
            aria-controls={inputId}
            className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:shadow-focus focus-visible:outline-none rounded-e-md"
          >
            {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs font-medium text-danger-foreground">
            {error}
          </p>
        )}
      </div>
    );
  },
);
PasswordField.displayName = "PasswordField";
