import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPinned, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { params: Promise<{ fincaId: string }> };

async function getFincaConLotes(fincaId: string) {
  const supabase = await createClient();

  const { data: finca } = await supabase
    .from("fincas")
    .select("id, nombre, ubicacion, area_ha, propietario, created_at")
    .eq("id", fincaId)
    .maybeSingle();

  if (!finca) return null;

  const { data: lotes } = await supabase
    .from("lotes")
    .select("id, codigo, area_ha, anio_siembra, material_genetico, created_at")
    .eq("finca_id", fincaId)
    .order("codigo", { ascending: true });

  return { finca, lotes: lotes ?? [] };
}

export default async function FincaDetallePage({ params }: Props) {
  const { fincaId } = await params;
  const result = await getFincaConLotes(fincaId);

  if (!result) notFound();

  const { finca, lotes } = result;

  return (
    <div className="fade-up-enter space-y-6">
      {/* Header finca */}
      <div className="surface-panel rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <MapPinned className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{finca.nombre}</h2>
              {finca.ubicacion ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{finca.ubicacion}</p>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            {finca.area_ha ? (
              <Badge variant="secondary">{finca.area_ha} ha</Badge>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/fincas/${finca.id}/editar`}>Editar</Link>
            </Button>
          </div>
        </div>

        {finca.propietario ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Propietario: <span className="font-medium text-foreground">{finca.propietario}</span>
          </p>
        ) : null}
      </div>

      {/* Lotes */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Lotes ({lotes.length})
          </h3>
          <Button asChild size="sm">
            <Link href={`/admin/fincas/${finca.id}/lotes/nuevo`}>
              <Plus className="mr-1.5 size-3.5" />
              Nuevo lote
            </Link>
          </Button>
        </div>

        {lotes.length === 0 ? (
          <div className="surface-panel rounded-2xl py-12 text-center text-sm text-muted-foreground">
            No hay lotes registrados para esta finca.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lotes.map((lote) => (
              <Card key={lote.id} className="surface-panel border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      Lote {lote.codigo}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {lote.area_ha ? (
                    <p className="text-xs text-muted-foreground">{lote.area_ha} ha</p>
                  ) : null}
                  {lote.anio_siembra ? (
                    <p className="text-xs text-muted-foreground">Siembra: {lote.anio_siembra}</p>
                  ) : null}
                  {lote.material_genetico ? (
                    <p className="text-xs text-muted-foreground">{lote.material_genetico}</p>
                  ) : null}
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/admin/fincas/${finca.id}/lotes/${lote.id}/editar`}
                      className="text-xs text-primary underline underline-offset-2"
                    >
                      Editar
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
