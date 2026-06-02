import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  getCatalogoEnfermedades,
  getCatalogoFitosanidad,
  getCatalogoPlagas,
  getAlertasFitosanitariasOperario,
} from "@/app/actions/queries";
import { AlertasOperarioClient } from "@/components/operario/alertas-operario-client";

export default async function OperarioSanidadAlertasPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;

  const [catalogoRes, catalogoPlagasRes, catalogoEnfermedadesRes, alertasRes] =
    await Promise.all([
      getCatalogoFitosanidad(),
      getCatalogoPlagas(),
      getCatalogoEnfermedades(),
      getAlertasFitosanitariasOperario(fincaId),
    ]);

  const catalogo = catalogoRes.success ? catalogoRes.data : [];
  const catalogoPlagas = catalogoPlagasRes.success ? catalogoPlagasRes.data : [];
  const catalogoEnfermedades = catalogoEnfermedadesRes.success
    ? catalogoEnfermedadesRes.data
    : [];
  const initialRows = alertasRes.success ? alertasRes.data : [];

  let fincas: { id: string; nombre: string }[] = [];
  if (fincaId) {
    const supabase = await createClient();
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
          Alertas fitosanitarias
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reporte de plagas y enfermedades con evidencia fotográfica; el técnico validará el caso y,
          de ser necesario, emitirá una orden de aplicación.
        </p>
      </div>
      <AlertasOperarioClient
        initialRows={initialRows}
        fincas={fincas}
        defaultFincaId={fincaId}
        catalogo={catalogo}
        catalogoPlagas={catalogoPlagas}
        catalogoEnfermedades={catalogoEnfermedades}
      />
    </div>
  );
}
