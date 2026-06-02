"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, isSuperAdmin } from "@/lib/auth/session-profile";
import {
  calcularIncidenciaPct,
  estimarTotalPalmasLote,
  superaUmbralIncidencia,
} from "@/lib/censo-sanitario";
import { registrarCensoSanitarioSchema } from "@/lib/validations/censo-sanitario";
import { actionError, actionOk, type ActionResult } from "./types";
import { registrarEventoFinca } from "./audit";
import { crearAlertaDesdeCensoUmbral } from "./alertas";

export type CensoSanitarioListRow = {
  id: string;
  fecha_censo: string;
  lote_codigo: string;
  amenaza: string;
  amenaza_categoria: string;
  palmas_inspeccionadas: number;
  palmas_afectadas: number;
  incidencia_pct: number;
  supera_umbral: boolean;
  notas: string | null;
  created_at: string;
};

export type CapacidadPalmasLote = {
  lote_id: string;
  codigo: string;
  total_estimado: number | null;
};

export async function getCapacidadPalmasLote(
  loteId: string
): Promise<ActionResult<CapacidadPalmasLote>> {
  if (!/^[0-9a-f-]{36}$/i.test(loteId)) {
    return actionError("Lote no válido.");
  }

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }

  const supabase = await createClient();
  const { data: lote, error } = await supabase
    .from("lotes")
    .select("id, codigo, finca_id, area_ha, densidad_palmas_ha")
    .eq("id", loteId)
    .maybeSingle();

  if (error || !lote) return actionError("Lote no encontrado.");
  if (
    !isSuperAdmin(session.profile) &&
    session.profile.finca_id !== lote.finca_id
  ) {
    return actionError("No tiene permiso para este lote.");
  }

  return actionOk({
    lote_id: lote.id,
    codigo: lote.codigo,
    total_estimado: estimarTotalPalmasLote(lote.area_ha, lote.densidad_palmas_ha),
  });
}

async function assertCatalogoAmenazaActiva(
  supabase: Awaited<ReturnType<typeof createClient>>,
  catalogoItemId: string
): Promise<ActionResult<{ nombre: string; categoria: string }>> {
  const { data, error } = await supabase
    .from("catalogo_items")
    .select("nombre, categoria, activo")
    .eq("id", catalogoItemId)
    .maybeSingle();
  if (error || !data) return actionError("Amenaza del catálogo no encontrada.");
  if (
    !data.activo ||
    (data.categoria !== "plaga" && data.categoria !== "enfermedad")
  ) {
    return actionError(
      "Seleccione una plaga o enfermedad activa del catálogo fitosanitario (RN68)."
    );
  }
  return actionOk({ nombre: data.nombre, categoria: data.categoria });
}

export async function registrarCensoSanitario(
  raw: unknown
): Promise<
  ActionResult<{
    id: string;
    incidencia_pct: number;
    supera_umbral: boolean;
    alerta_generada_id?: string | null;
  }>
> {
  const parsed = registrarCensoSanitarioSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  const input = parsed.data;

  const session = await getSessionProfile();
  if (!session?.user || !session.profile?.is_active) {
    return actionError("Sesión no válida.");
  }
  const role = session.profile.role;
  if (role !== "operario" && role !== "agronomo" && !isSuperAdmin(session.profile)) {
    return actionError("No tiene permiso para registrar censos.");
  }
  if (
    !isSuperAdmin(session.profile) &&
    session.profile.finca_id !== input.finca_id
  ) {
    return actionError("La finca no coincide con su asignación.");
  }

  const supabase = await createClient();

  const { data: lote, error: loteErr } = await supabase
    .from("lotes")
    .select("id, codigo, finca_id, area_ha, densidad_palmas_ha")
    .eq("id", input.lote_id)
    .maybeSingle();
  if (loteErr || !lote) return actionError("Lote no encontrado.");
  if (lote.finca_id !== input.finca_id) {
    return actionError("El lote no pertenece a la finca seleccionada.");
  }

  const totalEstimado = estimarTotalPalmasLote(lote.area_ha, lote.densidad_palmas_ha);
  if (
    totalEstimado !== null &&
    input.palmas_inspeccionadas > totalEstimado
  ) {
    return actionError(
      `Las palmas inspeccionadas (${input.palmas_inspeccionadas}) superan la capacidad estimada del lote (${totalEstimado} palmas). Verifique área y densidad del lote.`
    );
  }

  const catalogo = await assertCatalogoAmenazaActiva(supabase, input.catalogo_item_id);
  if (!catalogo.success) return catalogo;

  const incidencia_pct = calcularIncidenciaPct(
    input.palmas_inspeccionadas,
    input.palmas_afectadas
  );
  const supera_umbral = superaUmbralIncidencia(incidencia_pct);

  const { data, error } = await supabase
    .from("censos_sanitarios")
    .insert({
      finca_id: input.finca_id,
      lote_id: input.lote_id,
      catalogo_item_id: input.catalogo_item_id,
      fecha_censo: input.fecha_censo,
      palmas_inspeccionadas: input.palmas_inspeccionadas,
      palmas_afectadas: input.palmas_afectadas,
      incidencia_pct,
      supera_umbral,
      notas: input.notas?.trim() ?? null,
      created_by: session.user.id,
      source: input.source,
    })
    .select("id, incidencia_pct, supera_umbral")
    .single();

  if (error) return actionError(error.message);

  await registrarEventoFinca({
    fincaId: input.finca_id,
    actionKey: "sanidad.censo_registrar",
    titulo: "Censo sanitario registrado",
    detalle: {
      censoId: data.id,
      loteCodigo: lote.codigo,
      amenaza: catalogo.data.nombre,
      amenazaCategoria: catalogo.data.categoria,
      palmasInspeccionadas: input.palmas_inspeccionadas,
      palmasAfectadas: input.palmas_afectadas,
      incidenciaPct: incidencia_pct,
      superaUmbral: supera_umbral,
    },
  });

  let alerta_generada_id: string | null = null;
  if (supera_umbral) {
    alerta_generada_id = await crearAlertaDesdeCensoUmbral(supabase, {
      fincaId: input.finca_id,
      loteId: input.lote_id,
      loteCodigo: lote.codigo,
      catalogoItemId: input.catalogo_item_id,
      amenazaNombre: catalogo.data.nombre,
      censoId: data.id,
      incidenciaPct: incidencia_pct,
      palmasInspeccionadas: input.palmas_inspeccionadas,
      palmasAfectadas: input.palmas_afectadas,
      createdBy: session.user.id,
    });
  }

  return actionOk({
    id: data.id,
    incidencia_pct: Number(data.incidencia_pct),
    supera_umbral: data.supera_umbral,
    alerta_generada_id,
  });
}

export async function listCensosSanitariosForFinca(
  fincaId: string
): Promise<ActionResult<CensoSanitarioListRow[]>> {
  if (!fincaId) return actionOk([]);

  const session = await getSessionProfile();
  if (!session?.profile?.is_active) {
    return actionError("Sesión no válida.");
  }
  if (
    !isSuperAdmin(session.profile) &&
    session.profile.finca_id !== fincaId
  ) {
    return actionError("No tiene permiso para consultar censos de esta finca.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("censos_sanitarios")
    .select(
      "id, fecha_censo, lote_id, catalogo_item_id, palmas_inspeccionadas, palmas_afectadas, incidencia_pct, supera_umbral, notas, created_at"
    )
    .eq("finca_id", fincaId)
    .eq("is_voided", false)
    .order("fecha_censo", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return actionError(error.message);

  const rows = data ?? [];
  const loteIds = [...new Set(rows.map((r) => r.lote_id))];
  const catIds = [...new Set(rows.map((r) => r.catalogo_item_id))];

  const [{ data: lotes }, { data: catalogo }] = await Promise.all([
    loteIds.length
      ? supabase.from("lotes").select("id, codigo").in("id", loteIds)
      : Promise.resolve({ data: [] as { id: string; codigo: string }[] }),
    catIds.length
      ? supabase
          .from("catalogo_items")
          .select("id, nombre, categoria")
          .in("id", catIds)
      : Promise.resolve(
          { data: [] as { id: string; nombre: string; categoria: string }[] }
        ),
  ]);

  const loteMap = new Map((lotes ?? []).map((l) => [l.id, l.codigo]));
  const catMap = new Map(
    (catalogo ?? []).map((c) => [c.id, { nombre: c.nombre, categoria: c.categoria }])
  );

  const list: CensoSanitarioListRow[] = rows.map((r) => {
    const cat = catMap.get(r.catalogo_item_id);
    return {
      id: r.id,
      fecha_censo: r.fecha_censo,
      lote_codigo: loteMap.get(r.lote_id) ?? "—",
      amenaza: cat?.nombre ?? "—",
      amenaza_categoria: cat?.categoria ?? "—",
      palmas_inspeccionadas: r.palmas_inspeccionadas,
      palmas_afectadas: r.palmas_afectadas,
      incidencia_pct: Number(r.incidencia_pct),
      supera_umbral: r.supera_umbral,
      notas: r.notas,
      created_at: r.created_at,
    };
  });

  return actionOk(list);
}
