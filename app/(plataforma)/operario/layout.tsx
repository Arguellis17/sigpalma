import { MonitoreosAsignadosEnVivo } from "@/components/operario/monitoreos-asignados-en-vivo";
import { requireRole } from "@/lib/auth/session-profile";

export default async function OperarioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["operario"]);
  return (
    <>
      {children}
      <MonitoreosAsignadosEnVivo operarioId={session.user.id} />
    </>
  );
}
