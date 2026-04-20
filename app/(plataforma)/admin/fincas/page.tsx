import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import { FincasClient } from "./fincas-client";

async function getFincas() {
  const supabase = await createClient();
  const session = await getSessionProfile();

  let query = supabase
    .from("fincas")
    .select("id, nombre, ubicacion, area_ha, propietario, created_at")
    .order("nombre", { ascending: true });

  if (session?.profile && !isSuperAdmin(session.profile) && session.profile.finca_id) {
    query = query.eq("id", session.profile.finca_id);
  }

  const { data } = await query;
  return {
    fincas: data ?? [],
    canCreateFinca: Boolean(session?.profile && isSuperAdmin(session.profile)),
  };
}

export default async function AdminFincasPage() {
  const { fincas, canCreateFinca } = await getFincas();
  return <FincasClient fincas={fincas} canCreateFinca={canCreateFinca} />;
}
