import { createClient } from "@/lib/supabase/server";
import { CatalogoClient } from "../catalogo-client";

async function getLaboresItems() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogo_items")
    .select(
      "id, nombre, descripcion, subcategoria, unidad_medida, proveedor, anio_adquisicion, sintomas, activo, categoria"
    )
    .eq("categoria", "labor")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  return data ?? [];
}

export default async function CatalogoLaboresPage() {
  const items = await getLaboresItems();
  return (
    <CatalogoClient
      categoria="labor"
      items={items}
      showSintomas={false}
      unidadLabel="Unidad (opcional)"
    />
  );
}
