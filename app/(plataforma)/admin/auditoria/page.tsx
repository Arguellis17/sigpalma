import { redirect } from "next/navigation";
import { AuditoriaFincaClient } from "@/components/admin/auditoria-finca-client";
import { listarEventosAuditoriaFinca } from "@/app/actions/audit";
import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  auditoriaListToQueryString,
  auditoriaQueriesEqual,
  parseAuditoriaListQuery,
} from "@/lib/audit/audit-list-query";

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  if (!fincaId) {
    redirect("/admin");
  }

  const sp = (await searchParams) ?? {};
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
    redirect(`/admin/auditoria?${auditoriaListToQueryString(effective)}`);
  }

  return (
    <AuditoriaFincaClient rows={rows} total={total} query={effective} fincaId={fincaId} />
  );
}
