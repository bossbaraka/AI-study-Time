"use client";

import { useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { AccountStatusBadge } from "@/features/admin/components/status-badge";
import { useDateTimeFormatter } from "@/features/admin/lib/format";
import {
  useAdminUsers,
  useClearLock,
  useRevokeSessions,
  useSetUserStatus,
} from "@/features/admin/hooks/use-admin";
import { useT } from "@/lib/i18n/provider";
import type { AdminUserRow } from "@/types/admin";

/**
 * Accounts register — the official lifecycle console:
 * approve pending, suspend, restore, unlock, revoke live sessions.
 * Every action is executed by the server and lands in the audit trail.
 */
export default function AdminUsersPage() {
  const t = useT();
  const format = useDateTimeFormatter();
  const { data: users, isPending } = useAdminUsers();
  const setStatus = useSetUserStatus();
  const clearLock = useClearLock();
  const revokeSessions = useRevokeSessions();
  const [failed, setFailed] = useState(false);

  const feedback = {
    onError: () => setFailed(true),
    onSettled: () => setFailed(false),
  };

  const busyFor = (id: string) =>
    (setStatus.isPending && setStatus.variables?.id === id) ||
    (clearLock.isPending && clearLock.variables === id) ||
    (revokeSessions.isPending && revokeSessions.variables === id);

  if (isPending) return <PageSkeleton />;

  return (
    <section aria-labelledby="users-title" className="flex flex-col gap-4">
      <h1 id="users-title" className="text-2xl font-semibold tracking-tight">
        {t("admin.users.title")}
      </h1>

      {failed && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3.5 py-2.5 text-sm text-danger-foreground"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {t("admin.actionFailed")}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t("admin.users.caption")}</caption>
          <thead>
            <tr className="border-b border-border">
              {[
                t("admin.users.col.account"),
                t("admin.users.col.role"),
                t("admin.users.col.status"),
                t("admin.users.col.nationalId"),
                t("admin.users.col.sessions"),
                t("admin.users.col.created"),
                t("admin.users.col.actions"),
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-3 py-2.5 text-start text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((user) => (
              <UserRow
                key={user.id}
                user={user}
                busy={busyFor(user.id)}
                format={format}
                onApprove={() => setStatus.mutate({ id: user.id, status: "active" }, feedback)}
                onSuspend={() => setStatus.mutate({ id: user.id, status: "suspended" }, feedback)}
                onRestore={() => setStatus.mutate({ id: user.id, status: "active" }, feedback)}
                onUnlock={() => clearLock.mutate(user.id, feedback)}
                onRevoke={() => revokeSessions.mutate(user.id, feedback)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UserRow({
  user,
  busy,
  format,
  onApprove,
  onSuspend,
  onRestore,
  onUnlock,
  onRevoke,
}: {
  user: AdminUserRow;
  busy: boolean;
  format: (iso: string) => string;
  onApprove: () => void;
  onSuspend: () => void;
  onRestore: () => void;
  onUnlock: () => void;
  onRevoke: () => void;
}) {
  const t = useT();
  const locked = user.lockedUntil !== null && new Date(user.lockedUntil).getTime() > Date.now();

  return (
    <tr className="border-b border-border/60 last:border-b-0 align-middle">
      <th scope="row" className="px-3 py-2.5 text-start font-normal">
        <span className="block font-medium">{user.name}</span>
        <span className="block text-xs text-muted-foreground">{user.email}</span>
      </th>
      <td className="px-3 py-2.5">{t(`admin.role.${user.role}`)}</td>
      <td className="px-3 py-2.5">
        <AccountStatusBadge status={user.status} />
        {locked && (
          <span className="ms-2 text-2xs text-warning-foreground">{t("admin.users.locked")}</span>
        )}
      </td>
      <td className="tabular px-3 py-2.5 text-muted-foreground">{user.nationalIdTail ?? "—"}</td>
      <td className="tabular px-3 py-2.5">{user.sessions}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{format(user.createdAt)}</td>
      <td className="px-3 py-2.5">
        <span className="flex flex-wrap items-center gap-1.5">
          {busy && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
          {user.status === "pending" && (
            <Button size="sm" onClick={onApprove} disabled={busy}>
              {t("admin.users.approve")}
            </Button>
          )}
          {user.status === "active" && (
            <Button size="sm" variant="secondary" onClick={onSuspend} disabled={busy}>
              {t("admin.users.suspend")}
            </Button>
          )}
          {user.status === "suspended" && (
            <Button size="sm" variant="secondary" onClick={onRestore} disabled={busy}>
              {t("admin.users.restore")}
            </Button>
          )}
          {locked && (
            <Button size="sm" variant="ghost" onClick={onUnlock} disabled={busy}>
              {t("admin.users.unlock")}
            </Button>
          )}
          {user.sessions > 0 && user.status !== "active" && (
            <Button size="sm" variant="ghost" onClick={onRevoke} disabled={busy}>
              {t("admin.users.revoke")}
            </Button>
          )}
        </span>
      </td>
    </tr>
  );
}
