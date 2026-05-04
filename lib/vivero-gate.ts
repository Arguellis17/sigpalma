import type { createClient } from "@/lib/supabase/server";
import { actionError, actionOk, type ActionResult } from "@/app/actions/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * RF20 / HU10: exige cadena RF18 + evaluación HU14 con concepto Apto para el mismo material en la finca.
 */
export async function assertCadenaViveroAptoParaPlanSiembra(
  supabase: Supabase,
  fincaId: string,
  catalogoMaterialId: string
): Promise<ActionResult<void>> {
  const { data: germs, error: ge } = await supabase
    .from("registros_germinacion")
    .select("id")
    .eq("finca_id", fincaId)
    .eq("catalogo_material_id", catalogoMaterialId)
    .eq("is_voided", false);

  if (ge) return actionError(ge.message);
  const ids = (germs ?? []).map((g) => g.id);
  if (ids.length === 0) {
    return actionError(
      "Debe existir un registro de germinación / tratamiento térmico (RF18) para este material en la finca antes de planificar la siembra."
    );
  }

  const { data: ev, error: ee } = await supabase
    .from("evaluaciones_vivero")
    .select("id")
    .in("germinacion_id", ids)
    .eq("concepto", "apto_trasplante")
    .eq("is_voided", false)
    .limit(1)
    .maybeSingle();

  if (ee) return actionError(ee.message);
  if (!ev) {
    return actionError(
      "Debe existir una evaluación de vivero (HU14 / RF14) con concepto «Apto para trasplante» para este material, vinculada a la germinación registrada."
    );
  }

  return actionOk(undefined);
}
