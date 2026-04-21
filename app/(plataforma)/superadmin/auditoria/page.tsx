import { createClient } from "@/lib/supabase/server";
import { AuditoriaFincaClient } from "@/components/admin/auditoria-finca-client";
import { listarEventosAuditoriaFinca } from "@/app/actions/audit";

type Props = {
  searchParams?: Promise<{ finca?: string }>;
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
  const fincaId =
    (sp.finca && list.some((f) => f.id === sp.finca) ? sp.finca : null) ??
    list[0]?.id ??
    "";

  if (!fincaId) {
    return (
      <div className="surface-panel rounded-2xl p-6 text-sm text-muted-foreground">
        No hay fincas activas. Cree una finca antes de consultar la auditoría.
      </div>
    );
  }

  const res = await listarEventosAuditoriaFinca(fincaId);
  if (!res.success) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {res.error}
      </div>
    );
  }

  return (
    <AuditoriaFincaClient
      initialEvents={res.data}
      initialFincaId={fincaId}
      fincas={list.map((f) => ({ id: f.id, nombre: f.nombre }))}
    />
  );
}
