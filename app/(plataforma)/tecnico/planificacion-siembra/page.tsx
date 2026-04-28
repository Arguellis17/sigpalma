import {
  getCatalogoMaterialGenetico,
  getLotesPlanificables,
  getPlanesSiembraPorFinca,
} from "@/app/actions/queries";
import { PlanSiembraClient } from "@/components/tecnico/plan-siembra-client";
import { getSessionProfile } from "@/lib/auth/session-profile";

export default async function PlanificacionSiembraPage() {
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

  const [catalogo, lotes, planes] = await Promise.all([
    getCatalogoMaterialGenetico(),
    getLotesPlanificables(fincaId),
    getPlanesSiembraPorFinca(fincaId),
  ]);

  if (!catalogo.success) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{catalogo.error}</p>
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
          Planificación de siembra
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          HU10 · RF10: asigne material genético certificado y fecha proyectada a lotes vacantes o
          disponibles. Pendiente &gt; 12% requiere confirmación explícita (RN28). Distinto de la{" "}
          <span className="text-foreground">agenda de labores</span> (mantenimiento).
        </p>
      </div>
      <PlanSiembraClient
        fincaId={fincaId}
        catalogoMaterial={catalogo.data}
        lotesPlanificables={lotes.data}
        planesIniciales={planes.data}
      />
    </div>
  );
}
