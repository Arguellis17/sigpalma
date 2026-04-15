import Link from "next/link";
import { ArrowLeft, PencilLine } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isAdmin } from "@/lib/auth/session-profile";
import { FincaEditForm } from "@/components/fincas/finca-edit-form";
import { Button } from "@/components/ui/button";

type Props = {
  params: Promise<{ fincaId: string }>;
};

export const metadata = {
  title: "Editar finca | SIG-Palma",
};

export default async function EditarFincaPage({ params }: Props) {
  const { fincaId } = await params;
  const session = await getSessionProfile();
  if (!session?.profile || !isAdmin(session.profile)) {
    redirect(`/fincas/${fincaId}`);
  }

  const supabase = await createClient();
  const { data: finca, error } = await supabase
    .from("fincas")
    .select("*")
    .eq("id", fincaId)
    .maybeSingle();

  if (error || !finca) {
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
                Edición de finca
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Editar finca
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                Actualice los datos base de la finca para mantener la información vigente.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <PencilLine className="size-5" />
          </div>
        </div>
      </section>
      <FincaEditForm
        fincaId={fincaId}
        initial={{
          nombre: finca.nombre,
          ubicacion: finca.ubicacion,
          area_ha: finca.area_ha,
          propietario: finca.propietario,
        }}
      />
    </div>
  );
}
