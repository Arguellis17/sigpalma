import {
  getCatalogoLabores,
  getLaboresRango,
  getLotesPorFinca,
} from "@/app/actions/queries";
import { AgendaLaboresClient } from "@/components/tecnico/agenda-labores-client";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { endOfMonth, format, startOfMonth } from "date-fns";

export default async function TecnicoAgendaPage() {
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

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const [cat, lotes, labores] = await Promise.all([
    getCatalogoLabores(),
    getLotesPorFinca(fincaId, { soloActivos: true }),
    getLaboresRango(
      fincaId,
      format(monthStart, "yyyy-MM-dd"),
      format(monthEnd, "yyyy-MM-dd")
    ),
  ]);

  if (!cat.success) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{cat.error}</p>
      </div>
    );
  }
  if (!lotes.success) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{lotes.error}</p>
      </div>
    );
  }
  if (!labores.success) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{labores.error}</p>
      </div>
    );
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Agenda de labores
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Programe labores de mantenimiento por lote (HU11). Las fechas deben ser hoy o futuras; los
          tipos provienen del catálogo técnico.
        </p>
      </div>
      <AgendaLaboresClient
        fincaId={fincaId}
        catalogoLabores={cat.data}
        lotes={lotes.data}
        initialLabores={labores.data}
      />
    </div>
  );
}
