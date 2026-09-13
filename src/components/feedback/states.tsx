import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Compass, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Shared feedback states. Every major feature renders exactly one of
 * loading / empty / error / content — never a blank screen.
 */

interface StateShellProps {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  tone?: "neutral" | "warning" | "danger";
  className?: string;
}

function StateShell({ icon: Icon, title, body, action, tone = "neutral", className }: StateShellProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-full border",
          tone === "neutral" && "border-border bg-muted text-muted-foreground",
          tone === "warning" && "border-warning/30 bg-warning-subtle text-warning",
          tone === "danger" && "border-danger/30 bg-danger-subtle text-danger",
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  className?: string;
}

/** Empty states always explain what the student should do next. */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  icon = Compass,
  className,
}: EmptyStateProps) {
  return (
    <StateShell
      icon={icon}
      title={title}
      body={body}
      className={className}
      action={
        actionLabel && onAction ? (
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : undefined
      }
    />
  );
}

export interface ErrorStateProps {
  title: string;
  body: string;
  onRetry?: () => void;
  /** Optional extra action rendered after the retry button (e.g. "back" link). */
  action?: ReactNode;
  className?: string;
}

/** Error states: human-readable explanation + retry. */
export function ErrorState({ title, body, onRetry, action, className }: ErrorStateProps) {
  return (
    <StateShell
      icon={AlertTriangle}
      tone="danger"
      title={title}
      body={body}
      className={className}
      action={
        onRetry || action ? (
          <span className="flex flex-wrap items-center justify-center gap-2">
            {onRetry && (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                <RefreshCw />
                Retry
              </Button>
            )}
            {action}
          </span>
        ) : undefined
      }
    />
  );
}

/**
 * Generic async-state wrapper enforcing the loading/empty/error/content contract.
 * Keeps feature components free of repetitive branching.
 */
export function AsyncState<T>({
  isLoading,
  isError,
  error,
  data,
  onRetry,
  loading,
  empty,
  errorTitle,
  errorBody,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  data: T | undefined;
  onRetry?: () => void;
  loading: ReactNode;
  empty?: (data: T) => boolean;
  errorTitle: string;
  errorBody: string;
  children: (data: T) => ReactNode;
}) {
  if (isLoading) return <>{loading}</>;
  if (isError || (error !== undefined && error !== null)) {
    return <ErrorState title={errorTitle} body={errorBody} onRetry={onRetry} />;
  }
  if (data === undefined) {
    return <ErrorState title={errorTitle} body={errorBody} onRetry={onRetry} />;
  }
  if (empty?.(data)) return null;
  return <>{children(data)}</>;
}
