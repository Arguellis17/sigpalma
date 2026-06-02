import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  PreparacionTerrenoValidacionClient,
  type PreparacionPendienteValidacionRow,
} from "@/components/tecnico/preparacion-terreno-validacion-client";

export default async function TecnicoPreparacionTerrenoPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const supabase = await createClient();

  let pendientes: PreparacionPendienteValidacionRow[] = [];

  if (fincaId) {
    const { data } = await supabase
      .from("preparaciones_terreno")
      .select("id, lote_id, pendiente_final_pct, actividades, notas, created_at")
      .eq("finca_id", fincaId)
      .eq("is_voided", false)
      .eq("estado", "pendiente_validacion_tecnico")
      .order("created_at", { ascending: false });

    const rows = data ?? [];
    const loteIds = [...new Set(rows.map((r) => r.lote_id))];
    const { data: lotesRows } = loteIds.length
      ? await supabase.from("lotes").select("id, codigo").in("id", loteIds)
      : { data: [] as { id: string; codigo: string }[] };

    const loteMap = new Map((lotesRows ?? []).map((l) => [l.id, l.codigo]));

    pendientes = rows.map((r) => ({
      id: r.id,
      lote_codigo: loteMap.get(r.lote_id) ?? "—",
      pendiente_final_pct: Number(r.pendiente_final_pct),
      actividades: r.actividades ?? [],
      created_at: r.created_at,
      notas: r.notas,
    }));
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Validación preparación de terreno
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Apruebe registros con pendiente ≥ 12 % para habilitar el lote a siembra.
        </p>
      </div>
      <PreparacionTerrenoValidacionClient pendientes={pendientes} />
    </div>
  );
}
