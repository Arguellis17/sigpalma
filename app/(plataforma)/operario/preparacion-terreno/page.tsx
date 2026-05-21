import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  getLotesPendientesPreparacionTerreno,
} from "@/app/actions/queries";
import { listPreparacionesTerrenoForFinca } from "@/app/actions/preparacion-terreno";
import { PreparacionTerrenoOperarioClient } from "@/components/operario/preparacion-terreno-operario-client";

export default async function OperarioPreparacionTerrenoPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;

  const pendientesRes = fincaId
    ? await getLotesPendientesPreparacionTerreno(fincaId)
    : { success: true as const, data: [] };

  const historialRes = fincaId
    ? await listPreparacionesTerrenoForFinca(fincaId)
    : { success: true as const, data: [] };

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Preparación de terreno
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre la adecuación física del lote planificado: actividades realizadas y
          pendiente final (&lt; 12 % para habilitar siembra).
        </p>
      </div>
      <PreparacionTerrenoOperarioClient
        fincaId={fincaId}
        pendientes={pendientesRes.success ? pendientesRes.data : []}
        initialHistorial={historialRes.success ? historialRes.data : []}
      />
    </div>
  );
}
