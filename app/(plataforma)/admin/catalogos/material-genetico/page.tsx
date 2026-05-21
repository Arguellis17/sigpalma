import { createClient } from "@/lib/supabase/server";
import { CatalogoClient } from "../catalogo-client";

async function getMaterialGenetico() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalogo_items")
    .select("id, nombre, descripcion, subcategoria, unidad_medida, proveedor, anio_adquisicion, sintomas, activo")
    .eq("categoria", "material_genetico")
    .order("nombre", { ascending: true });
  return data ?? [];
}

export default async function CatalogoMaterialGeneticoPage() {
  const items = await getMaterialGenetico();
  return (
    <div className="space-y-5">
      <div className="surface-panel rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        <p>
          Registre variedades con <strong className="text-foreground">proveedor certificado</strong> (RN16).
          Los ítems activos alimentan la planificación de siembra del técnico agrónomo (RN27 / HU10) y la
          cadena vivero → germinación → evaluación.
        </p>
      </div>
      <CatalogoClient
        categoria="material_genetico"
        items={items}
        unidadLabel="Presentación / formato"
        materialGeneticoForm
      />
    </div>
  );
}
