import { AlertasFitosanitariasEnVivo } from "@/components/tecnico/alertas-fitosanitarias-en-vivo";
import { requireRole } from "@/lib/auth/session-profile";

export default async function TecnicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["agronomo"]);
  const fincaId = session.profile?.finca_id;
  return (
    <>
      {children}
      {fincaId ? <AlertasFitosanitariasEnVivo usuarioId={session.user.id} fincaId={fincaId} /> : null}
    </>
  );
}
