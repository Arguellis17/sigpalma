import { listarCronogramas } from "@/app/actions/cronogramas";
import { getCatalogoLabores, getLotesPorFinca, getOperariosFinca } from "@/app/actions/queries";
import { CronogramasLaboresClient } from "@/components/tecnico/cronogramas-labores-client";
import { getSessionProfile } from "@/lib/auth/session-profile";

function Aviso({ texto, error = false }: { texto: string; error?: boolean }) {
  return (
    <div className="fade-up-enter space-y-6">
      <p className={`surface-panel rounded-[1.5rem] p-4 text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>{texto}</p>
    </div>
  );
}

export default async function TecnicoCronogramasPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  if (!fincaId) return <Aviso texto="No tiene una finca asignada. Solicite la asignación a un administrador." />;

  const [cronogramas, lotes, labores, operarios] = await Promise.all([
    listarCronogramas(fincaId),
    getLotesPorFinca(fincaId, { soloActivos: true }),
    getCatalogoLabores(),
    getOperariosFinca(fincaId),
  ]);
  for (const r of [cronogramas, lotes, labores, operarios]) {
    if (!r.success) return <Aviso texto={r.error} error />;
  }
  if (!cronogramas.success || !lotes.success || !labores.success || !operarios.success) return null;

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Cronogramas de labores</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure labores repetitivas por lote: se programan solas en la agenda y en la bandeja del operario.
        </p>
      </div>
      <CronogramasLaboresClient
        fincaId={fincaId}
        cronogramas={cronogramas.data}
        lotes={lotes.data}
        labores={labores.data}
        operarios={operarios.data}
      />
    </div>
  );
}
