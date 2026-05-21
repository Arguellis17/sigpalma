import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { listCensosSanitariosForFinca } from "@/app/actions/censo-sanitario";
import { getCatalogoFitosanidad } from "@/app/actions/queries";
import { CensosSanitariosClient } from "@/components/operario/censos-sanitarios-client";

export default async function OperarioCensosSanitariosPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const supabase = await createClient();

  const [catalogoRes, listResult] = await Promise.all([
    getCatalogoFitosanidad(),
    fincaId ? listCensosSanitariosForFinca(fincaId) : Promise.resolve({ success: true as const, data: [] }),
  ]);

  const catalogoAll = catalogoRes.success ? catalogoRes.data : [];
  const catalogo = catalogoAll.filter(
    (c) => c.categoria === "plaga" || c.categoria === "enfermedad"
  );
  const rows = listResult.success ? listResult.data : [];

  let fincas: { id: string; nombre: string }[] = [];
  if (fincaId) {
    const { data: fincaRow } = await supabase
      .from("fincas")
      .select("id, nombre")
      .eq("id", fincaId)
      .maybeSingle();
    if (fincaRow) fincas = [fincaRow];
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Censos sanitarios
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuantifique la incidencia de plagas o enfermedades por lote. El porcentaje se calcula
          automáticamente a partir de palmas inspeccionadas y afectadas.
        </p>
      </div>
      {!listResult.success && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {listResult.error}
        </p>
      )}
      <CensosSanitariosClient
        initialRows={rows}
        fincas={fincas}
        defaultFincaId={fincaId}
        catalogo={catalogo}
      />
    </div>
  );
}
