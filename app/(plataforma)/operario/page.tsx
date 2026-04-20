import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import Link from "next/link";
import { Tractor, Wheat } from "lucide-react";

async function getOperarioStats(fincaId: string | null) {
  const supabase = await createClient();

  const baseLabores = supabase
    .from("labores_agronomicas")
    .select("id", { count: "exact", head: true });

  const baseCosechas = supabase
    .from("cosechas")
    .select("id", { count: "exact", head: true });

  const [{ count: labores }, { count: cosechas }] = await Promise.all([
    fincaId ? baseLabores.eq("finca_id", fincaId) : baseLabores,
    fincaId ? baseCosechas.eq("finca_id", fincaId) : baseCosechas,
  ]);

  return { labores: labores ?? 0, cosechas: cosechas ?? 0 };
}

export default async function OperarioDashboardPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const stats = await getOperarioStats(fincaId);

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Panel operativo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registro de labores y cosecha del día.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <p className="mt-0.5 text-xs text-muted-foreground">registros de cosecha</p>
        </Link>
      </div>
    </div>
  );
}
