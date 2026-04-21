import { redirect } from "next/navigation";
import { AuditoriaFincaClient } from "@/components/admin/auditoria-finca-client";
import { listarEventosAuditoriaFinca } from "@/app/actions/audit";
import { getSessionProfile } from "@/lib/auth/session-profile";

export default async function AdminAuditoriaPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  if (!fincaId) {
    redirect("/admin");
  }

  const res = await listarEventosAuditoriaFinca(fincaId);
  if (!res.success) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {res.error}
      </div>
    );
  }

  return (
    <AuditoriaFincaClient initialEvents={res.data} initialFincaId={fincaId} />
  );
}
