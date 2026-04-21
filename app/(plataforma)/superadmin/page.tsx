import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { MapPinned, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getSuperadminStats() {
  const supabase = await createClient();

  const [
    { count: totalUsuarios },
    { count: totalFincas },
    { count: fincasActivas },
    { count: admins },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).neq("role", "superadmin"),
    supabase.from("fincas").select("id", { count: "exact", head: true }),
    supabase.from("fincas").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin"),
  ]);

  return {
    totalUsuarios: totalUsuarios ?? 0,
    totalFincas: totalFincas ?? 0,
    fincasActivas: fincasActivas ?? 0,
    admins: admins ?? 0,
  };
}

const quickActions = [
  {
    href: "/superadmin/administradores",
    icon: ShieldCheck,
    label: "Administradores",
    description: "Gestiona las cuentas con acceso de administrador.",
    cta: "Gestionar",
  },
  {
    href: "/superadmin/usuarios",
    icon: Users,
    label: "Todos los usuarios",
    description: "Visualiza y gestiona todas las cuentas de la plataforma.",
    cta: "Gestionar",
  },
  {
    href: "/superadmin/fincas",
    icon: MapPinned,
    label: "Fincas",
    description: "Administra las fincas registradas en el sistema.",
    cta: "Gestionar",
  },
];

export default async function SuperadminDashboardPage() {
  const stats = await getSuperadminStats();

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Vista global del sistema
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Métricas consolidadas de toda la plataforma SIG-Palma.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="surface-panel border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Usuarios registrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{stats.totalUsuarios}</p>
          </CardContent>
        </Card>

        <Card className="surface-panel border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Administradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{stats.admins}</p>
          </CardContent>
        </Card>

        <Card className="surface-panel border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fincas activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{stats.fincasActivas}</p>
          </CardContent>
        </Card>

        <Card className="surface-panel border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fincas totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{stats.totalFincas}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Acciones rápidas
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <div key={action.href} className="surface-panel flex items-center gap-3 rounded-2xl border border-border/60 p-4">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                <action.icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground text-sm">{action.label}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{action.description}</p>
              </div>
              <Link
                href={action.href}
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {action.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
