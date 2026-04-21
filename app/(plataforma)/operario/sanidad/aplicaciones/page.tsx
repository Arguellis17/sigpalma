import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { AplicacionFitosanitariaForm } from "@/components/operario/aplicacion-fitosanitaria-form";

export default async function OperarioSanidadAplicacionesPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;

  if (!fincaId) {
    return (
      <p className="surface-panel rounded-2xl p-5 text-sm text-muted-foreground">
        Sin finca asignada.
      </p>
    );
  }

  const supabase = await createClient();
  const { data: ordenesRaw } = await supabase
    .from("ordenes_control")
    .select("id, lote_id, insumo_catalogo_id, dosis_recomendada, estado")
    .eq("finca_id", fincaId)
    .eq("estado", "autorizada")
    .order("created_at", { ascending: false });

  const ordenesList = ordenesRaw ?? [];
  const loteIds = [...new Set(ordenesList.map((o) => o.lote_id))];
  const insumoIds = [...new Set(ordenesList.map((o) => o.insumo_catalogo_id))];

  const [{ data: lotes }, { data: insumos }] = await Promise.all([
    loteIds.length
      ? supabase.from("lotes").select("id, codigo").in("id", loteIds)
      : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
    insumoIds.length
      ? supabase
          .from("catalogo_items")
          .select("id, nombre, unidad_medida")
          .in("id", insumoIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string; unidad_medida: string | null }[] }),
  ]);

  const loteMap = new Map((lotes ?? []).map((l) => [l.id, l.codigo]));
  const insumoMap = new Map(
    (insumos ?? []).map((i) => [i.id, { nombre: i.nombre, um: i.unidad_medida }])
  );

  const ordenes = ordenesList.map((o) => ({
    id: o.id,
    dosis_recomendada: o.dosis_recomendada,
    lote_codigo: loteMap.get(o.lote_id) ?? o.lote_id.slice(0, 8),
    insumo_nombre: insumoMap.get(o.insumo_catalogo_id)?.nombre ?? "Insumo",
    unidad_medida: insumoMap.get(o.insumo_catalogo_id)?.um ?? null,
  }));

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Aplicación fitosanitaria
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ejecute las órdenes de control autorizadas por el técnico tras la validación del
          monitoreo. Confirme el uso del equipo de protección personal (EPP) antes de registrar.
        </p>
      </div>
      <AplicacionFitosanitariaForm ordenes={ordenes} />
    </div>
  );
}
