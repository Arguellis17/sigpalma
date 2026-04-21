import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { CosechaOperarioClient } from "@/components/operario/cosecha-operario-client";

async function getFincas(fincaId: string | null) {
  const supabase = await createClient();
  const query = fincaId
    ? supabase.from("fincas").select("id, nombre").eq("id", fincaId)
    : supabase.from("fincas").select("id, nombre").order("nombre");
  const { data } = await query;
  return data ?? [];
}

type CosechaRaw = {
  id: string;
  lote_id: string;
  fecha: string;
  peso_kg: string;
  conteo_racimos: number;
  madurez_frutos_caidos_min: number | null;
  madurez_frutos_caidos_max: number | null;
  observaciones_calidad: string | null;
  created_at: string;
};

export default async function OperarioCosechaPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const fincas = await getFincas(fincaId);
  const supabase = await createClient();

  const { data: cosechasRaw } = fincaId
    ? await supabase
        .from("cosechas_rff")
        .select(
          "id, lote_id, fecha, peso_kg, conteo_racimos, madurez_frutos_caidos_min, madurez_frutos_caidos_max, observaciones_calidad, created_at"
        )
        .eq("finca_id", fincaId)
        .eq("is_voided", false)
        .order("fecha", { ascending: false })
        .limit(200)
    : { data: [] as CosechaRaw[] };

  const cr = cosechasRaw ?? [];
  const loteIds = [...new Set(cr.map((c) => c.lote_id))];
  const { data: lotesRows } = loteIds.length
    ? await supabase
        .from("lotes")
        .select("id, codigo, area_ha")
        .in("id", loteIds)
    : { data: [] as { id: string; codigo: string; area_ha: string }[] };

  const loteMap = new Map(
    (lotesRows ?? []).map((l) => [
      l.id,
      { codigo: l.codigo, area_ha: Number(l.area_ha) },
    ])
  );

  const initialRows = cr.map((c) => {
    const lote = loteMap.get(c.lote_id);
    const areaHa = lote?.area_ha ?? 0;
    const pesoKg = Number(c.peso_kg);
    const rendimiento_ton_ha =
      Number.isFinite(areaHa) && areaHa > 0 && Number.isFinite(pesoKg)
        ? pesoKg / 1000 / areaHa
        : 0;
    return {
      id: c.id,
      fecha: c.fecha,
      peso_kg: c.peso_kg,
      conteo_racimos: c.conteo_racimos,
      madurez_frutos_caidos_min: c.madurez_frutos_caidos_min,
      madurez_frutos_caidos_max: c.madurez_frutos_caidos_max,
      observaciones_calidad: c.observaciones_calidad,
      lote_codigo: lote?.codigo ?? "—",
      area_ha: areaHa,
      rendimiento_ton_ha,
      created_at: c.created_at,
    };
  });

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Cosecha RFF</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reporte de fruto fresco: peso, racimos y rendimiento estimado (t/ha) según área del lote.
        </p>
      </div>
      <CosechaOperarioClient
        initialRows={initialRows}
        fincas={fincas}
        defaultFincaId={fincaId}
      />
    </div>
  );
}
