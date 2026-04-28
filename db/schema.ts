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
  "en_produccion",
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
