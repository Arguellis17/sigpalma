/**
 * Espejo del esquema aplicado por SQL en `supabase/migrations/`.
 * Mantener alineado con la migración; usar Drizzle Studio / consultas tipadas.
 * No reemplaza las migraciones Supabase: son la fuente de verdad para RLS, triggers y auth.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "superadmin",
  "admin",
  "agronomo",
  "operario",
]);

export const registroSourceEnum = pgEnum("registro_source", [
  "web",
  "mobile",
  "api",
]);

export const catalogoCategoriaEnum = pgEnum("catalogo_categoria", [
  "plaga",
  "enfermedad",
  "insumo",
  "material_genetico",
  "otro",
  "labor",
]);

export const nivelSeveridadEnum = pgEnum("nivel_severidad", [
  "baja",
  "media",
  "alta",
  "critica",
]);

export const ordenControlEstadoEnum = pgEnum("orden_control_estado", [
  "autorizada",
  "cerrada",
  "cancelada",
]);

/** RN26 HU10: elegibilidad para planificar siembra vs cultivo establecido */
export const loteEstadoCultivoEnum = pgEnum("lote_estado_cultivo", [
  "vacante",
  "disponible",
  "planificado_siembra",
  "listo_para_siembra",
  "en_produccion",
]);

/** RN33 HU12: dosis programada por hectárea o por palma */
export const planNutricionDosisUnidadEnum = pgEnum("plan_nutricion_dosis_unidad", [
  "por_ha",
  "por_palma",
]);

export const planNutricionFrecuenciaEnum = pgEnum("plan_nutricion_frecuencia", [
  "once",
  "semanal",
  "quincenal",
  "mensual",
  "personalizado",
]);

/** HU22 RN64: método de aplicación de fertilizante */
export const metodoAplicacionFertilizacionEnum = pgEnum(
  "metodo_aplicacion_fertilizacion",
  ["manual", "equipada", "fertirriego", "otro"]
);

/** HU19: estado del registro de preparación de terreno */
export const preparacionTerrenoEstadoEnum = pgEnum("preparacion_terreno_estado", [
  "aprobado",
  "pendiente_validacion_tecnico",
]);

/** HU27 / HU29: inventario de fruta cosechada en finca */
export const cosechaEstadoAcopioEnum = pgEnum("cosecha_estado_acopio", [
  "en_centro_acopio",
  "en_transito",
]);

/** HU13: inspección fitosanitaria programada */
export const monitoreoFitosanitarioEstadoEnum = pgEnum("monitoreo_fitosanitario_estado", [
  "pendiente",
  "completada",
  "anulada",
]);

/** HU14 RF14: concepto emitido en evaluación de vivero */
export const viveroConceptoEvaluacionEnum = pgEnum("vivero_concepto_evaluacion", [
  "apto_trasplante",
  "no_apto",
]);

/** HU18 RF28 RN80: estado de activo en inventario de herramientas */
export const inventarioHerramientaEstadoEnum = pgEnum("inventario_herramienta_estado", [
  "disponible",
  "en_uso",
  "danada",
  "perdida",
]);

export const fincas = pgTable(
  "fincas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    ubicacion: text("ubicacion"),
    areaHa: numeric("area_ha", { precision: 12, scale: 4 }).notNull(),
    propietario: text("propietario"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("fincas_nombre_unique").on(sql`lower(${t.nombre})`),
  ]
);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull().default(""),
  role: userRoleEnum("role").notNull().default("operario"),
  fincaId: uuid("finca_id").references(() => fincas.id, {
    onDelete: "set null",
  }),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const lotes = pgTable(
  "lotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fincaId: uuid("finca_id")
      .notNull()
      .references(() => fincas.id, { onDelete: "restrict" }),
    codigo: text("codigo").notNull(),
    areaHa: numeric("area_ha", { precision: 12, scale: 4 }).notNull(),
    anioSiembra: integer("anio_siembra").notNull(),
    materialGenetico: text("material_genetico"),
    densidadPalmasHa: numeric("densidad_palmas_ha", {
      precision: 10,
      scale: 2,
    }),
    pendientePct: numeric("pendiente_pct", { precision: 5, scale: 2 }),
    activo: boolean("activo").notNull().default(true),
    estadoCultivo: loteEstadoCultivoEnum("estado_cultivo")
      .notNull()
      .default("en_produccion"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("lotes_finca_codigo").on(t.fincaId, t.codigo)]
);

export const catalogoItems = pgTable(
  "catalogo_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoria: catalogoCategoriaEnum("categoria").notNull(),
    nombre: text("nombre").notNull(),
    descripcion: text("descripcion"),
    activo: boolean("activo").notNull().default(true),
    // insumos
    subcategoria: text("subcategoria"),
    unidadMedida: text("unidad_medida"),
    // material_genetico
    proveedor: text("proveedor"),
    anioAdquisicion: integer("anio_adquisicion"),
    // plaga / enfermedad
    sintomas: text("sintomas"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("catalogo_items_categoria_nombre_lower").on(
      t.categoria,
      sql`lower(${t.nombre})`
    ),
  ]
);

export const laboresAgronomicas = pgTable("labores_agronomicas", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  catalogoItemId: uuid("catalogo_item_id").references(() => catalogoItems.id, {
    onDelete: "set null",
  }),
  tipo: text("tipo").notNull(),
  fechaEjecucion: date("fecha_ejecucion").notNull(),
  cantidadEjecutada: numeric("cantidad_ejecutada", { precision: 14, scale: 4 }),
  unidadMedida: text("unidad_medida"),
  ejecutadaAt: timestamp("ejecutada_at", { withTimezone: true }),
  notas: text("notas"),
  assignedTo: uuid("assigned_to").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdBy: uuid("created_by").notNull(),
  source: registroSourceEnum("source").notNull().default("web"),
  isVoided: boolean("is_voided").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const planesSiembra = pgTable("planes_siembra", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  catalogoMaterialId: uuid("catalogo_material_id")
    .notNull()
    .references(() => catalogoItems.id, { onDelete: "restrict" }),
  fechaProyectada: date("fecha_proyectada").notNull(),
  confirmacionErosion: boolean("confirmacion_erosion").notNull().default(false),
  notas: text("notas"),
  createdBy: uuid("created_by").notNull(),
  source: registroSourceEnum("source").notNull().default("web"),
  isVoided: boolean("is_voided").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** HU19 RF19: adecuación física del lote previa a siembra */
export const preparacionesTerreno = pgTable("preparaciones_terreno", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  planSiembraId: uuid("plan_siembra_id")
    .notNull()
    .references(() => planesSiembra.id, { onDelete: "restrict" }),
  pendienteFinalPct: numeric("pendiente_final_pct", { precision: 5, scale: 2 }).notNull(),
  actividades: text("actividades").array().notNull(),
  estado: preparacionTerrenoEstadoEnum("estado").notNull(),
  notas: text("notas"),
  validadoPor: uuid("validado_por"),
  validadoEn: timestamp("validado_en", { withTimezone: true }),
  observacionValidacion: text("observacion_validacion"),
  createdBy: uuid("created_by").notNull(),
  source: registroSourceEnum("source").notNull().default("web"),
  isVoided: boolean("is_voided").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** HU20 RF20: siembra de plántulas en campo */
export const registrosSiembra = pgTable("registros_siembra", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  planSiembraId: uuid("plan_siembra_id")
    .notNull()
    .references(() => planesSiembra.id, { onDelete: "restrict" }),
  preparacionTerrenoId: uuid("preparacion_terreno_id")
    .notNull()
    .references(() => preparacionesTerreno.id, { onDelete: "restrict" }),
  catalogoMaterialId: uuid("catalogo_material_id")
    .notNull()
    .references(() => catalogoItems.id, { onDelete: "restrict" }),
  fechaSiembra: date("fecha_siembra").notNull(),
  cantidadPalmas: integer("cantidad_palmas").notNull(),
  confirmacionProfundidad: boolean("confirmacion_profundidad").notNull(),
  confirmacionOrientacion: boolean("confirmacion_orientacion").notNull(),
  notas: text("notas"),
  createdBy: uuid("created_by").notNull(),
  source: registroSourceEnum("source").notNull().default("web"),
  isVoided: boolean("is_voided").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** HU12 RF12: plan nutrición y riego por lote */
export const planesNutricion = pgTable("planes_nutricion", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  nombre: text("nombre"),
  fechaInicio: date("fecha_inicio"),
  fechaFin: date("fecha_fin"),
  notas: text("notas"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull(),
  source: registroSourceEnum("source").notNull().default("web"),
  isVoided: boolean("is_voided").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const planesNutricionItems = pgTable("planes_nutricion_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => planesNutricion.id, { onDelete: "cascade" }),
  catalogoInsumoId: uuid("catalogo_insumo_id")
    .notNull()
    .references(() => catalogoItems.id, { onDelete: "restrict" }),
  dosisCantidad: numeric("dosis_cantidad", { precision: 14, scale: 4 }).notNull(),
  dosisUnidad: planNutricionDosisUnidadEnum("dosis_unidad").notNull(),
  frecuencia: planNutricionFrecuenciaEnum("frecuencia").notNull().default("once"),
  fechaObjetivo: date("fecha_objetivo"),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const planesRiegoItems = pgTable("planes_riego_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => planesNutricion.id, { onDelete: "cascade" }),
  descripcion: text("descripcion").notNull(),
  intervaloDias: integer("intervalo_dias"),
  proximaFecha: date("proxima_fecha").notNull(),
  volumenOTiempo: text("volumen_o_tiempo"),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** HU13 RF13: monitoreo fitosanitario programado (lote, fecha, operario). */
export const monitoreosFitosanitariosProgramados = pgTable(
  "monitoreos_fitosanitarios_programados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fincaId: uuid("finca_id")
      .notNull()
      .references(() => fincas.id, { onDelete: "restrict" }),
    loteId: uuid("lote_id")
      .notNull()
      .references(() => lotes.id, { onDelete: "restrict" }),
    fechaInspeccion: date("fecha_inspeccion").notNull(),
    assignedTo: uuid("assigned_to")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by").notNull(),
    notas: text("notas"),
    estado: monitoreoFitosanitarioEstadoEnum("estado").notNull().default("pendiente"),
    source: registroSourceEnum("source").notNull().default("web"),
    isVoided: boolean("is_voided").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

/** RF18: registro de germinación / tratamiento térmico (precondición HU14). */
export const registrosGerminacion = pgTable("registros_germinacion", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  catalogoMaterialId: uuid("catalogo_material_id")
    .notNull()
    .references(() => catalogoItems.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id").references(() => lotes.id, { onDelete: "set null" }),
  fechaTratamiento: date("fecha_tratamiento").notNull(),
  temperaturaMaxC: numeric("temperatura_max_c", { precision: 5, scale: 2 }).notNull(),
  diasTratamiento: integer("dias_tratamiento").notNull(),
  notas: text("notas"),
  createdBy: uuid("created_by").notNull(),
  source: registroSourceEnum("source").notNull().default("web"),
  isVoided: boolean("is_voided").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** HU14 RF14: evaluación de vivero (RN38–40; pct_germinacion generada en Postgres). */
export const evaluacionesVivero = pgTable("evaluaciones_vivero", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  germinacionId: uuid("germinacion_id")
    .notNull()
    .references(() => registrosGerminacion.id, { onDelete: "restrict" }),
  totalInicial: integer("total_inicial").notNull(),
  unidadesGerminadas: integer("unidades_germinadas").notNull(),
  unidadesDescartadas: integer("unidades_descartadas").notNull(),
  pctGerminacion: numeric("pct_germinacion", { precision: 7, scale: 4 }).notNull(),
  motivoDescarte: text("motivo_descarte"),
  observacionesFitosanitarias: text("observaciones_fitosanitarias"),
  concepto: viveroConceptoEvaluacionEnum("concepto").notNull(),
  evidenciaUrls: jsonb("evidencia_urls").notNull().default(sql`'[]'::jsonb`),
  createdBy: uuid("created_by").notNull(),
  source: registroSourceEnum("source").notNull().default("web"),
  isVoided: boolean("is_voided").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** HU29: remisión de despacho de fruta cosechada */
export const remisionesDespacho = pgTable(
  "remisiones_despacho",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fincaId: uuid("finca_id")
      .notNull()
      .references(() => fincas.id, { onDelete: "restrict" }),
    numeroRemision: text("numero_remision").notNull(),
    fechaDespacho: date("fecha_despacho").notNull(),
    horaSalida: timestamp("hora_salida", { withTimezone: true })
      .notNull()
      .defaultNow(),
    placaVehiculo: text("placa_vehiculo").notNull(),
    conductorIdentificacion: text("conductor_identificacion").notNull(),
    conductorNombre: text("conductor_nombre"),
    pesoTotalKg: numeric("peso_total_kg", { precision: 14, scale: 3 }).notNull(),
    totalRacimos: integer("total_racimos").notNull(),
    capacidadVehiculoKg: numeric("capacidad_vehiculo_kg", {
      precision: 14,
      scale: 3,
    }),
    latitud: numeric("latitud", { precision: 10, scale: 7 }),
    longitud: numeric("longitud", { precision: 10, scale: 7 }),
    destino: text("destino"),
    createdBy: uuid("created_by").notNull(),
    source: registroSourceEnum("source").notNull().default("web"),
    isVoided: boolean("is_voided").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("remisiones_despacho_finca_numero_uidx").on(
      t.fincaId,
      t.numeroRemision
    ),
  ]
);

export const cosechasRff = pgTable("cosechas_rff", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  fecha: date("fecha").notNull(),
  pesoKg: numeric("peso_kg", { precision: 14, scale: 3 }).notNull(),
  conteoRacimos: integer("conteo_racimos").notNull(),
  madurezFrutosCaidosMin: integer("madurez_frutos_caidos_min"),
  madurezFrutosCaidosMax: integer("madurez_frutos_caidos_max"),
  observacionesCalidad: text("observaciones_calidad"),
  latitud: numeric("latitud", { precision: 10, scale: 7 }),
  longitud: numeric("longitud", { precision: 10, scale: 7 }),
  estadoAcopio: cosechaEstadoAcopioEnum("estado_acopio")
    .notNull()
    .default("en_centro_acopio"),
  remisionId: uuid("remision_id").references(() => remisionesDespacho.id, {
    onDelete: "restrict",
  }),
  createdBy: uuid("created_by").notNull(),
  source: registroSourceEnum("source").notNull().default("web"),
  isVoided: boolean("is_voided").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const analisisSuelo = pgTable("analisis_suelo", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  fechaAnalisis: date("fecha_analisis").notNull(),
  ph: numeric("ph", { precision: 4, scale: 2 }),
  humedadPct: numeric("humedad_pct", { precision: 5, scale: 2 }),
  compactacion: text("compactacion"),
  fertilidadCompleta: text("fertilidad_completa"),
  textura: text("textura"),
  aluminio: numeric("aluminio", { precision: 10, scale: 3 }),
  cic: numeric("cic", { precision: 10, scale: 2 }),
  materiaOrganicaPct: numeric("materia_organica_pct", { precision: 6, scale: 2 }),
  drenajeCampo: text("drenaje_campo"),
  nutrientes: jsonb("nutrientes"),
  archivoUrl: text("archivo_url"),
  notas: text("notas"),
  createdBy: uuid("created_by").notNull(),
  source: registroSourceEnum("source").notNull().default("web"),
  isVoided: boolean("is_voided").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const alertasFitosanitarias = pgTable("alertas_fitosanitarias", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  catalogoItemId: uuid("catalogo_item_id").references(() => catalogoItems.id, {
    onDelete: "set null",
  }),
  severidad: nivelSeveridadEnum("severidad").notNull(),
  descripcion: text("descripcion"),
  evidenciaUrls: jsonb("evidencia_urls").notNull().default(sql`'[]'::jsonb`),
  loteEstadoAlerta: boolean("lote_estado_alerta").notNull().default(false),
  validacionEstado: text("validacion_estado").notNull().default("pendiente"),
  validacionDiagnostico: text("validacion_diagnostico"),
  validadoPor: uuid("validado_por").references(() => profiles.id, {
    onDelete: "set null",
  }),
  validadoEn: timestamp("validado_en", { withTimezone: true }),
  createdBy: uuid("created_by").notNull(),
  source: registroSourceEnum("source").notNull().default("web"),
  isVoided: boolean("is_voided").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ordenesControl = pgTable("ordenes_control", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  alertaId: uuid("alerta_id")
    .notNull()
    .references(() => alertasFitosanitarias.id, { onDelete: "restrict" }),
  insumoCatalogoId: uuid("insumo_catalogo_id")
    .notNull()
    .references(() => catalogoItems.id, { onDelete: "restrict" }),
  dosisRecomendada: text("dosis_recomendada").notNull(),
  observacionesTecnico: text("observaciones_tecnico"),
  estado: ordenControlEstadoEnum("estado").notNull().default("autorizada"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const aplicacionesFitosanitarias = pgTable(
  "aplicaciones_fitosanitarias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ordenId: uuid("orden_id")
      .notNull()
      .references(() => ordenesControl.id, { onDelete: "restrict" }),
    fincaId: uuid("finca_id")
      .notNull()
      .references(() => fincas.id, { onDelete: "restrict" }),
    loteId: uuid("lote_id")
      .notNull()
      .references(() => lotes.id, { onDelete: "restrict" }),
    catalogoItemId: uuid("catalogo_item_id")
      .notNull()
      .references(() => catalogoItems.id, { onDelete: "restrict" }),
    fechaAplicacion: date("fecha_aplicacion").notNull(),
    cantidadAplicada: numeric("cantidad_aplicada", {
      precision: 14,
      scale: 4,
    }).notNull(),
    unidadMedida: text("unidad_medida"),
    eppConfirmado: boolean("epp_confirmado").notNull().default(false),
    latitud: numeric("latitud", { precision: 10, scale: 7 }),
    longitud: numeric("longitud", { precision: 10, scale: 7 }),
    notas: text("notas"),
    createdBy: uuid("created_by").notNull(),
    source: registroSourceEnum("source").notNull().default("web"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

/** HU22 RF22: aplicación de fertilización ejecutada en campo */
export const aplicacionesFertilizacion = pgTable("aplicaciones_fertilizacion", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => planesNutricion.id, { onDelete: "restrict" }),
  planItemId: uuid("plan_item_id")
    .notNull()
    .references(() => planesNutricionItems.id, { onDelete: "restrict" }),
  catalogoInsumoId: uuid("catalogo_insumo_id")
    .notNull()
    .references(() => catalogoItems.id, { onDelete: "restrict" }),
  fechaAplicacion: date("fecha_aplicacion").notNull(),
  cantidadAplicada: numeric("cantidad_aplicada", {
    precision: 14,
    scale: 4,
  }).notNull(),
  dosisProgramada: numeric("dosis_programada", {
    precision: 14,
    scale: 4,
  }).notNull(),
  dosisUnidad: planNutricionDosisUnidadEnum("dosis_unidad").notNull(),
  desviacionPct: numeric("desviacion_pct", { precision: 6, scale: 2 })
    .notNull()
    .default("0"),
  justificacionDesviacion: text("justificacion_desviacion"),
  metodoAplicacion: metodoAplicacionFertilizacionEnum("metodo_aplicacion").notNull(),
  unidadMedida: text("unidad_medida"),
  latitud: numeric("latitud", { precision: 10, scale: 7 }).notNull(),
  longitud: numeric("longitud", { precision: 10, scale: 7 }).notNull(),
  notas: text("notas"),
  createdBy: uuid("created_by").notNull(),
  source: registroSourceEnum("source").notNull().default("web"),
  isVoided: boolean("is_voided").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const inventarioHerramientas = pgTable(
  "inventario_herramientas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fincaId: uuid("finca_id")
      .notNull()
      .references(() => fincas.id, { onDelete: "restrict" }),
    catalogoItemId: uuid("catalogo_item_id")
      .notNull()
      .references(() => catalogoItems.id, { onDelete: "restrict" }),
    codigo: text("codigo").notNull(),
    estado: inventarioHerramientaEstadoEnum("estado").notNull().default("disponible"),
    assignedTo: uuid("assigned_to").references(() => profiles.id, {
      onDelete: "set null",
    }),
    notasDano: text("notas_dano"),
    createdBy: uuid("created_by").notNull(),
    source: registroSourceEnum("source").notNull().default("web"),
    isVoided: boolean("is_voided").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("inventario_herramientas_finca_codigo_lower_uidx").on(
      t.fincaId,
      sql`lower(${t.codigo})`
    ),
  ]
);

export const censosSanitarios = pgTable("censos_sanitarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  fincaId: uuid("finca_id")
    .notNull()
    .references(() => fincas.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  catalogoItemId: uuid("catalogo_item_id")
    .notNull()
    .references(() => catalogoItems.id, { onDelete: "restrict" }),
  fechaCenso: date("fecha_censo").notNull(),
  palmasInspeccionadas: integer("palmas_inspeccionadas").notNull(),
  palmasAfectadas: integer("palmas_afectadas").notNull().default(0),
  incidenciaPct: numeric("incidencia_pct", { precision: 6, scale: 2 }).notNull(),
  superaUmbral: boolean("supera_umbral").notNull().default(false),
  notas: text("notas"),
  createdBy: uuid("created_by").notNull(),
  source: registroSourceEnum("source").notNull().default("web"),
  isVoided: boolean("is_voided").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
