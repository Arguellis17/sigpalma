import { endOfMonth, format, startOfMonth } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  getCatalogoLabores,
  getLaboresPendientesEjecucion,
  getLaboresRango,
  getLotesPorFinca,
} from "@/app/actions/queries";
import { LaboresOperarioClient } from "@/components/operario/labores-operario-client";

async function getFincas(fincaId: string | null) {
  const supabase = await createClient();
  const query = fincaId
    ? supabase.from("fincas").select("id, nombre").eq("id", fincaId)
    : supabase.from("fincas").select("id, nombre").order("nombre");
  const { data } = await query;
  return data ?? [];
}

export default async function OperarioLaboresPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const operarioId = session?.user?.id ?? null;
  const fincas = await getFincas(fincaId);
  const supabase = await createClient();
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  const monthDesde = format(monthStart, "yyyy-MM-dd");
  const monthHasta = format(monthEnd, "yyyy-MM-dd");

  const laboresOpts = operarioId ? { operarioId } : undefined;

  const [catalogoRes, pendientesRes, lotesRes, agendaRes] = fincaId
    ? await Promise.all([
        getCatalogoLabores(),
        getLaboresPendientesEjecucion(fincaId, laboresOpts),
        getLotesPorFinca(fincaId),
        getLaboresRango(fincaId, monthDesde, monthHasta, laboresOpts),
      ])
    : [
        { success: true as const, data: [] },
        { success: true as const, data: [] },
        { success: true as const, data: [] },
        { success: true as const, data: [] },
      ];

  const catalogoLabores = catalogoRes.success ? catalogoRes.data : [];
  const pendientes = pendientesRes.success ? pendientesRes.data : [];
  const lotes = lotesRes.success ? lotesRes.data : [];
  const initialAgendaLabores = agendaRes.success ? agendaRes.data : [];

  let ejecutadasQuery = fincaId
    ? supabase
        .from("labores_agronomicas")
        .select(
          "id, lote_id, tipo, fecha_ejecucion, notas, created_at, cantidad_ejecutada, unidad_medida, ejecutada_at"
        )
        .eq("finca_id", fincaId)
        .eq("is_voided", false)
        .not("cantidad_ejecutada", "is", null)
    : null;
  if (ejecutadasQuery && operarioId) {
    ejecutadasQuery = ejecutadasQuery.or(
      `assigned_to.is.null,assigned_to.eq.${operarioId}`
    );
  }
  const { data: laboresRaw } = ejecutadasQuery
    ? await ejecutadasQuery
        .order("ejecutada_at", { ascending: false })
        .limit(200)
    : {
        data: [] as {
          id: string;
          lote_id: string;
          tipo: string;
          fecha_ejecucion: string;
          notas: string | null;
          created_at: string;
          cantidad_ejecutada: number;
          unidad_medida: string;
          ejecutada_at: string;
        }[],
      };

  const lr = laboresRaw ?? [];
  const loteIds = [...new Set(lr.map((l) => l.lote_id))];
  const { data: lotesRows } = loteIds.length
    ? await supabase.from("lotes").select("id, codigo").in("id", loteIds)
    : { data: [] as { id: string; codigo: string }[] };

  const loteMap = new Map((lotesRows ?? []).map((l) => [l.id, l.codigo]));

  const initialRows = lr.map((l) => ({
    id: l.id,
    fecha_ejecucion: l.fecha_ejecucion,
    tipo: l.tipo,
    notas: l.notas,
    lote_codigo: loteMap.get(l.lote_id) ?? "—",
    created_at: l.created_at,
    cantidad_ejecutada: Number(l.cantidad_ejecutada),
    unidad_medida: l.unidad_medida ?? "",
    ejecutada_at: l.ejecutada_at ?? l.created_at,
  }));

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Labores agronómicas
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reporte la ejecución de labores de mantenimiento; las tareas programadas
          por el técnico aparecen al registrar una nueva labor.
        </p>
      </div>
      <LaboresOperarioClient
        initialRows={initialRows}
        fincas={fincas}
        defaultFincaId={fincaId}
        operarioId={operarioId}
        catalogoLabores={catalogoLabores}
        pendientes={pendientes}
        lotes={lotes}
        initialAgendaLabores={initialAgendaLabores}
      />
    </div>
  );
}
