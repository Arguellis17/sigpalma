import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { ExpedienteRspoClient } from "@/components/reportes/expediente-rspo-client";

export default async function AdminReporteRspoPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;

  if (!fincaId) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-muted-foreground">
          No tiene una finca asignada.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: finca } = await supabase
    .from("fincas")
    .select("id, nombre")
    .eq("id", fincaId)
    .maybeSingle();

  if (!finca) redirect("/admin");

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Expediente RSPO
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Genealogía técnica del lote para auditoría de sostenibilidad (RN23–RN25). Incluye cosecha y
          despacho cuando existen en el sistema.
        </p>
      </div>
      <ExpedienteRspoClient
        fincas={[{ id: finca.id, nombre: finca.nombre }]}
        defaultFincaId={finca.id}
      />
    </div>
  );
}
