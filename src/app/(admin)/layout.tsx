import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminChrome } from "@/features/admin/components/admin-chrome";
import { homeRouteForRole } from "@/features/auth/lib/destination";
import { serverUser } from "@/lib/server/auth/request";

/**
 * Administration portal — the official gate.
 *
 * This is REAL server-side authorization: the session cookie is resolved
 * against the database, the role is checked, and non-admins never receive
 * a byte of admin markup. The client-side guard is decoration, not defense.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await serverUser();
  if (!user) {
    redirect("/sign-in?next=/admin");
  }
  if (user.role !== "admin") {
    redirect(homeRouteForRole(user.role));
  }
  return <AdminChrome>{children}</AdminChrome>;
}
