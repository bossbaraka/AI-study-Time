import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: string;
  /** Rendered at the start edge (left in LTR, right in RTL). */
  leadingIcon?: ReactNode;
}

/**
 * Accessible input: label association, error announcement, focus ring.
 * Logical properties keep it RTL-correct automatically.
 */
export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, hint, leadingIcon, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <div className="relative">
          {leadingIcon && (
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-muted-foreground [&_svg]:size-4">
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={cn(error && errorId, hint && hintId) || undefined}
            className={cn(
              "h-10 w-full rounded-md border bg-surface px-3 text-sm text-foreground shadow-xs transition-colors",
              "placeholder:text-muted-foreground/70",
              "focus-visible:border-ring focus-visible:shadow-focus focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-60",
              error ? "border-danger" : "border-input",
              leadingIcon && "ps-9",
              className,
            )}
            {...props}
          />
        </div>
        {hint && !error && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs font-medium text-danger-foreground">
            {error}
          </p>
        )}
      </div>
    );
  },
);
InputField.displayName = "InputField";
