"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isAdmin } from "@/lib/auth/session-profile";
import {
  crearItemCatalogoSchema,
  actualizarItemCatalogoSchema,
  type CategoriaCatalogo,
  type CrearItemCatalogoInput,
} from "@/lib/validations/catalogo";
import { actionError, actionOk, type ActionResult } from "./types";
import type { Database } from "@/lib/database.types";

type CatalogoItemRow = Database["public"]["Tables"]["catalogo_items"]["Row"];

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

  if (error || !data) return actionError(error?.message ?? "No se pudo crear el ítem.");
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
    .select("categoria, proveedor")
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

  if (error) return actionError(error.message);
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

  const { error } = await supabase
    .from("catalogo_items")
    .update({ activo: false })
    .eq("id", id);

  if (error) return actionError(error.message);
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
