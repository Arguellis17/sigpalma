import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { listAplicacionesFitosanitariasForFinca } from "@/app/actions/fitosanidad";
import { AplicacionesOperarioClient } from "@/components/operario/aplicaciones-operario-client";

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
  const [{ data: ordenesRaw }, historialRes] = await Promise.all([
    supabase
      .from("ordenes_control")
      .select("id, lote_id, insumo_catalogo_id, dosis_recomendada, estado")
      .eq("finca_id", fincaId)
      .eq("estado", "autorizada")
      .order("created_at", { ascending: false }),
    listAplicacionesFitosanitariasForFinca(fincaId),
  ]);

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

  const historial = historialRes.success ? historialRes.data : [];

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Aplicación fitosanitaria
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ejecute órdenes de control autorizadas tras la validación del técnico (RF15). Confirme
          EPP, registre cantidad aplicada y capture la ubicación GPS en campo.
        </p>
      </div>
      <AplicacionesOperarioClient ordenes={ordenes} initialHistorial={historial} />
    </div>
  );
}
