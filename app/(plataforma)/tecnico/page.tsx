import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function TecnicoDashboardPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;

  const supabase = await createClient();

  let countQuery = supabase
    .from("analisis_suelo")
    .select("id", { count: "exact", head: true })
    .eq("is_voided", false);

  if (fincaId) {
    countQuery = countQuery.eq("finca_id", fincaId);
  }

  const { count: totalAnalisis } = await countQuery;

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Panel técnico
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Seguimiento técnico del cultivo y análisis de suelo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/tecnico/suelo"
          className="surface-panel group rounded-2xl p-5 ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:ring-primary/30"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Layers className="size-5" />
            </div>
            <p className="font-semibold text-foreground">Análisis de suelo</p>
          </div>
          <p className="text-3xl font-semibold text-foreground">{totalAnalisis ?? 0}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">registros activos</p>
        </Link>
      </div>
    </div>
  );
}
