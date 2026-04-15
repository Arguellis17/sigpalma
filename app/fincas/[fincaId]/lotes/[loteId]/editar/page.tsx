import Link from "next/link";
import { ArrowLeft, PencilLine } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, canManageLotes } from "@/lib/auth/session-profile";
import { LoteEditForm } from "@/components/fincas/lote-edit-form";
import { Button } from "@/components/ui/button";

type Props = {
  params: Promise<{ fincaId: string; loteId: string }>;
};

export const metadata = {
  title: "Editar lote | SIG-Palma",
};

export default async function EditarLotePage({ params }: Props) {
  const { fincaId, loteId } = await params;
  const session = await getSessionProfile();
  if (!session?.profile || !canManageLotes(session.profile)) {
    redirect(`/fincas/${fincaId}/lotes/${loteId}`);
  }
  if (
    session.profile.role === "agronomo" &&
    session.profile.finca_id !== fincaId
  ) {
    redirect(`/fincas/${fincaId}`);
  }

  const supabase = await createClient();
  const { data: lote, error } = await supabase
    .from("lotes")
    .select("*")
    .eq("id", loteId)
    .eq("finca_id", fincaId)
    .maybeSingle();

  if (error || !lote) {
    notFound();
  }

  const { data: finca } = await supabase
    .from("fincas")
    .select("nombre")
    .eq("id", fincaId)
    .single();

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <section className="surface-panel rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Button asChild variant="outline" className="min-h-11 rounded-2xl bg-background/80">
              <Link href={`/fincas/${fincaId}/lotes/${loteId}`}>
                <ArrowLeft className="size-4" />
                Volver
              </Link>
            </Button>
            <div>
              <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                {finca?.nombre}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Editar lote {lote.codigo}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                Actualice los atributos productivos del lote.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <PencilLine className="size-5" />
          </div>
        </div>
      </section>
      <LoteEditForm
        fincaId={fincaId}
        loteId={loteId}
        initial={{
          codigo: lote.codigo,
          area_ha: lote.area_ha,
          anio_siembra: lote.anio_siembra,
          material_genetico: lote.material_genetico,
          densidad_palmas_ha: lote.densidad_palmas_ha,
        }}
      />
    </div>
  );
}
