"use client";

import { cn } from "@/lib/utils";
import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";

interface TabsContextValue {
  active: string;
  setActive: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used within <Tabs>");
  return ctx;
}

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ value, defaultValue, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const baseId = useId();
  const active = value ?? internal;

  const setActive = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ active, setActive, baseId }}>
      <div className={cn("flex flex-col gap-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

export function TabsList({ items, className }: { items: TabItem[]; className?: string }) {
  const { active, setActive, baseId } = useTabsContext();
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "flex w-fit items-center gap-1 rounded-md border border-border bg-surface p-1",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === active;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            id={`${baseId}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => setActive(item.value)}
            onKeyDown={(event) => {
              const index = items.findIndex((i) => i.value === item.value);
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                const delta = event.key === "ArrowRight" ? 1 : -1;
                const next = items[(index + delta + items.length) % items.length]!;
                setActive(next.value);
                document.getElementById(`${baseId}-tab-${next.value}`)?.focus();
              }
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:shadow-focus focus-visible:outline-none [&_svg]:size-4",
              selected
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { active, baseId } = useTabsContext();
  if (value !== active) return null;
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className={cn("focus-visible:shadow-focus focus-visible:outline-none", className)}
    >
      {children}
    </div>
  );
}
