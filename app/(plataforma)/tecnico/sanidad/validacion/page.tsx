import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { getInsumosFitosanitariosActivos } from "@/app/actions/queries";
import { ValidacionFitosanidadClient } from "@/components/tecnico/validacion-fitosanidad-client";

export default async function TecnicoSanidadValidacionPage() {
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
  const { data: raw } = await supabase
    .from("alertas_fitosanitarias")
    .select(
      "id, created_at, severidad, descripcion, catalogo_item_id, lote_id"
    )
    .eq("finca_id", fincaId)
    .eq("is_voided", false)
    .eq("validacion_estado", "pendiente")
    .order("created_at", { ascending: false })
    .limit(50);

  const list = raw ?? [];
  const loteIds = [...new Set(list.map((a) => a.lote_id))];
  const catIds = [
    ...new Set(
      list.map((a) => a.catalogo_item_id).filter((x): x is string => Boolean(x))
    ),
  ];

  const [{ data: lotesRows }, { data: catRows }] = await Promise.all([
    loteIds.length
      ? supabase.from("lotes").select("id, codigo").in("id", loteIds)
      : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
    catIds.length
      ? supabase.from("catalogo_items").select("id, nombre").in("id", catIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ]);

  const loteMap = new Map((lotesRows ?? []).map((l) => [l.id, l.codigo]));
  const catMap = new Map((catRows ?? []).map((c) => [c.id, c.nombre]));

  const alertas = list.map((row) => ({
    id: row.id,
    created_at: row.created_at,
    severidad: row.severidad,
    descripcion: row.descripcion,
    lote_codigo: loteMap.get(row.lote_id) ?? "—",
    amenaza: row.catalogo_item_id
      ? catMap.get(row.catalogo_item_id) ?? null
      : null,
  }));

  const insRes = await getInsumosFitosanitariosActivos();
  const insumos = insRes.success ? insRes.data : [];

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Validación de monitoreos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Revise las alertas registradas por operarios, documente el diagnóstico y,
          si aplica, emita una orden de control fitosanitario (RF15).
        </p>
      </div>
      <ValidacionFitosanidadClient
        alertas={alertas}
        insumosFitosanitarios={insumos}
      />
    </div>
  );
}
