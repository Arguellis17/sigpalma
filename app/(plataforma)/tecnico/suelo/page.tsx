import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  TecnicoSueloClient,
  type AnalisisSueloListRow,
} from "./tecnico-suelo-client";

async function getAnalisis(fincaId: string | null): Promise<AnalisisSueloListRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("analisis_suelo")
    .select(
      "id, ph, humedad_pct, compactacion, notas, created_at, fecha_analisis, lote_id, finca_id, fincas(nombre), lotes(codigo)"
    )
    .eq("is_voided", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (fincaId) {
    query = query.eq("finca_id", fincaId);
  }

  const { data } = await query;
  return (data ?? []) as AnalisisSueloListRow[];
}

async function getCatalogData(profileFincaId: string | null) {
  const supabase = await createClient();

  const fincasQuery = profileFincaId
    ? supabase.from("fincas").select("id, nombre").eq("id", profileFincaId)
    : supabase.from("fincas").select("id, nombre").order("nombre");

  const { data: fincas } = await fincasQuery;
  const fincasResult = fincas ?? [];

  const lotesPorFinca: Record<string, { id: string; codigo: string }[]> = {};

  if (fincasResult.length > 0) {
    const fincaIds = fincasResult.map((f) => f.id);
    const { data: lotes } = await supabase
      .from("lotes")
      .select("id, codigo, finca_id")
      .in("finca_id", fincaIds)
      .order("codigo");

    for (const lote of lotes ?? []) {
      if (!lotesPorFinca[lote.finca_id]) lotesPorFinca[lote.finca_id] = [];
      lotesPorFinca[lote.finca_id].push({ id: lote.id, codigo: lote.codigo });
    }
  }

  return { fincas: fincasResult, lotesPorFinca };
}

export default async function TecnicoSueloPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const [initialRows, { fincas, lotesPorFinca }] = await Promise.all([
    getAnalisis(fincaId),
    getCatalogData(fincaId),
  ]);

  return (
    <TecnicoSueloClient
      initialRows={initialRows}
      fincas={fincas}
      lotesPorFinca={lotesPorFinca}
    />
  );
}
