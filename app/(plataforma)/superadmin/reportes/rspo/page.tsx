import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExpedienteRspoClient } from "@/components/reportes/expediente-rspo-client";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SuperadminReporteRspoPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const supabase = await createClient();
  const { data: fincas } = await supabase
    .from("fincas")
    .select("id, nombre")
    .eq("is_active", true)
    .order("nombre");

  const list = fincas ?? [];
  const fincaParamRaw = sp.finca;
  const fincaParam =
    typeof fincaParamRaw === "string"
      ? fincaParamRaw
      : Array.isArray(fincaParamRaw)
        ? fincaParamRaw[0]
        : undefined;
  const fincaId =
    (fincaParam && list.some((f) => f.id === fincaParam) ? fincaParam : null) ??
    list[0]?.id ??
    "";

  if (!fincaId) {
    return (
      <div className="surface-panel rounded-2xl p-6 text-sm text-muted-foreground">
        No hay fincas activas.
      </div>
    );
  }

  if (fincaParam !== fincaId) {
    redirect(`/superadmin/reportes/rspo?finca=${fincaId}`);
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Expediente RSPO (global)
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Exportación de trazabilidad por lote y finca para cumplimiento RSPO.
        </p>
      </div>
      <ExpedienteRspoClient fincas={list} defaultFincaId={fincaId} showFincaSelector />
    </div>
  );
}
