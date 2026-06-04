import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import Link from "next/link";
import { Bug, Calendar, ClipboardList, MapPinned, Package, Tractor, Wheat } from "lucide-react";

async function getOperarioStats(userId: string, fincaId: string | null) {
  const supabase = await createClient();

  const baseLabores = supabase
    .from("labores_agronomicas")
    .select("id", { count: "exact", head: true })
    .eq("is_voided", false)
    .is("cantidad_ejecutada", null)
    .not("catalogo_item_id", "is", null);

  const baseCosechas = supabase
    .from("cosechas_rff")
    .select("id", { count: "exact", head: true })
    .eq("is_voided", false);

  const baseMonitoreos = supabase
    .from("monitoreos_fitosanitarios_programados")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to", userId)
    .eq("estado", "pendiente")
    .eq("is_voided", false);

  let laboresQuery = fincaId ? baseLabores.eq("finca_id", fincaId) : baseLabores;
  if (fincaId && userId) {
    laboresQuery = laboresQuery.or(`assigned_to.is.null,assigned_to.eq.${userId}`);
  }

  const [{ count: labores }, { count: cosechas }, { count: monitoreos }] = await Promise.all([
    laboresQuery,
    fincaId ? baseCosechas.eq("finca_id", fincaId) : baseCosechas,
    baseMonitoreos,
  ]);

  return {
    labores: labores ?? 0,
    cosechas: cosechas ?? 0,
    monitoreos: monitoreos ?? 0,
  };
}

export default async function OperarioDashboardPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const userId = session?.user?.id ?? "";
  const stats = await getOperarioStats(userId, fincaId);

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Panel operativo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registro de labores, cosecha y tareas de sanidad asignadas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/operario/labores"
          className="surface-panel group rounded-2xl p-5 ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:ring-primary/30"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Tractor className="size-5" />
            </div>
            <p className="font-semibold text-foreground">Labores</p>
          </div>
          <p className="text-3xl font-semibold text-foreground">{stats.labores}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">labores registradas</p>
        </Link>

        <Link
          href="/operario/cosecha"
          className="surface-panel group rounded-2xl p-5 ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:ring-primary/30"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Wheat className="size-5" />
            </div>
            <p className="font-semibold text-foreground">Cosechas</p>
          </div>
          <p className="text-3xl font-semibold text-foreground">{stats.cosechas}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">registros RFF</p>
        </Link>

        <Link
          href="/operario/sanidad/monitoreos-pendientes"
          className="surface-panel group rounded-2xl p-5 ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:ring-primary/30"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Calendar className="size-5" />
            </div>
            <p className="font-semibold text-foreground">Monitoreos pendientes</p>
          </div>
          <p className="text-3xl font-semibold text-foreground">{stats.monitoreos}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">inspecciones asignadas</p>
        </Link>

        <Link
          href="/operario/sanidad/alertas"
          className="surface-panel group rounded-2xl p-5 ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:ring-primary/30"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Bug className="size-5" />
            </div>
            <p className="font-semibold text-foreground">Sanidad</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Alertas y órdenes de control fitosanitarias.
          </p>
        </Link>

        <Link
          href="/operario/catalogos/insumos"
          className="surface-panel group rounded-2xl p-5 ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:ring-primary/30"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Package className="size-5" />
            </div>
            <p className="font-semibold text-foreground">Catálogos</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Insumos, material genético y fitosanitario (consulta).
          </p>
        </Link>

        <Link
          href="/operario/mi-finca"
          className="surface-panel group rounded-2xl p-5 ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:ring-primary/30"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <MapPinned className="size-5" />
            </div>
            <p className="font-semibold text-foreground">Mi finca</p>
          </div>
          <p className="text-sm text-muted-foreground">Finca asignada y lotes.</p>
        </Link>

        <Link
          href="/operario/sanidad/aplicaciones"
          className="surface-panel group rounded-2xl p-5 ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:ring-primary/30"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <ClipboardList className="size-5" />
            </div>
            <p className="font-semibold text-foreground">Aplicaciones</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Registrar aplicación con EPP (órdenes autorizadas).
          </p>
        </Link>
      </div>
    </div>
  );
}
