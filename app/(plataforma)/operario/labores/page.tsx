import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
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
  const fincas = await getFincas(fincaId);
  const supabase = await createClient();

  const { data: laboresRaw } = fincaId
    ? await supabase
        .from("labores_agronomicas")
        .select("id, lote_id, tipo, fecha_ejecucion, notas, created_at")
        .eq("finca_id", fincaId)
        .eq("is_voided", false)
        .order("fecha_ejecucion", { ascending: false })
        .limit(200)
    : { data: [] as { id: string; lote_id: string; tipo: string; fecha_ejecucion: string; notas: string | null; created_at: string }[] };

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
  }));

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Labores agronómicas
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre la ejecución de labores en lote; el listado refleja los registros activos de su
          finca.
        </p>
      </div>
      <LaboresOperarioClient
        initialRows={initialRows}
        fincas={fincas}
        defaultFincaId={fincaId}
      />
    </div>
  );
}
