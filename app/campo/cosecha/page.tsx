import { loadCampoContext } from "@/lib/campo/page-data";
import { CampoLocked } from "@/components/campo/campo-locked";
import { CosechaForm } from "@/components/campo/cosecha-form";

export const metadata = {
  title: "Cosecha RFF | SIG-Palma",
};

export default async function CampoCosechaPage() {
  const ctx = await loadCampoContext();
  const profile = ctx.session?.profile ?? null;

  return (
    <div className="flex flex-col gap-4">
      <section className="surface-panel fade-up-enter rounded-[2rem] p-5 sm:p-6">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Campo / cosecha
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Registrar cosecha RFF
        </h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          Captura peso, racimos y señales de madurez para calcular rendimiento y
          sostener el historial productivo por lote.
        </p>
      </section>
      {!ctx.canRecord ? (
        <CampoLocked profile={profile} />
      ) : (
        <CosechaForm
          fincas={ctx.fincas}
          defaultFincaId={ctx.defaultFincaId}
        />
      )}
    </div>
  );
}
