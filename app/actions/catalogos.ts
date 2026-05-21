"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isAdmin } from "@/lib/auth/session-profile";
import {
  crearItemCatalogoSchema,
  actualizarItemCatalogoSchema,
  validarCamposInsumoEfectivos,
  validarCamposAmenazaFitosanitariaEfectivos,
  isCategoriaAmenazaFitosanitaria,
  type CategoriaCatalogo,
  type CrearItemCatalogoInput,
} from "@/lib/validations/catalogo";
import { actionError, actionOk, type ActionResult } from "./types";
import type { Database } from "@/lib/database.types";

type CatalogoItemRow = Database["public"]["Tables"]["catalogo_items"]["Row"];

function mensajeErrorCatalogo(error: { code?: string; message?: string } | null): string {
  if (!error) return "No se pudo completar la operación.";
  if (
    error.code === "23505" ||
    error.message?.includes("catalogo_items_categoria_nombre_lower")
  ) {
    return "Ya existe un ítem con ese nombre en esta categoría. Use otro nombre o edite el existente.";
  }
  return error.message ?? "No se pudo completar la operación.";
}

/** RN18 / HU06: referencias vigentes que impiden inactivar material genético. */
async function referenciasMaterialGeneticoVigentes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  catalogoItemId: string
): Promise<{ planes: number; germinaciones: number }> {
  const [planesRes, germRes] = await Promise.all([
    supabase
      .from("planes_siembra")
      .select("id", { count: "exact", head: true })
      .eq("catalogo_material_id", catalogoItemId)
      .eq("is_voided", false),
    supabase
      .from("registros_germinacion")
      .select("id", { count: "exact", head: true })
      .eq("catalogo_material_id", catalogoItemId)
      .eq("is_voided", false),
  ]);

  return {
    planes: planesRes.count ?? 0,
    germinaciones: germRes.count ?? 0,
  };
}

/** RN20 / HU07: alertas vigentes que referencian la amenaza. */
async function referenciasAmenazaFitosanitariaVigentes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  catalogoItemId: string
): Promise<number> {
  const { count } = await supabase
    .from("alertas_fitosanitarias")
    .select("id", { count: "exact", head: true })
    .eq("catalogo_item_id", catalogoItemId)
    .eq("is_voided", false);
  return count ?? 0;
}

// ─── HU05/06/07: Crear ítem de catálogo ──────────────────────────────────────

export async function crearItemCatalogo(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = crearItemCatalogoSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input: CrearItemCatalogoInput = parsed.data;

  const session = await getSessionProfile();
  if (!session?.profile || !isAdmin(session.profile)) {
    return actionError("Solo un administrador puede gestionar el catálogo.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("catalogo_items")
    .insert({
      nombre: input.nombre.trim(),
      categoria: input.categoria,
      descripcion: input.descripcion?.trim() ?? null,
      subcategoria: input.subcategoria?.trim() ?? null,
      unidad_medida: input.unidad_medida?.trim() ?? null,
      proveedor: input.proveedor?.trim() ?? null,
      anio_adquisicion: input.anio_adquisicion ?? null,
      sintomas: input.sintomas?.trim() ?? null,
      activo: true,
    })
    .select("id")
    .single();

  if (error || !data) return actionError(mensajeErrorCatalogo(error));
  return actionOk({ id: data.id });
}

// ─── HU05/06/07: Actualizar ítem de catálogo ─────────────────────────────────

export async function actualizarItemCatalogo(
  raw: unknown
): Promise<ActionResult<void>> {
  const parsed = actualizarItemCatalogoSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const session = await getSessionProfile();
  if (!session?.profile || !isAdmin(session.profile)) {
    return actionError("Solo un administrador puede gestionar el catálogo.");
  }

  const supabase = await createClient();
  const { id, ...rest } = parsed.data;

  const { data: existing, error: exErr } = await supabase
    .from("catalogo_items")
    .select("categoria, proveedor, subcategoria, unidad_medida, sintomas")
    .eq("id", id)
    .maybeSingle();
  if (exErr || !existing) {
    return actionError(exErr?.message ?? "Ítem no encontrado.");
  }

  const updates: Partial<CatalogoItemRow> = {};
  if (rest.nombre !== undefined) updates.nombre = rest.nombre.trim();
  if (rest.descripcion !== undefined) updates.descripcion = rest.descripcion?.trim() ?? null;
  if (rest.subcategoria !== undefined) updates.subcategoria = rest.subcategoria?.trim() ?? null;
  if (rest.unidad_medida !== undefined) updates.unidad_medida = rest.unidad_medida?.trim() ?? null;
  if (rest.proveedor !== undefined) updates.proveedor = rest.proveedor?.trim() ?? null;
  if (rest.anio_adquisicion !== undefined) updates.anio_adquisicion = rest.anio_adquisicion ?? null;
  if (rest.sintomas !== undefined) updates.sintomas = rest.sintomas?.trim() ?? null;

  if (existing.categoria === "insumo") {
    const insumoErr = validarCamposInsumoEfectivos({
      subcategoria:
        updates.subcategoria !== undefined ? updates.subcategoria : existing.subcategoria,
      unidad_medida:
        updates.unidad_medida !== undefined ? updates.unidad_medida : existing.unidad_medida,
    });
    if (insumoErr) return actionError(insumoErr);
  }

  if (isCategoriaAmenazaFitosanitaria(existing.categoria)) {
    const amenazaErr = validarCamposAmenazaFitosanitariaEfectivos({
      sintomas: updates.sintomas !== undefined ? updates.sintomas : existing.sintomas,
    });
    if (amenazaErr) return actionError(amenazaErr);
  }

  if (existing.categoria === "material_genetico") {
    const nextProv =
      updates.proveedor !== undefined ? updates.proveedor : existing.proveedor;
    if (!nextProv || !String(nextProv).trim()) {
      return actionError(
        "El proveedor o vivero certificado es obligatorio para material genético."
      );
    }
  }

  const { error } = await supabase
    .from("catalogo_items")
    .update({ ...updates })
    .eq("id", id);

  if (error) return actionError(mensajeErrorCatalogo(error));
  return actionOk(undefined);
}

// ─── HU05/06/07: Inactivar ítem de catálogo (soft delete) ────────────────────

export async function inactivarItemCatalogo(
  id: string
): Promise<ActionResult<void>> {
  if (!id) return actionError("ID inválido.");

  const session = await getSessionProfile();
  if (!session?.profile || !isAdmin(session.profile)) {
    return actionError("Solo un administrador puede gestionar el catálogo.");
  }

  const supabase = await createClient();

  const { data: item, error: itemErr } = await supabase
    .from("catalogo_items")
    .select("id, categoria, nombre")
    .eq("id", id)
    .maybeSingle();
  if (itemErr || !item) {
    return actionError(itemErr?.message ?? "Ítem no encontrado.");
  }

  if (item.categoria === "material_genetico") {
    const refs = await referenciasMaterialGeneticoVigentes(supabase, id);
    if (refs.planes > 0 || refs.germinaciones > 0) {
      const partes: string[] = [];
      if (refs.planes > 0) {
        partes.push(
          `${refs.planes} plan${refs.planes === 1 ? "" : "es"} de siembra vigente${refs.planes === 1 ? "" : "s"}`
        );
      }
      if (refs.germinaciones > 0) {
        partes.push(
          `${refs.germinaciones} registro${refs.germinaciones === 1 ? "" : "s"} de germinación vigente${refs.germinaciones === 1 ? "" : "s"}`
        );
      }
      return actionError(
        `No se puede inactivar «${item.nombre}»: está vinculado a ${partes.join(" y ")}. Anule esos registros primero; el historial se conserva en la base de datos.`
      );
    }
  }

  if (isCategoriaAmenazaFitosanitaria(item.categoria)) {
    const alertas = await referenciasAmenazaFitosanitariaVigentes(supabase, id);
    if (alertas > 0) {
      return actionError(
        `No se puede inactivar «${item.nombre}»: está vinculada a ${alertas} reporte${alertas === 1 ? "" : "s"} fitosanitario${alertas === 1 ? "" : "s"} vigente${alertas === 1 ? "" : "s"}. Anule o cierre esos reportes primero; el historial se conserva.`
      );
    }
  }

  const { error } = await supabase
    .from("catalogo_items")
    .update({ activo: false })
    .eq("id", id);

  if (error) return actionError(mensajeErrorCatalogo(error));
  return actionOk(undefined);
}

// ─── Listar catálogo por categoría ───────────────────────────────────────────

export async function listarCatalogoPorCategoria(
  categoria: CategoriaCatalogo,
  incluirInactivos = false
): Promise<ActionResult<CatalogoItemRow[]>> {
  const session = await getSessionProfile();
  if (!session?.profile || !isAdmin(session.profile)) {
    return actionError("Acción no permitida.");
  }

  const supabase = await createClient();

  let query = supabase
    .from("catalogo_items")
    .select("*")
    .eq("categoria", categoria)
    .order("nombre", { ascending: true });

  if (!incluirInactivos) {
    query = query.eq("activo", true);
  }

  const { data, error } = await query;
  if (error) return actionError(error.message);
  return actionOk(data ?? []);
}
