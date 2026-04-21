import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { getCatalogoFitosanidad } from "@/app/actions/queries";
import { AlertasOperarioClient } from "@/components/operario/alertas-operario-client";

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
        .limit(100)
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
      ? supabase
          .from("catalogo_items")
          .select("id, nombre, categoria")
          .in("id", catIds)
      : Promise.resolve(
          { data: [] as { id: string; nombre: string; categoria: string }[] }
        ),
  ]);

  const loteMap = new Map((lotesRows ?? []).map((l) => [l.id, l.codigo]));
  const catMap = new Map(
    (catRows ?? []).map((c) => [c.id, { nombre: c.nombre, categoria: c.categoria }])
  );

  const initialRows = ar.map((a) => {
    const cat = a.catalogo_item_id ? catMap.get(a.catalogo_item_id) : undefined;
    return {
      id: a.id,
      created_at: a.created_at,
      severidad: a.severidad,
      descripcion: a.descripcion,
      validacion_estado: a.validacion_estado,
      validacion_diagnostico: a.validacion_diagnostico,
      lote_codigo: loteMap.get(a.lote_id) ?? "—",
      amenaza: cat?.nombre ?? null,
      amenaza_categoria: cat?.categoria ?? null,
    };
  });

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Alertas fitosanitarias
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre hallazgos en campo; el técnico validará el caso y, de ser necesario, emitirá una
          orden de aplicación.
        </p>
      </div>
      <AlertasOperarioClient
        initialRows={initialRows}
        fincas={fincas}
        defaultFincaId={fincaId}
        catalogo={catalogo}
      />
    </div>
  );
}
