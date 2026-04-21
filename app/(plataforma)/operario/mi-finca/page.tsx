import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";

export default async function OperarioMiFincaPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const supabase = await createClient();

  if (!fincaId) {
    return (
      <p className="surface-panel rounded-2xl p-5 text-sm text-muted-foreground">
        No tiene una finca asignada en el sistema. Solicite la asignación al administrador de su
        organización.
      </p>
    );
  }

  const { data: finca } = await supabase
    .from("fincas")
    .select("id, nombre, ubicacion, area_ha")
    .eq("id", fincaId)
    .maybeSingle();

  const { data: lotes } = await supabase
    .from("lotes")
    .select("id, codigo, area_ha, pendiente_pct, anio_siembra")
    .eq("finca_id", fincaId)
    .order("codigo");

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Mi finca y lotes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vista de solo lectura de la unidad productiva asignada y de sus lotes.
        </p>
      </div>

      {finca ? (
        <div className="surface-panel rounded-2xl p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-foreground">{finca.nombre}</h3>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Ubicación</dt>
              <dd>{finca.ubicacion ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Área total (ha)</dt>
              <dd>{finca.area_ha}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="surface-panel overflow-hidden rounded-2xl">
        <div className="border-b border-border/60 px-4 py-3">
          <h3 className="font-semibold text-foreground">Lotes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Área (ha)</th>
                <th className="px-4 py-3">Pendiente %</th>
                <th className="px-4 py-3">Año siembra</th>
              </tr>
            </thead>
            <tbody>
              {(lotes ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-muted-foreground"
                  >
                    Sin lotes registrados.
                  </td>
                </tr>
              ) : (
                lotes!.map((l, i) => (
                  <tr
                    key={l.id}
                    className={`border-b border-border/40 last:border-0 ${
                      i % 2 !== 0 ? "bg-muted/15" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">{l.codigo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.area_ha}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.pendiente_pct ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.anio_siembra}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
