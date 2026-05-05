import {
  getLotesPorFinca,
  getMonitoreosFitosanitariosRango,
  getOperariosFinca,
} from "@/app/actions/queries";
import { MonitoreosProgramadosClient } from "@/components/tecnico/monitoreos-programados-client";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { todayColombiaYmd } from "@/lib/date-colombia";

function monthRangeFromColombiaYmd(ymd: string): { desde: string; hasta: string; mesDesde: string } {
  const [y, m] = ymd.split("-").map(Number);
  const monthIndex0 = m - 1;
  const desde = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, monthIndex0 + 1, 0).getDate();
  const hasta = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { desde, hasta, mesDesde: desde };
}

export default async function ProgramacionMonitoreosPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;

  if (!fincaId) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-muted-foreground">
          No tiene una finca asignada. Solicite la asignación a un administrador.
        </p>
      </div>
    );
  }

  const hoy = todayColombiaYmd();
  const { desde, hasta, mesDesde } = monthRangeFromColombiaYmd(hoy);

  const [lotes, operarios, monitoreos] = await Promise.all([
    getLotesPorFinca(fincaId, { soloActivos: true }),
    getOperariosFinca(fincaId),
    getMonitoreosFitosanitariosRango(fincaId, desde, hasta),
  ]);

  if (!lotes.success) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{lotes.error}</p>
      </div>
    );
  }
  if (!operarios.success) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{operarios.error}</p>
      </div>
    );
  }
  if (!monitoreos.success) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{monitoreos.error}</p>
      </div>
    );
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Programación de monitoreos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspecciones fitosanitarias por lote, fecha y operario asignado. No se permiten fechas
          pasadas ni duplicados pendientes mismo lote y fecha.
        </p>
      </div>
      <MonitoreosProgramadosClient
        fincaId={fincaId}
        lotesActivos={lotes.data}
        operarios={operarios.data}
        mesInicialDesde={mesDesde}
        monitoreosIniciales={monitoreos.data}
      />
    </div>
  );
}
