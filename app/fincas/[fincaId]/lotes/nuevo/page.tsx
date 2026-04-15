import Link from "next/link";
import { ArrowLeft, Blocks, Plus } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, canManageLotes } from "@/lib/auth/session-profile";
import { LoteCreateForm } from "@/components/fincas/lote-create-form";
import { Button } from "@/components/ui/button";

type Props = {
  params: Promise<{ fincaId: string }>;
};

export const metadata = {
  title: "Nuevo lote | SIG-Palma",
};

export default async function NuevoLotePage({ params }: Props) {
  const { fincaId } = await params;
  const session = await getSessionProfile();

  if (!session?.profile || !canManageLotes(session.profile)) {
    redirect("/fincas");
  }

  if (
    session.profile.role === "agronomo" &&
    session.profile.finca_id !== fincaId
  ) {
    redirect("/fincas");
  }

  const supabase = await createClient();
  const { data: finca } = await supabase
    .from("fincas")
    .select("id, nombre")
    .eq("id", fincaId)
    .maybeSingle();

  if (!finca) {
    notFound();
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <section className="surface-panel rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Button asChild variant="outline" className="min-h-11 rounded-2xl bg-background/80">
              <Link href={`/fincas/${fincaId}`}>
                <ArrowLeft className="size-4" />
                Volver
              </Link>
            </Button>
            <div>
              <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                {finca.nombre}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Nuevo lote
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                Registre una nueva unidad de siembra dentro de la finca seleccionada.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Blocks className="size-5" />
          </div>
        </div>
      </section>
      <LoteCreateForm fincaId={fincaId} />
    </div>
  );
}
