import { z } from "zod";

// DB enum values for catalogo_items.categoria
export const categoriasCatalogo = [
  "insumo",
  "material_genetico",
  "plaga",
  "enfermedad",
  "otro",
] as const;

export type CategoriaCatalogo = (typeof categoriasCatalogo)[number];

// UI-level grouping: 'fitosanitario' maps to plaga/enfermedad/otro
export const categoriasFitosanitario = ["plaga", "enfermedad", "otro"] as const;
export type CategoriaFitosanitario = (typeof categoriasFitosanitario)[number];

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
          message: "Indique el proveedor o vivero certificado (obligatorio para material genético).",
          path: ["proveedor"],
        });
      }
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
