import Link from "next/link";
import { ArrowLeft, MapPinned, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionProfile, isAdmin } from "@/lib/auth/session-profile";
import { FincaCreateForm } from "@/components/fincas/finca-create-form";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Nueva finca | SIG-Palma",
};

export default async function NuevaFincaPage() {
  const session = await getSessionProfile();
  if (!session?.profile || !isAdmin(session.profile)) {
    redirect("/fincas");
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <section className="surface-panel rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Button asChild variant="outline" className="min-h-11 rounded-2xl bg-background/80">
              <Link href="/fincas">
                <ArrowLeft className="size-4" />
                Volver
              </Link>
            </Button>
            <div>
              <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Alta de finca
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Nueva finca
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                Registre la unidad productiva y deje la base lista para asociar lotes.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <MapPinned className="size-5" />
          </div>
        </div>
      </section>
      <FincaCreateForm />
    </div>
  );
}
