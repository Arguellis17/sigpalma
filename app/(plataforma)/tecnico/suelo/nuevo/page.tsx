import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { AnalisisSueloForm } from "./analisis-suelo-form";

async function getData(profileFincaId: string | null) {
  const supabase = await createClient();

  const fincasQuery = profileFincaId
    ? supabase.from("fincas").select("id, nombre").eq("id", profileFincaId)
    : supabase.from("fincas").select("id, nombre").order("nombre");

  const { data: fincas } = await fincasQuery;

  const fincasResult = fincas ?? [];

  // Fetch lotes for all fincas
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

export default async function NuevoAnalisisSueloPage() {
  const session = await getSessionProfile();
  const { fincas, lotesPorFinca } = await getData(session?.profile?.finca_id ?? null);

  return (
    <div className="fade-up-enter">
      <AnalisisSueloForm fincas={fincas} lotesPorFinca={lotesPorFinca} />
    </div>
  );
}
