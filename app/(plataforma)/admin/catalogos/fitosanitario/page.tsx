import { createClient } from "@/lib/supabase/server";
import { CatalogoClient } from "../catalogo-client";

async function getFitosanitario() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogo_items")
    .select("id, nombre, descripcion, subcategoria, unidad_medida, proveedor, anio_adquisicion, sintomas, activo, categoria")
    .in("categoria", ["plaga", "enfermedad", "otro"])
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });
  return data ?? [];
}

export default async function CatalogoFitosanitarioPage() {
  const items = await getFitosanitario();
  return (
    <div className="space-y-5">
      <div className="surface-panel rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        <p>
          Catálogo RF07 / RN19: incluye amenazas críticas precargadas (Picudo, Pudrición del cogollo).
          Las entradas activas alimentan reportes de campo (alertas MIP), validación técnica y futuros
          censos sanitarios.
        </p>
      </div>
      <CatalogoClient
        categoria="plaga"
        items={items}
        showSintomas
        allowCategorySelect
        fitosanitarioForm
      />
    </div>
  );
}
