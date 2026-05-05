import {
  getInsumosNutricionActivos,
  getLotesPorFinca,
  getPlanesNutricionPorFinca,
} from "@/app/actions/queries";
import { PlanNutricionClient } from "@/components/tecnico/plan-nutricion-client";
import { getSessionProfile } from "@/lib/auth/session-profile";

export default async function NutricionRiegoPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;

  if (!fincaId) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-muted-foreground">
          No tiene una finca asignada. Solicite la asignación a un administrador.
        </p>
      </div>
    );
  }

  const [insumos, lotes, planes] = await Promise.all([
    getInsumosNutricionActivos(),
    getLotesPorFinca(fincaId, { soloActivos: true }),
    getPlanesNutricionPorFinca(fincaId),
  ]);

  if (!insumos.success) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{insumos.error}</p>
      </div>
    );
  }
  if (!lotes.success) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{lotes.error}</p>
      </div>
    );
  }
  if (!planes.success) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{planes.error}</p>
      </div>
    );
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Nutrición y riego
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Calendarios de fertilización (insumos de nutrición) y ciclos de riego por lote, con dosis
          por ha o por palma. Consulte análisis de suelo antes de definir el plan.
        </p>
      </div>
      <PlanNutricionClient
        fincaId={fincaId}
        insumosNutricion={insumos.data}
        lotesActivos={lotes.data}
        planesIniciales={planes.data}
      />
    </div>
  );
}
