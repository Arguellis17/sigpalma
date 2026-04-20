import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrearAdminForm } from "./crear-admin-form";

async function listarAdmins() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const [{ data: profiles }, { data: authUsersData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, is_active, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: false }),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailMap = new Map(
    (authUsersData?.users ?? []).map((u) => [u.id, u.email ?? ""])
  );

  return (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? "",
  }));
}

async function listarFincas() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fincas")
    .select("id, nombre")
    .order("nombre", { ascending: true });

  return data ?? [];
}

export default async function AdministradoresPage() {
  const [admins, fincas] = await Promise.all([listarAdmins(), listarFincas()]);

  return (
    <div className="fade-up-enter space-y-6">
      <div className="surface-panel rounded-2xl p-5 sm:p-6">
        <h3 className="mb-4 font-semibold text-foreground">Nuevo administrador</h3>
        <div className="max-w-md">
          <CrearAdminForm fincas={fincas} />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Administradores registrados ({admins.length})
        </h3>
        {admins.length === 0 ? (
          <div className="surface-panel rounded-2xl py-12 text-center text-sm text-muted-foreground">
            Aún no hay administradores. Crea el primero arriba.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {admins.map((admin) => (
              <Card key={admin.id} className="surface-panel border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold text-foreground">
                      {admin.full_name ?? "Sin nombre"}
                    </CardTitle>
                    <Badge
                      variant={admin.is_active ? "outline" : "destructive"}
                      className="shrink-0"
                    >
                      {admin.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{admin.email}</p>
                  {admin.created_at ? (
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Creado:{" "}
                      {new Date(admin.created_at).toLocaleDateString("es-CO", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
