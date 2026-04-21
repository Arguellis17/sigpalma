import { createClient } from "@/lib/supabase/server";
import { CatalogoReadonlyList } from "@/components/operario/catalogo-readonly-list";

export default async function OperarioCatalogoFitosanitarioPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogo_items")
    .select("id, nombre, descripcion, subcategoria, unidad_medida, sintomas, categoria")
    .in("categoria", ["plaga", "enfermedad", "otro"])
    .eq("activo", true)
    .order("categoria")
    .order("nombre");

  return (
    <CatalogoReadonlyList
      title="Catálogo fitosanitario (consulta)"
      description="Referencia homologada de plagas, enfermedades y demás ítems fitosanitarios del catálogo corporativo. Modo consulta."
      rows={data ?? []}
      extraColumns={[{ key: "categoria", label: "Tipo" }]}
    />
  );
}
