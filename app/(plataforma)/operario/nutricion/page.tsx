import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { todayColombiaYmd } from "@/lib/date-colombia";
import { listAplicacionesFertilizacionForFinca } from "@/app/actions/fertilizacion";
import { getNutricionPendientesOperario } from "@/app/actions/queries";
import { FertilizacionOperarioClient } from "@/components/operario/fertilizacion-operario-client";

export default async function OperarioNutricionPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const hoy = todayColombiaYmd();

  const pendientesRes = fincaId
    ? await getNutricionPendientesOperario(fincaId, hoy)
    : { success: true as const, data: [] };

  const historialRes = fincaId
    ? await listAplicacionesFertilizacionForFinca(fincaId)
    : { success: true as const, data: [] };

  const pendientes = pendientesRes.success ? pendientesRes.data : [];
  const historial = historialRes.success ? historialRes.data : [];

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Fertilización
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre la aplicación de fertilizantes según el plan nutricional del técnico.
          La dosis objetivo programada se muestra al seleccionar cada tarea.
        </p>
      </div>
      <FertilizacionOperarioClient
        fincaId={fincaId}
        pendientes={pendientes}
        initialHistorial={historial}
      />
    </div>
  );
}
