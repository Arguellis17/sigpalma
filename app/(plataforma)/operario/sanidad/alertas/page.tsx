import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { getCatalogoFitosanidad } from "@/app/actions/queries";
import { AlertaForm } from "@/components/campo/alerta-form";

export default async function OperarioSanidadAlertasPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const supabase = await createClient();

  const catalogoRes = await getCatalogoFitosanidad();
  const catalogo = catalogoRes.success ? catalogoRes.data : [];

  let fincas: { id: string; nombre: string }[] = [];
  if (fincaId) {
    const { data: fincaRow } = await supabase
      .from("fincas")
      .select("id, nombre")
      .eq("id", fincaId)
      .maybeSingle();
    if (fincaRow) fincas = [fincaRow];
  }
  const { data: alertasRaw } = fincaId
    ? await supabase
        .from("alertas_fitosanitarias")
        .select(
          "id, created_at, severidad, descripcion, validacion_estado, validacion_diagnostico, lote_id, catalogo_item_id"
        )
        .eq("finca_id", fincaId)
        .eq("is_voided", false)
        .order("created_at", { ascending: false })
        .limit(25)
    : { data: [] };

  const ar = alertasRaw ?? [];
  const loteIds = [...new Set(ar.map((a) => a.lote_id))];
  const catIds = [
    ...new Set(
      ar.map((a) => a.catalogo_item_id).filter((x): x is string => Boolean(x))
    ),
  ];

  const [{ data: lotesRows }, { data: catRows }] = await Promise.all([
    loteIds.length
      ? supabase.from("lotes").select("id, codigo").in("id", loteIds)
      : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
    catIds.length
      ? supabase.from("catalogo_items").select("id, nombre").in("id", catIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ]);

  const loteMap = new Map((lotesRows ?? []).map((l) => [l.id, l.codigo]));
  const catMap = new Map((catRows ?? []).map((c) => [c.id, c.nombre]));

  const rows = ar.map((a) => ({
    id: a.id,
    created_at: a.created_at,
    severidad: a.severidad,
    descripcion: a.descripcion,
    validacion_estado: a.validacion_estado,
    validacion_diagnostico: a.validacion_diagnostico,
    lote_codigo: loteMap.get(a.lote_id) ?? "—",
    amenaza: a.catalogo_item_id ? catMap.get(a.catalogo_item_id) ?? null : null,
  }));

  return (
    <div className="fade-up-enter space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Alertas fitosanitarias
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre hallazgos en campo; el técnico los validará (RF15) y podrá emitir
          una orden de aplicación.
        </p>
      </div>

      <AlertaForm
        fincas={fincas}
        defaultFincaId={fincaId}
        catalogo={catalogo}
      />

      <div>
        <h3 className="mb-3 text-lg font-semibold text-foreground">
          Registros recientes
        </h3>
        {rows.length === 0 ? (
          <p className="surface-panel rounded-2xl p-4 text-sm text-muted-foreground">
            Aún no hay alertas en su finca.
          </p>
        ) : (
          <div className="surface-panel overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Lote</th>
                    <th className="px-4 py-3">Amenaza</th>
                    <th className="px-4 py-3">Severidad</th>
                    <th className="px-4 py-3">Validación</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`border-b border-border/40 last:border-0 ${
                        i % 2 !== 0 ? "bg-muted/15" : ""
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("es-CO", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {r.lote_codigo}
                      </td>
                      <td className="px-4 py-3">
                        {r.amenaza ?? "—"}
                      </td>
                      <td className="px-4 py-3 capitalize">{r.severidad}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {r.validacion_estado ?? "pendiente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
