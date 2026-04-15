import { loadCampoContext, loadAlertaCatalogo } from "@/lib/campo/page-data";
import { CampoLocked } from "@/components/campo/campo-locked";
import { AlertaForm } from "@/components/campo/alerta-form";

export const metadata = {
  title: "Alerta fitosanitaria | SIG-Palma",
};

export default async function CampoAlertaPage() {
  const ctx = await loadCampoContext();
  const profile = ctx.session?.profile ?? null;
  const catalogRes = await loadAlertaCatalogo();
  const catalogo = catalogRes.success ? catalogRes.data : [];

  return (
    <div className="flex flex-col gap-4">
      <section className="surface-panel fade-up-enter rounded-[2rem] p-5 sm:p-6">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Campo / alertas
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Alerta fitosanitaria (MIP)
        </h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          Registra incidencias, severidad y contexto para activar seguimiento oportuno
          en los lotes con riesgo.
        </p>
      </section>
      {ctx.canRecord && !catalogRes.success ? (
        <p className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-900">
          No se pudo cargar el catálogo: {catalogRes.error}
        </p>
      ) : null}
      {ctx.canRecord && catalogRes.success && catalogo.length === 0 ? (
        <p className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
          El catálogo de plagas/enfermedades está vacío. Un agrónomo o admin
          puede cargar ítems en la base (tabla{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">catalogo_items</code>
          ).
        </p>
      ) : null}
      {!ctx.canRecord ? (
        <CampoLocked profile={profile} />
      ) : (
        <AlertaForm
          fincas={ctx.fincas}
          defaultFincaId={ctx.defaultFincaId}
          catalogo={catalogo}
        />
      )}
    </div>
  );
}
