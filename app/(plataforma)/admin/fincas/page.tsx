import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { MapPinned, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

async function getFincas() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fincas")
    .select("id, nombre, ubicacion, area_ha, propietario, created_at")
    .order("nombre", { ascending: true });
  return data ?? [];
}

export default async function AdminFincasPage() {
  const fincas = await getFincas();

  return (
    <div className="fade-up-enter space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <Button asChild>
          <Link href="/admin/fincas/nueva">
            <Plus className="mr-1.5 size-4" />
            Nueva finca
          </Link>
        </Button>
      </div>

      {fincas.length === 0 ? (
        <div className="surface-panel rounded-2xl py-16 text-center">
          <MapPinned className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No hay fincas registradas. Crea la primera.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fincas.map((finca) => (
            <Link
              key={finca.id}
              href={`/admin/fincas/${finca.id}`}
              className="surface-panel group rounded-2xl p-5 ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:ring-primary/30"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <MapPinned className="size-4" />
                </div>
                {finca.area_ha ? (
                  <Badge variant="secondary" className="text-xs">
                    {finca.area_ha} ha
                  </Badge>
                ) : null}
              </div>

              <p className="mt-2 font-semibold text-foreground">{finca.nombre}</p>

              {finca.ubicacion ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{finca.ubicacion}</p>
              ) : null}

              {finca.propietario ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Propietario: {finca.propietario}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
