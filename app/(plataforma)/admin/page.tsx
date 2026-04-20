import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { MapPinned, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getAdminStats(fincaId: string | null) {
  const supabase = await createClient();

  const [{ count: usuarios }, { count: fincas }, { count: lotes }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .neq("role", "superadmin"),
    fincaId
      ? supabase.from("fincas").select("id", { count: "exact", head: true }).eq("id", fincaId)
      : supabase.from("fincas").select("id", { count: "exact", head: true }),
    fincaId
      ? supabase.from("lotes").select("id", { count: "exact", head: true }).eq("finca_id", fincaId)
      : supabase.from("lotes").select("id", { count: "exact", head: true }),
  ]);

  return {
    usuarios: usuarios ?? 0,
    fincas: fincas ?? 0,
    lotes: lotes ?? 0,
  };
}

export default async function AdminDashboardPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const stats = await getAdminStats(fincaId);

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Panel de administración
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestiona usuarios, fincas y catálogos del sistema.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="surface-panel border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{stats.usuarios}</p>
          </CardContent>
        </Card>
        <Card className="surface-panel border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fincas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{stats.fincas}</p>
          </CardContent>
        </Card>
        <Card className="surface-panel border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lotes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{stats.lotes}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/admin/usuarios" className="surface-panel group rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Users className="size-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Usuarios</p>
              <p className="text-sm text-muted-foreground">Crear, editar e inactivar cuentas.</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/fincas" className="surface-panel group rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <MapPinned className="size-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Fincas</p>
              <p className="text-sm text-muted-foreground">Registrar y editar fincas y lotes.</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
