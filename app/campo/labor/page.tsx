import { loadCampoContext } from "@/lib/campo/page-data";
import { CampoLocked } from "@/components/campo/campo-locked";
import { LaborForm } from "@/components/campo/labor-form";

export const metadata = {
  title: "Registrar labor | SIG-Palma",
};

export default async function CampoLaborPage() {
  const ctx = await loadCampoContext();
  const profile = ctx.session?.profile ?? null;

  return (
    <div className="flex flex-col gap-4">
      <section className="surface-panel fade-up-enter rounded-[2rem] p-5 sm:p-6">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Campo / labor
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Registrar labor agronómica
        </h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          Documenta actividades ejecutadas en lote para mantener la trazabilidad técnica
          actualizada y lista para consulta posterior.
        </p>
      </section>
      {!ctx.canRecord ? (
        <CampoLocked profile={profile} />
      ) : (
        <LaborForm
          fincas={ctx.fincas}
          defaultFincaId={ctx.defaultFincaId}
        />
      )}
    </div>
  );
}
