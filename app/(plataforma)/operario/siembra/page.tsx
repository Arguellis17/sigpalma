import { getSessionProfile } from "@/lib/auth/session-profile";
import { getLotesPendientesSiembra } from "@/app/actions/queries";
import { listRegistrosSiembraForFinca } from "@/app/actions/siembra-plantulas";
import { SiembraOperarioClient } from "@/components/operario/siembra-operario-client";

export default async function OperarioSiembraPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;

  const pendientesRes = fincaId
    ? await getLotesPendientesSiembra(fincaId)
    : { success: true as const, data: [] };

  const historialRes = fincaId
    ? await listRegistrosSiembraForFinca(fincaId)
    : { success: true as const, data: [] };

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Registro de siembra
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Formalice la siembra de plántulas en lotes con preparación aprobada; confirme
          parámetros técnicos y cantidad sembrada.
        </p>
      </div>
      <SiembraOperarioClient
        fincaId={fincaId}
        pendientes={pendientesRes.success ? pendientesRes.data : []}
        initialHistorial={historialRes.success ? historialRes.data : []}
      />
    </div>
  );
}
