import { requireRole } from "@/lib/auth/session-profile";

export default async function TecnicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["superadmin", "admin", "agronomo"]);
  return <>{children}</>;
}
