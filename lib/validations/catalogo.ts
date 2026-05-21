import { z } from "zod";

// DB enum values for catalogo_items.categoria
export const categoriasCatalogo = [
  "insumo",
  "material_genetico",
  "plaga",
  "enfermedad",
  "otro",
  "labor",
] as const;

export type CategoriaCatalogo = (typeof categoriasCatalogo)[number];

/** RN13: tipos obligatorios para insumos agrícolas (valor persistido en subcategoria). */
export const subcategoriasInsumo = [
  "nutricion",
  "fitosanitario",
  "herramienta",
] as const;

export type SubcategoriaInsumo = (typeof subcategoriasInsumo)[number];

export const SUBCATEGORIA_INSUMO_LABELS: Record<SubcategoriaInsumo, string> = {
  nutricion: "Nutrición / Fertilizante",
  fitosanitario: "Fitosanitario / Agroquímico",
  herramienta: "Herramienta",
};

export const UNIDADES_MEDIDA_INSUMO = [
  "kg",
  "L",
  "unidad",
  "bolsa",
  "galón",
  "ml",
] as const;

export function isSubcategoriaInsumoValida(
  value: string | null | undefined
): value is SubcategoriaInsumo {
  return subcategoriasInsumo.includes(value as SubcategoriaInsumo);
}

export function labelSubcategoriaInsumo(
  value: string | null | undefined
): string {
  if (!value) return "—";
  if (isSubcategoriaInsumoValida(value)) {
    return SUBCATEGORIA_INSUMO_LABELS[value];
  }
  return value;
}

function refineCamposInsumo(
  data: {
    subcategoria?: string | null;
    unidad_medida?: string | null;
  },
  ctx: z.RefinementCtx
) {
  const sub = data.subcategoria?.trim() ?? "";
  if (!sub || !isSubcategoriaInsumoValida(sub)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Seleccione el tipo de insumo: Nutrición, Fitosanitario o Herramienta.",
      path: ["subcategoria"],
    });
  }

  const unidad = data.unidad_medida?.trim() ?? "";
  if (!unidad) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Indique la unidad de medida (kg, L, unidad…).",
      path: ["unidad_medida"],
    });
  }
}

// UI-level grouping: 'fitosanitario' maps to plaga/enfermedad/otro
export const categoriasFitosanitario = ["plaga", "enfermedad", "otro"] as const;
export type CategoriaFitosanitario = (typeof categoriasFitosanitario)[number];

export const CATEGORIA_FITOSANITARIO_LABELS: Record<CategoriaFitosanitario, string> = {
  plaga: "Plaga",
  enfermedad: "Enfermedad",
  otro: "Otro",
};

export function isCategoriaAmenazaFitosanitaria(
  value: string | null | undefined
): value is CategoriaFitosanitario {
  return categoriasFitosanitario.includes(value as CategoriaFitosanitario);
}

export function labelCategoriaFitosanitaria(value: string | null | undefined): string {
  if (!value) return "—";
  if (isCategoriaAmenazaFitosanitaria(value)) {
    return CATEGORIA_FITOSANITARIO_LABELS[value];
  }
  return value;
}

/** RN19: amenazas precargadas oficiales (identificación por nombre). */
export function esAmenazaCriticaRN19(nombre: string | null | undefined): boolean {
  const n = (nombre ?? "").toLowerCase();
  return n.includes("picudo") || n.includes("pudrición del cogollo");
}

function refineCamposAmenazaFitosanitaria(
  data: { sintomas?: string | null },
  ctx: z.RefinementCtx
) {
  const sint = data.sintomas?.trim() ?? "";
  if (!sint) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Indique los síntomas o signos visuales de la amenaza.",
      path: ["sintomas"],
    });
  }
}

const baseItemCatalogoSchema = z.object({
  nombre: z.string().min(1, "Indique el nombre.").max(200),
  descripcion: z.string().max(1000).nullable().optional(),
  subcategoria: z.string().max(100).nullable().optional(),
  unidad_medida: z.string().max(50).nullable().optional(),
  proveedor: z.string().max(200).nullable().optional(),
  anio_adquisicion: z
    .number()
    .int()
    .min(2000)
    .max(new Date().getFullYear() + 1)
    .nullable()
    .optional(),
  sintomas: z.string().max(2000).nullable().optional(),
});

export const crearItemCatalogoSchema = baseItemCatalogoSchema
  .extend({
    categoria: z.enum(categoriasCatalogo, {
      message: "Seleccione la categoría.",
    }),
  })
  .superRefine((data, ctx) => {
    if (data.categoria === "material_genetico") {
      const p = data.proveedor?.trim() ?? "";
      if (!p) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Indique el proveedor o vivero certificado (obligatorio para material genético).",
          path: ["proveedor"],
        });
      }
    }
    if (data.categoria === "insumo") {
      refineCamposInsumo(data, ctx);
    }
    if (isCategoriaAmenazaFitosanitaria(data.categoria)) {
      refineCamposAmenazaFitosanitaria(data, ctx);
    }
  });

export type CrearItemCatalogoInput = z.infer<typeof crearItemCatalogoSchema>;

export const actualizarItemCatalogoSchema = baseItemCatalogoSchema
  .partial()
  .extend({
    id: z.string().uuid("ID inválido."),
  });

export type ActualizarItemCatalogoInput = z.infer<
  typeof actualizarItemCatalogoSchema
>;

/** Valida RN13/RN14 al editar un ítem de categoría insumo (campos efectivos tras merge). */
export function validarCamposInsumoEfectivos(fields: {
  subcategoria: string | null | undefined;
  unidad_medida: string | null | undefined;
}): string | null {
  const sub = fields.subcategoria?.trim() ?? "";
  if (!sub || !isSubcategoriaInsumoValida(sub)) {
    return "Seleccione el tipo de insumo: Nutrición, Fitosanitario o Herramienta.";
  }
  const unidad = fields.unidad_medida?.trim() ?? "";
  if (!unidad) {
    return "Indique la unidad de medida (kg, L, unidad…).";
  }
  return null;
}

/** Valida síntomas obligatorios al editar plaga/enfermedad/otro. */
export function validarCamposAmenazaFitosanitariaEfectivos(fields: {
  sintomas: string | null | undefined;
}): string | null {
  const sint = fields.sintomas?.trim() ?? "";
  if (!sint) {
    return "Indique los síntomas o signos visuales de la amenaza.";
  }
  return null;
}
