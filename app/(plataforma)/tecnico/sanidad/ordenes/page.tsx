import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { OrdenesControlClient } from "@/components/tecnico/ordenes-control-client";

export default async function TecnicoSanidadOrdenesPage() {
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
    .select("id, estado, created_at, dosis_recomendada, lote_id, insumo_catalogo_id")
    .eq("finca_id", fincaId)
    .order("created_at", { ascending: false })
    .limit(80);

  const list = ordenesRaw ?? [];
  const loteIds = [...new Set(list.map((o) => o.lote_id))];
  const insumoIds = [...new Set(list.map((o) => o.insumo_catalogo_id))];

  const [{ data: lotes }, { data: insumos }] = await Promise.all([
    loteIds.length
      ? supabase.from("lotes").select("id, codigo").in("id", loteIds)
      : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
    insumoIds.length
      ? supabase.from("catalogo_items").select("id, nombre").in("id", insumoIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ]);

  const loteMap = new Map((lotes ?? []).map((l) => [l.id, l.codigo]));
  const insumoMap = new Map((insumos ?? []).map((i) => [i.id, i.nombre]));

  const ordenes = list.map((o) => ({
    id: o.id,
    estado: o.estado,
    created_at: o.created_at,
    dosis_recomendada: o.dosis_recomendada,
    lote_codigo: loteMap.get(o.lote_id) ?? "—",
    insumo_nombre: insumoMap.get(o.insumo_catalogo_id) ?? "—",
  }));

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Órdenes de control
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Órdenes emitidas tras validar alertas. Las autorizadas pueden ser aplicadas
          por el operario o canceladas aquí.
        </p>
      </div>
      <OrdenesControlClient ordenes={ordenes} />
    </div>
  );
}
