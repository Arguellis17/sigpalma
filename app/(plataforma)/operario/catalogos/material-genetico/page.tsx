import { createClient } from "@/lib/supabase/server";
import { CatalogoReadonlyList } from "@/components/operario/catalogo-readonly-list";

export default async function OperarioCatalogoMaterialGeneticoPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogo_items")
    .select("id, nombre, descripcion, subcategoria, unidad_medida, proveedor, sintomas")
    .eq("categoria", "material_genetico")
    .eq("activo", true)
    .order("nombre");

  return (
    <CatalogoReadonlyList
      title="Material genético (consulta)"
      description="Variedades y material genético activo registrado en el sistema. Modo consulta."
      rows={data ?? []}
      extraColumns={[{ key: "proveedor", label: "Proveedor" }]}
    />
  );
}
