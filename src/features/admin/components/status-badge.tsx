import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/provider";
import type { AccountStatusCode } from "@/types/admin";

const TONE: Record<AccountStatusCode, "success" | "warning" | "danger"> = {
  active: "success",
  pending: "warning",
  suspended: "danger",
};

export function AccountStatusBadge({ status }: { status: AccountStatusCode }) {
  const t = useT();
  return <Badge tone={TONE[status]}>{t(`admin.status.${status}`)}</Badge>;
}
