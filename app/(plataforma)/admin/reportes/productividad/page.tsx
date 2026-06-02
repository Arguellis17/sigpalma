import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { ReporteProductividadClient } from "@/components/reportes/reporte-productividad-client";
import { createClient } from "@/lib/supabase/server";

export default async function AdminReporteProductividadPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;

  if (!fincaId) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-muted-foreground">
          No tiene una finca asignada. Solicite la asignación a un administrador del sistema.
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

  if (!finca) {
    redirect("/admin");
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Productividad RFF
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Rendimiento en toneladas por hectárea por lote y periodo (RN21). Solo lectura;
          los datos provienen de los registros de cosecha en campo.
        </p>
      </div>
      <ReporteProductividadClient
        fincas={[{ id: finca.id, nombre: finca.nombre }]}
        defaultFincaId={finca.id}
      />
    </div>
  );
}
