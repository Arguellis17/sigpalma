import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function getSuperadminStats() {
  const supabase = await createClient();

  const [{ count: totalUsuarios }, { count: totalFincas }, { count: admins }] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("fincas").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin"),
    ]);

  return {
    totalUsuarios: totalUsuarios ?? 0,
    totalFincas: totalFincas ?? 0,
    admins: admins ?? 0,
  };
}

export default async function SuperadminDashboardPage() {
  const stats = await getSuperadminStats();

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Vista global del sistema
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Métricas consolidadas de toda la plataforma SIG-Palma.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="surface-panel border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Usuarios totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">
              {stats.totalUsuarios}
            </p>
          </CardContent>
        </Card>

        <Card className="surface-panel border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fincas registradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">
              {stats.totalFincas}
            </p>
          </CardContent>
        </Card>

        <Card className="surface-panel border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Administradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">
              {stats.admins}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="surface-panel rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Administradores del sistema</p>
            <p className="text-sm text-muted-foreground">
              Gestiona las cuentas con acceso de administrador.
            </p>
          </div>
          <Link
            href="/superadmin/administradores"
            className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Ver administradores
          </Link>
        </div>
      </div>
    </div>
  );
}
