import { requireRole } from "@/lib/auth/session-profile";

export default async function TecnicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["agronomo"]);
  return <>{children}</>;
}
