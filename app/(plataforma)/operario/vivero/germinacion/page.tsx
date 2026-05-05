import { getSessionProfile } from "@/lib/auth/session-profile";
import { todayColombiaYmd } from "@/lib/date-colombia";
import {
  getCatalogoMaterialGenetico,
  getLotesPorFinca,
  getRegistrosGerminacionPorFinca,
} from "@/app/actions/queries";
import { OperarioGerminacionClient } from "@/components/operario/operario-germinacion-client";

export default async function OperarioViveroGerminacionPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;

  if (!fincaId) {
    return (
      <p className="surface-panel rounded-2xl p-5 text-sm text-muted-foreground">
        Sin finca asignada.
      </p>
    );
  }

  const [matRes, lotesRes, germRes] = await Promise.all([
    getCatalogoMaterialGenetico(),
    getLotesPorFinca(fincaId, { soloActivos: true }),
    getRegistrosGerminacionPorFinca(fincaId),
  ]);

  const materiales = matRes.success ? matRes.data : [];
  const lotes = lotesRes.success ? lotesRes.data : [];
  const germinaciones = germRes.success ? germRes.data : [];

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Germinación / tratamiento térmico
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registro previo a la evaluación de vivero. Operario o técnico pueden crear registros según
          política de la finca.
        </p>
      </div>
      <OperarioGerminacionClient
        fincaId={fincaId}
        defaultFecha={todayColombiaYmd()}
        materiales={materiales}
        lotes={lotes}
        initialRows={germinaciones}
      />
    </div>
  );
}
