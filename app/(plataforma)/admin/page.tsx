import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { FlaskConical, MapPinned, Package, Sprout, Users } from "lucide-react";

async function getAdminStats(fincaId: string | null) {
  const supabase = await createClient();

  const [{ count: usuarios }, { count: fincas }, { count: lotes }, { count: catalogos }] =
    await Promise.all([
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
      supabase
        .from("catalogo_items")
        .select("id", { count: "exact", head: true })
        .eq("activo", true),
    ]);

  return {
    usuarios: usuarios ?? 0,
    fincas: fincas ?? 0,
    lotes: lotes ?? 0,
    catalogos: catalogos ?? 0,
  };
}

export default async function AdminDashboardPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const stats = await getAdminStats(fincaId);

  const statCards = [
    { label: "Usuarios", value: stats.usuarios, href: "/admin/usuarios" },
    { label: "Fincas", value: stats.fincas, href: "/admin/fincas" },
    { label: "Lotes", value: stats.lotes, href: "/admin/fincas" },
    { label: "Ítems de catálogo", value: stats.catalogos, href: "/admin/catalogos/insumos" },
  ];

  const quickLinks = [
    {
      href: "/admin/usuarios",
      icon: Users,
      title: "Usuarios",
      description: "Crear, editar e inactivar cuentas.",
    },
    {
      href: "/admin/fincas",
      icon: MapPinned,
      title: "Fincas",
      description: "Registrar y editar fincas y lotes.",
    },
    {
      href: "/admin/catalogos/insumos",
      icon: Package,
      title: "Insumos",
      description: "Fertilizantes, herbicidas y otros insumos.",
    },
    {
      href: "/admin/catalogos/material-genetico",
      icon: Sprout,
      title: "Material genético",
      description: "Variedades y semillas de palma.",
    },
    {
      href: "/admin/catalogos/fitosanitario",
      icon: FlaskConical,
      title: "Fitosanitario",
      description: "Plagas, enfermedades y agroquímicos.",
    },
  ];

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Panel de administración
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestiona usuarios, fincas y catálogos del sistema.
        </p>
      </div>

      {/* Stat cards — clickable */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="surface-panel group flex flex-col rounded-2xl p-4 transition-transform hover:-translate-y-0.5 sm:p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s.label}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
              {s.value}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Accesos rápidos
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="surface-panel group flex items-center gap-3 rounded-2xl p-4 transition-transform hover:-translate-y-0.5 sm:p-5"
              >
                <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{link.title}</p>
                  <p className="truncate text-sm text-muted-foreground">{link.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

