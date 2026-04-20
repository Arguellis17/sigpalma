import { createClient } from "@/lib/supabase/server";
import { CatalogoClient } from "../catalogo-client";

async function getMaterialGenetico() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogo_items")
    .select("id, nombre, descripcion, subcategoria, unidad_medida, proveedor, anio_adquisicion, sintomas, activo")
    .eq("categoria", "material_genetico")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  return data ?? [];
}

export default async function CatalogoMaterialGeneticoPage() {
  const items = await getMaterialGenetico();
  return (
    <CatalogoClient
      categoria="material_genetico"
      items={items}
      unidadLabel="Presentación / formato"
    />
  );
}
