import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { Layers, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getAnalisis(fincaId: string | null) {
  const supabase = await createClient();

  let query = supabase
    .from("analisis_suelo")
    .select("id, ph, humedad_pct, compactacion, notas, created_at, lote_id, finca_id, fincas(nombre), lotes(codigo)")
    .eq("is_voided", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (fincaId) {
    query = query.eq("finca_id", fincaId);
  }

  const { data } = await query;
  return data ?? [];
}

export default async function TecnicoSueloPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const analisis = await getAnalisis(fincaId);

  return (
    <div className="fade-up-enter space-y-6">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/tecnico/suelo/nuevo">
            <Plus className="mr-1.5 size-4" />
            Nuevo análisis
          </Link>
        </Button>
      </div>

      {analisis.length === 0 ? (
        <div className="surface-panel rounded-2xl py-16 text-center">
          <Layers className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No hay análisis registrados. Crea el primero.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {analisis.map((a) => (
            <Card key={a.id} className="surface-panel border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    {(a.fincas as { nombre?: string } | null)?.nombre ?? "Finca"}
                    {a.lotes
                      ? ` · Lote ${(a.lotes as { codigo?: string } | null)?.codigo ?? ""}`
                      : ""}
                  </CardTitle>
                </div>
                {a.created_at ? (
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString("es-CO", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {a.ph != null ? (
                    <Badge variant="secondary" className="text-xs">pH {a.ph}</Badge>
                  ) : null}
                  {a.humedad_pct != null ? (
                    <Badge variant="secondary" className="text-xs">Humedad {a.humedad_pct}%</Badge>
                  ) : null}
                  {a.compactacion != null ? (
                    <Badge variant="secondary" className="text-xs">Compact. {a.compactacion}</Badge>
                  ) : null}
                </div>
                {a.notas ? (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{a.notas}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
