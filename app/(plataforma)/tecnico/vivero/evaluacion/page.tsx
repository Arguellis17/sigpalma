import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  getEvaluacionesViveroPorFinca,
  getGerminacionesSinEvaluacionActiva,
} from "@/app/actions/queries";
import { TecnicoEvaluacionViveroClient } from "@/components/tecnico/tecnico-evaluacion-vivero-client";

export default async function TecnicoViveroEvaluacionPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;

  if (!fincaId) {
    return (
      <p className="surface-panel rounded-2xl p-5 text-sm text-muted-foreground">
        Sin finca asignada.
      </p>
    );
  }

  const [sinEvalRes, histRes] = await Promise.all([
    getGerminacionesSinEvaluacionActiva(fincaId),
    getEvaluacionesViveroPorFinca(fincaId),
  ]);

  const germinacionesDisponibles = sinEvalRes.success ? sinEvalRes.data : [];
  const historial = histRes.success ? histRes.data : [];

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Evaluación de vivero
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          HU14 / RF14: conteos, concepto Apto / No apto, evidencia opcional (CU14.1). Requiere
          germinación RF18 previa. La planificación de siembra exige cadena completa (RF20 parcial).
        </p>
      </div>
      <TecnicoEvaluacionViveroClient
        fincaId={fincaId}
        germinacionesDisponibles={germinacionesDisponibles}
        historial={historial}
      />
    </div>
  );
}
