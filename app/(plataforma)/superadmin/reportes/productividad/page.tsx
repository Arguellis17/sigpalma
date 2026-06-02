import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReporteProductividadClient } from "@/components/reportes/reporte-productividad-client";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SuperadminReporteProductividadPage({
  searchParams,
}: Props) {
  const sp = (await searchParams) ?? {};
  const supabase = await createClient();
  const { data: fincas } = await supabase
    .from("fincas")
    .select("id, nombre")
    .eq("is_active", true)
    .order("nombre", { ascending: true });

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
        No hay fincas activas. Cree una finca antes de consultar productividad.
      </div>
    );
  }

  if (fincaParam !== fincaId) {
    redirect(`/superadmin/reportes/productividad?finca=${fincaId}`);
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Productividad RFF (global)
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Reporte de rendimiento por finca y periodo. Seleccione la finca a analizar.
        </p>
      </div>
      <ReporteProductividadClient
        fincas={list}
        defaultFincaId={fincaId}
        showFincaSelector
      />
    </div>
  );
}
