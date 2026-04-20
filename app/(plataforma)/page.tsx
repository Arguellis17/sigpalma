import { getSessionProfile, getRoleDashboardPath } from "@/lib/auth/session-profile";
import { redirect } from "next/navigation";

/**
 * Root of the platform. Middleware handles the redirect for "/" already,
 * but this is a fallback for direct navigations.
 */
export default async function PlataformaRootPage() {
  const session = await getSessionProfile();
  const dest = getRoleDashboardPath(session?.profile?.role);
  redirect(dest);
}
