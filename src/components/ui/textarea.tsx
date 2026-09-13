import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | null;
  hint?: string;
  /** Visually hide the label when the prompt is already a visible heading. */
  hideLabel?: boolean;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, error, hint, hideLabel = false, className, id, rows = 4, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className={cn("text-sm font-medium text-foreground", hideLabel && "sr-only")}
        >
          {label}
        </label>
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "w-full rounded-md border bg-surface p-3 text-sm text-foreground shadow-xs transition-colors",
            "placeholder:text-muted-foreground/70",
            "focus-visible:border-ring focus-visible:shadow-focus focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error ? "border-danger" : "border-input",
            className,
          )}
          {...props}
        />
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
        {error && (
          <p id={errorId} role="alert" className="text-xs font-medium text-danger-foreground">
            {error}
          </p>
        )}
      </div>
    );
  },
);
TextAreaField.displayName = "TextAreaField";
