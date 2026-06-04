"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import { isInsumoHerramienta } from "@/lib/catalogo-insumo-fitosanitario";
import {
  estadoPermiteAsignacion,
  estadoRequiereNotasDano,
} from "@/lib/herramientas-estado";
import type { Database, Tables } from "@/lib/database.types";
import {
  cambiarEstadoInventarioHerramientaSchema,
  crearInventarioHerramientaSchema,
  devolverHerramientaSchema,
  tomarHerramientaSchema,
} from "@/lib/validations/herramientas";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";

type InventarioRow = Database["public"]["Tables"]["inventario_herramientas"]["Row"];
type ProfileRow = Tables<"profiles">;

export type InventarioHerramientaListRow = {
  id: string;
  finca_id: string;
  catalogo_item_id: string;
  codigo: string;
  estado: InventarioRow["estado"];
  assigned_to: string | null;
  notas_dano: string | null;
  created_at: string;
  updated_at: string;
  catalogo_nombre: string;
  assigned_nombre: string | null;
};

function canAccessFinca(profile: ProfileRow | null, fincaId: string): boolean {
  if (!profile) return false;
  if (profile.role === "superadmin") return true;
  if (!profile.finca_id) return false;
  return profile.finca_id === fincaId;
}

async function fetchInventarioRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<ActionResult<InventarioRow>> {
  const { data, error } = await supabase
    .from("inventario_herramientas")
    .select("*")
    .eq("id", id)
    .eq("is_voided", false)
    .maybeSingle();
  if (error) return actionError(error.message);
  if (!data) return actionError("Herramienta no encontrada en inventario.");
  return actionOk(data);
}

async function assertCatalogoHerramientaActivo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  catalogoItemId: string
): Promise<ActionResult<{ nombre: string }>> {
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("nombre, categoria, subcategoria, activo")
    .eq("id", catalogoItemId)
    .maybeSingle();
  if (error || !data) return actionError("Ítem de catálogo no encontrado.");
  if (data.categoria !== "insumo" || !data.activo || !isInsumoHerramienta(data.subcategoria)) {
    return actionError(
      "Seleccione un insumo activo de tipo herramienta del catálogo (HU05)."
    );
  }
  return actionOk({ nombre: data.nombre });
}

function mapDuplicateCodigoError(message: string): string {
  if (message.includes("inventario_herramientas_finca_codigo_lower_uidx")) {
    return "Ya existe una herramienta con ese código en la finca.";
  }
  return message;
}

export async function crearInventarioHerramienta(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = crearInventarioHerramientaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  const input = parsed.data;

  const session = await getSessionProfile();
  if (!session?.user || !session.profile) {
    return actionError("Sesión no válida.");
  }
  const { profile, user } = session;
  if (profile.role !== "superadmin" && profile.role !== "admin") {
    return actionError("Solo administradores pueden dar de alta herramientas en inventario.");
  }
  if (!canAccessFinca(profile, input.finca_id)) {
    return actionError("No tiene permiso para esta finca.");
  }

  const supabase = await createClient();
  const catalogo = await assertCatalogoHerramientaActivo(supabase, input.catalogo_item_id);
  if (!catalogo.success) return catalogo;

  const codigo = input.codigo.trim();
  const { data, error } = await supabase
    .from("inventario_herramientas")
    .insert({
      finca_id: input.finca_id,
      catalogo_item_id: input.catalogo_item_id,
      codigo,
      estado: "disponible",
      created_by: user.id,
      source: "web",
    })
    .select("id")
    .single();

  if (error) {
    return actionError(mapDuplicateCodigoError(error.message));
  }

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "inventario.herramienta_crear",
    titulo: "Alta en inventario de herramientas",
    detalle: {
      inventarioId: data.id,
      codigo,
      catalogoNombre: catalogo.data.nombre,
    },
  });

  return actionOk({ id: data.id });
}

export async function tomarHerramienta(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = tomarHerramientaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const session = await getSessionProfile();
  if (!session?.user || !session.profile) {
    return actionError("Sesión no válida.");
  }
  const { profile, user } = session;
  if (profile.role !== "operario" && profile.role !== "admin" && profile.role !== "superadmin") {
    return actionError("No tiene permiso para tomar herramientas.");
  }

  const supabase = await createClient();
  const rowResult = await fetchInventarioRow(supabase, parsed.data.id);
  if (!rowResult.success) return rowResult;
  const row = rowResult.data;

  if (!canAccessFinca(profile, row.finca_id)) {
    return actionError("No tiene permiso para esta finca.");
  }
  if (!estadoPermiteAsignacion(row.estado)) {
    return actionError("Solo puede tomar herramientas en estado disponible (RN81).");
  }

  const { error } = await supabase
    .from("inventario_herramientas")
    .update({
      estado: "en_uso",
      assigned_to: user.id,
      notas_dano: null,
    })
    .eq("id", row.id);

  if (error) return actionError(error.message);

  await registrarEventoFinca({
    fincaId: row.finca_id,
    actionKey: "inventario.herramienta_tomar",
    titulo: "Herramienta asignada",
    detalle: { inventarioId: row.id, codigo: row.codigo },
  });

  return actionOk({ id: row.id });
}

export async function devolverHerramienta(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = devolverHerramientaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const session = await getSessionProfile();
  if (!session?.user || !session.profile) {
    return actionError("Sesión no válida.");
  }
  const { profile, user } = session;

  const supabase = await createClient();
  const rowResult = await fetchInventarioRow(supabase, parsed.data.id);
  if (!rowResult.success) return rowResult;
  const row = rowResult.data;

  if (!canAccessFinca(profile, row.finca_id)) {
    return actionError("No tiene permiso para esta finca.");
  }
  if (row.estado !== "en_uso") {
    return actionError("La herramienta no está en uso.");
  }

  const isAdmin = profile.role === "admin" || profile.role === "superadmin";
  if (!isAdmin && row.assigned_to !== user.id) {
    return actionError("Solo quien la tiene asignada puede devolverla.");
  }

  const { error } = await supabase
    .from("inventario_herramientas")
    .update({
      estado: "disponible",
      assigned_to: null,
      notas_dano: null,
    })
    .eq("id", row.id);

  if (error) return actionError(error.message);

  await registrarEventoFinca({
    fincaId: row.finca_id,
    actionKey: "inventario.herramienta_devolver",
    titulo: "Herramienta devuelta",
    detalle: { inventarioId: row.id, codigo: row.codigo },
  });

  return actionOk({ id: row.id });
}

export async function cambiarEstadoInventarioHerramienta(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = cambiarEstadoInventarioHerramientaSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  const input = parsed.data;

  const session = await getSessionProfile();
  if (!session?.user || !session.profile) {
    return actionError("Sesión no válida.");
  }
  const { profile } = session;

  if (profile.role !== "admin" && profile.role !== "superadmin") {
    return actionError(
      "Solo un administrador puede registrar daño o pérdida de herramientas."
    );
  }

  const supabase = await createClient();
  const rowResult = await fetchInventarioRow(supabase, input.id);
  if (!rowResult.success) return rowResult;
  const row = rowResult.data;

  if (!canAccessFinca(profile, row.finca_id)) {
    return actionError("No tiene permiso para esta finca.");
  }

  if (input.estado === "en_uso") {
    return actionError("Use la acción «Tomar» para asignar la herramienta.");
  }
  if (input.estado === "disponible") {
    return actionError("Use la acción «Devolver» para liberar la herramienta.");
  }

  if (estadoRequiereNotasDano(input.estado)) {
    const notas = input.notas_dano?.trim() ?? "";
    if (notas.length < 10) {
      return actionError(
        "Describa los hechos del daño o pérdida (mínimo 10 caracteres, RN82)."
      );
    }
  }

  const { error } = await supabase
    .from("inventario_herramientas")
    .update({
      estado: input.estado,
      assigned_to: null,
      notas_dano: estadoRequiereNotasDano(input.estado)
        ? input.notas_dano?.trim() ?? null
        : null,
    })
    .eq("id", row.id);

  if (error) return actionError(error.message);

  await registrarEventoFinca({
    fincaId: row.finca_id,
    actionKey: "inventario.herramienta_estado",
    titulo:
      input.estado === "danada"
        ? "Herramienta reportada como dañada"
        : "Herramienta reportada como perdida",
    detalle: {
      inventarioId: row.id,
      codigo: row.codigo,
      estado: input.estado,
      notasDano: input.notas_dano?.trim() ?? null,
    },
  });

  return actionOk({ id: row.id });
}

export async function listInventarioHerramientasForFinca(
  fincaId: string
): Promise<ActionResult<InventarioHerramientaListRow[]>> {
  if (!fincaId) return actionOk([]);

  const session = await getSessionProfile();
  if (!session?.profile || !canAccessFinca(session.profile, fincaId)) {
    return actionError("No tiene permiso para consultar este inventario.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventario_herramientas")
    .select(
      "id, finca_id, catalogo_item_id, codigo, estado, assigned_to, notas_dano, created_at, updated_at"
    )
    .eq("finca_id", fincaId)
    .eq("is_voided", false)
    .order("codigo");

  if (error) {
    return actionError(error.message);
  }

  const catalogoIds = [
    ...new Set((data ?? []).map((r) => r.catalogo_item_id)),
  ];

  const catalogoMap = new Map<string, string>();
  if (catalogoIds.length > 0) {
    const { data: catalogoRows } = await supabase
      .from("catalogo_items")
      .select("id, nombre")
      .in("id", catalogoIds);
    for (const c of catalogoRows ?? []) {
      catalogoMap.set(c.id, c.nombre);
    }
  }

  const assignedIds = [
    ...new Set(
      (data ?? [])
        .map((r) => r.assigned_to)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const profileMap = new Map<string, string>();
  if (assignedIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", assignedIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p.full_name);
    }
  }

  const rows: InventarioHerramientaListRow[] = (data ?? []).map((r) => ({
    id: r.id,
    finca_id: r.finca_id,
    catalogo_item_id: r.catalogo_item_id,
    codigo: r.codigo,
    estado: r.estado,
    assigned_to: r.assigned_to,
    notas_dano: r.notas_dano,
    created_at: r.created_at,
    updated_at: r.updated_at,
    catalogo_nombre: catalogoMap.get(r.catalogo_item_id) ?? "—",
    assigned_nombre: r.assigned_to ? profileMap.get(r.assigned_to) ?? null : null,
  }));

  return actionOk(rows);
}

export async function listCatalogoHerramientasActivas(): Promise<
  ActionResult<{ id: string; nombre: string; unidad_medida: string | null }[]>
> {
  const session = await getSessionProfile();
  if (!session?.profile) {
    return actionError("Sesión no válida.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("id, nombre, subcategoria, unidad_medida")
    .eq("categoria", "insumo")
    .eq("activo", true)
    .order("nombre");

  if (error) return actionError(error.message);

  const rows = (data ?? [])
    .filter((r) => isInsumoHerramienta(r.subcategoria))
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      unidad_medida: r.unidad_medida,
    }));

  return actionOk(rows);
}
