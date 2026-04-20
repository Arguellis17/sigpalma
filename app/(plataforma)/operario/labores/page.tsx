import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { LaborForm } from "@/components/campo/labor-form";

async function getFincas(fincaId: string | null) {
  const supabase = await createClient();
  const query = fincaId
    ? supabase.from("fincas").select("id, nombre").eq("id", fincaId)
    : supabase.from("fincas").select("id, nombre").order("nombre");
  const { data } = await query;
  return data ?? [];
}

export default async function OperarioLaboresPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const fincas = await getFincas(fincaId);

  return (
    <div className="fade-up-enter">
      <LaborForm fincas={fincas} defaultFincaId={fincaId} />
    </div>
  );
}
