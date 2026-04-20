import { requireRole } from "@/lib/auth/session-profile";

export default async function OperarioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["superadmin", "admin", "agronomo", "operario"]);
  return <>{children}</>;
}
