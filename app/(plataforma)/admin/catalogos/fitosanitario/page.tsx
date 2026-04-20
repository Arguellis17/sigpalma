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
    <CatalogoClient
      categoria="plaga"
      items={items}
      showSintomas
      allowCategorySelect
      unidadLabel="Unidad de medida"
    />
  );
}
