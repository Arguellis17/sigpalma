import { requireRole } from "@/lib/auth/session-profile";

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["superadmin"]);
  return <>{children}</>;
}
