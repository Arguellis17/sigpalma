import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import { redirect } from "next/navigation";
import { SuperadminFincasClient } from "./fincas-client";

async function getData() {
  const supabase = await createClient();
  const session = await getSessionProfile();

  if (!session?.profile || !isSuperAdmin(session.profile)) {
    redirect("/superadmin");
  }

  const { data: fincas } = await supabase
    .from("fincas")
    .select("id, nombre, ubicacion, area_ha, propietario, is_active, created_at")
    .order("nombre");

  return { fincas: fincas ?? [] };
}

export default async function SuperadminFincasPage() {
  const { fincas } = await getData();
  return <SuperadminFincasClient fincas={fincas} />;
}
