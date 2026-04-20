import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import { notFound } from "next/navigation";
import { FincaDetalleClient } from "./finca-detalle-client";

type Props = { params: Promise<{ fincaId: string }> };

async function getFincaConLotes(fincaId: string) {
  const supabase = await createClient();

  const { data: finca } = await supabase
    .from("fincas")
    .select("id, nombre, ubicacion, area_ha, propietario, created_at")
    .eq("id", fincaId)
    .maybeSingle();

  if (!finca) return null;

  const { data: lotes } = await supabase
    .from("lotes")
    .select(
      "id, codigo, area_ha, anio_siembra, material_genetico, densidad_palmas_ha, pendiente_pct, created_at"
    )
    .eq("finca_id", fincaId)
    .order("codigo", { ascending: true });

  return { finca, lotes: lotes ?? [] };
}

export default async function FincaDetallePage({ params }: Props) {
  const { fincaId } = await params;
  const result = await getFincaConLotes(fincaId);
  const session = await getSessionProfile();

  if (!result) notFound();

  const canEditFinca = Boolean(session?.profile && isSuperAdmin(session.profile));

  return <FincaDetalleClient finca={result.finca} lotes={result.lotes} canEditFinca={canEditFinca} />;
}
