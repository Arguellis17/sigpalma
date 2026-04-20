import { requireRole } from "@/lib/auth/session-profile";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["superadmin", "admin"]);
  return <>{children}</>;
}
