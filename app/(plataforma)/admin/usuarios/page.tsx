import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsuariosClient } from "./usuarios-client";

async function getData() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const [{ data: fincas }, { data: profiles }, { data: authUsersData }] =
    await Promise.all([
      supabase.from("fincas").select("id, nombre").order("nombre"),
      supabase
        .from("profiles")
        .select("id, full_name, role, is_active, finca_id, created_at, fincas(nombre)")
        .neq("role", "superadmin")
        .order("created_at", { ascending: false }),
      adminClient.auth.admin.listUsers({ perPage: 1000 }),
    ]);

  const emailMap = new Map(
    (authUsersData?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  const usuarios = (profiles ?? []).map((u) => ({
    id: u.id,
    email: emailMap.get(u.id) ?? "",
    full_name: u.full_name,
    role: u.role,
    is_active: u.is_active ?? false,
    finca_nombre: (u.fincas as { nombre?: string } | null)?.nombre ?? null,
    created_at: u.created_at,
  }));

  return { fincas: fincas ?? [], usuarios };
}

export default async function UsuariosPage() {
  const { fincas, usuarios } = await getData();
  return <UsuariosClient fincas={fincas} usuarios={usuarios} />;
}
