import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuditoriaFincaClient } from "@/components/admin/auditoria-finca-client";
import { listarEventosAuditoriaFinca } from "@/app/actions/audit";
import {
  auditoriaListToQueryString,
  auditoriaQueriesEqual,
  parseAuditoriaListQuery,
} from "@/lib/audit/audit-list-query";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SuperadminAuditoriaPage({ searchParams }: Props) {
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
        No hay fincas activas. Cree una finca antes de consultar la auditoría.
      </div>
    );
  }

  const listQuery = parseAuditoriaListQuery(sp);

  const res = await listarEventosAuditoriaFinca(fincaId, listQuery);
  if (!res.success) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {res.error}
      </div>
    );
  }

  const { rows, total, query: effective } = res.data;
  if (!auditoriaQueriesEqual(effective, listQuery)) {
    redirect(
      `/superadmin/auditoria?${auditoriaListToQueryString(effective, { fincaId })}`
    );
  }

  return (
    <AuditoriaFincaClient
      rows={rows}
      total={total}
      query={effective}
      fincaId={fincaId}
      fincas={list.map((f) => ({ id: f.id, nombre: f.nombre }))}
    />
  );
}
