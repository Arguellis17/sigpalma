import { createClient } from "@/lib/supabase/server";
import {
  getSessionProfile,
  canRecordCampoOperations,
} from "@/lib/auth/session-profile";
import { getCatalogoFitosanidad } from "@/app/actions/queries";

export async function loadCampoContext() {
  const session = await getSessionProfile();
  const supabase = await createClient();
  const { data: fincas } = await supabase
    .from("fincas")
    .select("id, nombre")
    .order("nombre");

  return {
    session,
    fincas: fincas ?? [],
    defaultFincaId: session?.profile?.finca_id ?? null,
    canRecord: canRecordCampoOperations(session?.profile ?? null),
  };
}

export async function loadAlertaCatalogo() {
  return getCatalogoFitosanidad();
}
