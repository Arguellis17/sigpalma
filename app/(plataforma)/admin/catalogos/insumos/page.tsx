import { createClient } from "@/lib/supabase/server";
import { CatalogoClient } from "../catalogo-client";

async function getInsumos() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogo_items")
    .select("id, nombre, descripcion, subcategoria, unidad_medida, proveedor, anio_adquisicion, sintomas, activo")
    .eq("categoria", "insumo")
    .order("nombre", { ascending: true });
  return data ?? [];
}

export default async function CatalogoInsumosPage() {
  const items = await getInsumos();
  return (
    <CatalogoClient
      categoria="insumo"
      items={items}
      unidadLabel="Unidad de medida *"
      insumoTipoSelect
    />
  );
}
