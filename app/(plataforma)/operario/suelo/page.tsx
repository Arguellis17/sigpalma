import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { Button } from "@/components/ui/button";

export default async function OperarioSueloConsultaPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const supabase = await createClient();

  if (!fincaId) {
    return (
      <p className="surface-panel rounded-2xl p-5 text-sm text-muted-foreground">
        Sin finca asignada.
      </p>
    );
  }

  const { data: rowsRaw } = await supabase
    .from("analisis_suelo")
    .select(
      "id, lote_id, fecha_analisis, ph, humedad_pct, compactacion, notas, archivo_url"
    )
    .eq("finca_id", fincaId)
    .eq("is_voided", false)
    .order("fecha_analisis", { ascending: false })
    .limit(40);

  const rawList = rowsRaw ?? [];
  const loteIds = [...new Set(rawList.map((r) => r.lote_id))];
  const { data: lotesRows } = loteIds.length
    ? await supabase.from("lotes").select("id, codigo").in("id", loteIds)
    : { data: [] as { id: string; codigo: string }[] };

  const loteMap = new Map((lotesRows ?? []).map((l) => [l.id, l.codigo]));

  const list = rawList.map((r) => ({
    id: r.id,
    fecha_analisis: r.fecha_analisis,
    ph: r.ph,
    humedad_pct: r.humedad_pct,
    compactacion: r.compactacion,
    notas: r.notas,
    archivo_url: r.archivo_url,
    lote_codigo: loteMap.get(r.lote_id) ?? "—",
  }));

  return (
    <div className="fade-up-enter space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Análisis de suelo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Resultados de análisis de suelo registrados por el técnico de campo. Solo consulta.
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="surface-panel rounded-2xl p-6 text-sm text-muted-foreground">
          Aún no hay análisis de suelo para su finca.
        </p>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Lote</th>
                  <th className="px-4 py-3">pH</th>
                  <th className="px-4 py-3">Humedad %</th>
                  <th className="px-4 py-3">Archivo</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/40 last:border-0 ${
                      i % 2 !== 0 ? "bg-muted/15" : ""
                    }`}
                  >
                    <td className="px-4 py-3">{r.fecha_analisis}</td>
                    <td className="px-4 py-3 font-medium">
                      {r.lote_codigo}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.ph ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.humedad_pct ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.archivo_url ? (
                        <Button asChild variant="link" className="h-auto p-0 text-xs">
                          <a
                            href={r.archivo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ver PDF
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
