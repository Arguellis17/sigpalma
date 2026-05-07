import { getLotesPorFinca } from "@/app/actions/queries";
import { getTrazabilidadTecnicaLote } from "@/app/actions/trazabilidad-lote";
import { TrazabilidadLoteClient } from "@/components/tecnico/trazabilidad-lote-client";
import { getSessionProfile } from "@/lib/auth/session-profile";

export default async function TecnicoTrazabilidadPage({
  searchParams,
}: {
  searchParams: Promise<{ lote?: string }>;
}) {
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

  const lotesRes = await getLotesPorFinca(fincaId);
  if (!lotesRes.success) {
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{lotesRes.error}</p>
      </div>
    );
  }

  const lotes = lotesRes.data;
  const sp = await searchParams;
  const requested = typeof sp.lote === "string" ? sp.lote.trim() : "";
  const defaultLoteId =
    requested && lotes.some((l) => l.id === requested) ? requested : (lotes[0]?.id ?? null);

  let initialData = null;
  let initialError: string | null = null;
  if (defaultLoteId) {
    const tr = await getTrazabilidadTecnicaLote(defaultLoteId);
    if (tr.success) {
      initialData = tr.data;
    } else {
      initialError = tr.error;
    }
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Trazabilidad técnica por lote
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          HU17 — Línea de tiempo cronológica (más reciente primero) con material de siembra, labores,
          programación de nutrición y riego, sanidad y cosecha. Solo consulta.
        </p>
      </div>
      <TrazabilidadLoteClient
        lotes={lotes}
        initialLoteId={defaultLoteId}
        initialData={initialData}
        initialError={initialError}
      />
    </div>
  );
}
