import { createClient } from "@/lib/supabase/server";
import { CatalogoReadonlyList } from "@/components/operario/catalogo-readonly-list";

export default async function OperarioCatalogoInsumosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogo_items")
    .select("id, nombre, descripcion, subcategoria, unidad_medida, proveedor, sintomas")
    .eq("categoria", "insumo")
    .eq("activo", true)
    .order("nombre");

  return (
    <CatalogoReadonlyList
      title="Insumos (consulta)"
      description="Catálogo corporativo de insumos activos. Modo consulta; la administración del catálogo corresponde al administrador del sistema."
      rows={data ?? []}
    />
  );
}
