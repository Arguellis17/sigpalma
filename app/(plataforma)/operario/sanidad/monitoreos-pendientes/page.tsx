import { getMonitoreosPendientesOperario } from "@/app/actions/queries";
import { MonitoreosPendientesOperarioClient } from "@/components/operario/monitoreos-pendientes-client";
import { getSessionProfile } from "@/lib/auth/session-profile";

export default async function MonitoreosPendientesOperarioPage() {
  const session = await getSessionProfile();
  if (session?.profile?.role !== "operario") {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-muted-foreground">
          Esta vista es solo para operarios.
        </p>
      </div>
    );
  }

  const res = await getMonitoreosPendientesOperario();
  if (!res.success) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{res.error}</p>
      </div>
    );
  }

  const rows = res.data;

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Monitoreos pendientes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          HU13 · RN37: inspecciones fitosanitarias que el agrónomo le asignó. Marque como realizada cuando haya
          ejecutado la visita; luego puede registrar alertas desde «Alertas» (RF25/26).
        </p>
      </div>

      <MonitoreosPendientesOperarioClient rowsIniciales={rows} />
    </div>
  );
}
