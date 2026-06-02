export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      fincas: {
        Row: {
          id: string;
          nombre: string;
          ubicacion: string | null;
          area_ha: string;
          propietario: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          ubicacion?: string | null;
          area_ha: number | string;
          propietario?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          ubicacion?: string | null;
          area_ha?: number | string;
          propietario?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      finca_audit_events: {
        Row: {
          id: string;
          finca_id: string;
          actor_id: string;
          action_key: string;
          titulo: string;
          detalle: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          actor_id: string;
          action_key: string;
          titulo: string;
          detalle?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          actor_id?: string;
          action_key?: string;
          titulo?: string;
          detalle?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finca_audit_events_finca_id_fkey";
            columns: ["finca_id"];
            isOneToOne: false;
            referencedRelation: "fincas";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Database["public"]["Enums"]["user_role"];
          finca_id: string | null;
          is_active: boolean;
          documento_identidad: string | null;
          must_change_password: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          finca_id?: string | null;
          is_active?: boolean;
          documento_identidad?: string | null;
          must_change_password?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: Database["public"]["Enums"]["user_role"];
          finca_id?: string | null;
          is_active?: boolean;
          documento_identidad?: string | null;
          must_change_password?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_finca_id_fkey";
            columns: ["finca_id"];
            isOneToOne: false;
            referencedRelation: "fincas";
            referencedColumns: ["id"];
          },
        ];
      };
      lotes: {
        Row: {
          id: string;
          finca_id: string;
          codigo: string;
          area_ha: string;
          anio_siembra: number;
          material_genetico: string | null;
          densidad_palmas_ha: string | null;
          pendiente_pct: string | null;
          activo: boolean;
          estado_cultivo:
            | "vacante"
            | "disponible"
            | "planificado_siembra"
            | "listo_para_siembra"
            | "en_produccion";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          codigo: string;
          area_ha: number | string;
          anio_siembra: number;
          material_genetico?: string | null;
          densidad_palmas_ha?: number | string | null;
          pendiente_pct?: number | string | null;
          activo?: boolean;
          estado_cultivo?:
            | "vacante"
            | "disponible"
            | "planificado_siembra"
            | "listo_para_siembra"
            | "en_produccion";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          codigo?: string;
          area_ha?: number | string;
          anio_siembra?: number;
          material_genetico?: string | null;
          densidad_palmas_ha?: number | string | null;
          pendiente_pct?: number | string | null;
          activo?: boolean;
          estado_cultivo?:
            | "vacante"
            | "disponible"
            | "planificado_siembra"
            | "listo_para_siembra"
            | "en_produccion";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lotes_finca_id_fkey";
            columns: ["finca_id"];
            isOneToOne: false;
            referencedRelation: "fincas";
            referencedColumns: ["id"];
          },
        ];
      };
      planes_siembra: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          catalogo_material_id: string;
          fecha_proyectada: string;
          confirmacion_erosion: boolean;
          notas: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          lote_id: string;
          catalogo_material_id: string;
          fecha_proyectada: string;
          confirmacion_erosion?: boolean;
          notas?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          lote_id?: string;
          catalogo_material_id?: string;
          fecha_proyectada?: string;
          confirmacion_erosion?: boolean;
          notas?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planes_siembra_finca_id_fkey";
            columns: ["finca_id"];
            isOneToOne: false;
            referencedRelation: "fincas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planes_siembra_lote_id_fkey";
            columns: ["lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planes_siembra_catalogo_material_id_fkey";
            columns: ["catalogo_material_id"];
            isOneToOne: false;
            referencedRelation: "catalogo_items";
            referencedColumns: ["id"];
          },
        ];
      };
      preparaciones_terreno: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          plan_siembra_id: string;
          pendiente_final_pct: number;
          actividades: string[];
          estado: Database["public"]["Enums"]["preparacion_terreno_estado"];
          notas: string | null;
          validado_por: string | null;
          validado_en: string | null;
          observacion_validacion: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          lote_id: string;
          plan_siembra_id: string;
          pendiente_final_pct: number;
          actividades: string[];
          estado: Database["public"]["Enums"]["preparacion_terreno_estado"];
          notas?: string | null;
          validado_por?: string | null;
          validado_en?: string | null;
          observacion_validacion?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          lote_id?: string;
          plan_siembra_id?: string;
          pendiente_final_pct?: number;
          actividades?: string[];
          estado?: Database["public"]["Enums"]["preparacion_terreno_estado"];
          notas?: string | null;
          validado_por?: string | null;
          validado_en?: string | null;
          observacion_validacion?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      registros_siembra: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          plan_siembra_id: string;
          preparacion_terreno_id: string;
          catalogo_material_id: string;
          fecha_siembra: string;
          cantidad_palmas: number;
          confirmacion_profundidad: boolean;
          confirmacion_orientacion: boolean;
          notas: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          lote_id: string;
          plan_siembra_id: string;
          preparacion_terreno_id: string;
          catalogo_material_id: string;
          fecha_siembra: string;
          cantidad_palmas: number;
          confirmacion_profundidad?: boolean;
          confirmacion_orientacion?: boolean;
          notas?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          lote_id?: string;
          plan_siembra_id?: string;
          preparacion_terreno_id?: string;
          catalogo_material_id?: string;
          fecha_siembra?: string;
          cantidad_palmas?: number;
          confirmacion_profundidad?: boolean;
          confirmacion_orientacion?: boolean;
          notas?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      planes_nutricion: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          nombre: string | null;
          fecha_inicio: string | null;
          fecha_fin: string | null;
          notas: string | null;
          locked_at: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          lote_id: string;
          nombre?: string | null;
          fecha_inicio?: string | null;
          fecha_fin?: string | null;
          notas?: string | null;
          locked_at?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          lote_id?: string;
          nombre?: string | null;
          fecha_inicio?: string | null;
          fecha_fin?: string | null;
          notas?: string | null;
          locked_at?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planes_nutricion_finca_id_fkey";
            columns: ["finca_id"];
            isOneToOne: false;
            referencedRelation: "fincas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planes_nutricion_lote_id_fkey";
            columns: ["lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["id"];
          },
        ];
      };
      planes_nutricion_items: {
        Row: {
          id: string;
          plan_id: string;
          catalogo_insumo_id: string;
          dosis_cantidad: string;
          dosis_unidad: Database["public"]["Enums"]["plan_nutricion_dosis_unidad"];
          frecuencia: Database["public"]["Enums"]["plan_nutricion_frecuencia"];
          fecha_objetivo: string | null;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          catalogo_insumo_id: string;
          dosis_cantidad: number | string;
          dosis_unidad: Database["public"]["Enums"]["plan_nutricion_dosis_unidad"];
          frecuencia?: Database["public"]["Enums"]["plan_nutricion_frecuencia"];
          fecha_objetivo?: string | null;
          notas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          catalogo_insumo_id?: string;
          dosis_cantidad?: number | string;
          dosis_unidad?: Database["public"]["Enums"]["plan_nutricion_dosis_unidad"];
          frecuencia?: Database["public"]["Enums"]["plan_nutricion_frecuencia"];
          fecha_objetivo?: string | null;
          notas?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planes_nutricion_items_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "planes_nutricion";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planes_nutricion_items_catalogo_insumo_id_fkey";
            columns: ["catalogo_insumo_id"];
            isOneToOne: false;
            referencedRelation: "catalogo_items";
            referencedColumns: ["id"];
          },
        ];
      };
      planes_riego_items: {
        Row: {
          id: string;
          plan_id: string;
          descripcion: string;
          intervalo_dias: number | null;
          proxima_fecha: string;
          volumen_o_tiempo: string | null;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          descripcion: string;
          intervalo_dias?: number | null;
          proxima_fecha: string;
          volumen_o_tiempo?: string | null;
          notas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          descripcion?: string;
          intervalo_dias?: number | null;
          proxima_fecha?: string;
          volumen_o_tiempo?: string | null;
          notas?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planes_riego_items_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "planes_nutricion";
            referencedColumns: ["id"];
          },
        ];
      };
      monitoreos_fitosanitarios_programados: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          fecha_inspeccion: string;
          assigned_to: string;
          created_by: string;
          notas: string | null;
          estado: Database["public"]["Enums"]["monitoreo_fitosanitario_estado"];
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          lote_id: string;
          fecha_inspeccion: string;
          assigned_to: string;
          created_by: string;
          notas?: string | null;
          estado?: Database["public"]["Enums"]["monitoreo_fitosanitario_estado"];
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          lote_id?: string;
          fecha_inspeccion?: string;
          assigned_to?: string;
          created_by?: string;
          notas?: string | null;
          estado?: Database["public"]["Enums"]["monitoreo_fitosanitario_estado"];
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monitoreos_fitosanitarios_programados_finca_id_fkey";
            columns: ["finca_id"];
            isOneToOne: false;
            referencedRelation: "fincas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "monitoreos_fitosanitarios_programados_lote_id_fkey";
            columns: ["lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "monitoreos_fitosanitarios_programados_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      registros_germinacion: {
        Row: {
          id: string;
          finca_id: string;
          catalogo_material_id: string;
          lote_id: string | null;
          fecha_tratamiento: string;
          temperatura_max_c: string;
          dias_tratamiento: number;
          notas: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          catalogo_material_id: string;
          lote_id?: string | null;
          fecha_tratamiento: string;
          temperatura_max_c: number | string;
          dias_tratamiento: number;
          notas?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          catalogo_material_id?: string;
          lote_id?: string | null;
          fecha_tratamiento?: string;
          temperatura_max_c?: number | string;
          dias_tratamiento?: number;
          notas?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registros_germinacion_finca_id_fkey";
            columns: ["finca_id"];
            isOneToOne: false;
            referencedRelation: "fincas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registros_germinacion_catalogo_material_id_fkey";
            columns: ["catalogo_material_id"];
            isOneToOne: false;
            referencedRelation: "catalogo_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registros_germinacion_lote_id_fkey";
            columns: ["lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluaciones_vivero: {
        Row: {
          id: string;
          finca_id: string;
          germinacion_id: string;
          total_inicial: number;
          unidades_germinadas: number;
          unidades_descartadas: number;
          pct_germinacion: string;
          motivo_descarte: string | null;
          observaciones_fitosanitarias: string | null;
          concepto: Database["public"]["Enums"]["vivero_concepto_evaluacion"];
          evidencia_urls: Json;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          germinacion_id: string;
          total_inicial: number;
          unidades_germinadas: number;
          unidades_descartadas: number;
          motivo_descarte?: string | null;
          observaciones_fitosanitarias?: string | null;
          concepto: Database["public"]["Enums"]["vivero_concepto_evaluacion"];
          evidencia_urls?: Json;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          germinacion_id?: string;
          total_inicial?: number;
          unidades_germinadas?: number;
          unidades_descartadas?: number;
          motivo_descarte?: string | null;
          observaciones_fitosanitarias?: string | null;
          concepto?: Database["public"]["Enums"]["vivero_concepto_evaluacion"];
          evidencia_urls?: Json;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluaciones_vivero_finca_id_fkey";
            columns: ["finca_id"];
            isOneToOne: false;
            referencedRelation: "fincas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluaciones_vivero_germinacion_id_fkey";
            columns: ["germinacion_id"];
            isOneToOne: false;
            referencedRelation: "registros_germinacion";
            referencedColumns: ["id"];
          },
        ];
      };
      catalogo_items: {
        Row: {
          id: string;
          categoria: Database["public"]["Enums"]["catalogo_categoria"];
          nombre: string;
          descripcion: string | null;
          activo: boolean;
          subcategoria: string | null;
          unidad_medida: string | null;
          proveedor: string | null;
          anio_adquisicion: number | null;
          sintomas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          categoria: Database["public"]["Enums"]["catalogo_categoria"];
          nombre: string;
          descripcion?: string | null;
          activo?: boolean;
          subcategoria?: string | null;
          unidad_medida?: string | null;
          proveedor?: string | null;
          anio_adquisicion?: number | null;
          sintomas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          categoria?: Database["public"]["Enums"]["catalogo_categoria"];
          nombre?: string;
          descripcion?: string | null;
          activo?: boolean;
          subcategoria?: string | null;
          unidad_medida?: string | null;
          proveedor?: string | null;
          anio_adquisicion?: number | null;
          sintomas?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      analisis_suelo: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          fecha_analisis: string;
          ph: string | null;
          humedad_pct: string | null;
          compactacion: string | null;
          fertilidad_completa: string | null;
          textura: string | null;
          aluminio: string | null;
          cic: string | null;
          materia_organica_pct: string | null;
          drenaje_campo: string | null;
          nutrientes: Json | null;
          archivo_url: string | null;
          notas: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          lote_id: string;
          fecha_analisis: string;
          ph?: number | string | null;
          humedad_pct?: number | string | null;
          compactacion?: string | null;
          fertilidad_completa?: string | null;
          textura?: string | null;
          aluminio?: number | string | null;
          cic?: number | string | null;
          materia_organica_pct?: number | string | null;
          drenaje_campo?: string | null;
          nutrientes?: Json | null;
          archivo_url?: string | null;
          notas?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          lote_id?: string;
          fecha_analisis?: string;
          ph?: number | string | null;
          humedad_pct?: number | string | null;
          compactacion?: string | null;
          fertilidad_completa?: string | null;
          textura?: string | null;
          aluminio?: number | string | null;
          cic?: number | string | null;
          materia_organica_pct?: number | string | null;
          drenaje_campo?: string | null;
          nutrientes?: Json | null;
          archivo_url?: string | null;
          notas?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analisis_suelo_finca_id_fkey";
            columns: ["finca_id"];
            isOneToOne: false;
            referencedRelation: "fincas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analisis_suelo_lote_id_fkey";
            columns: ["lote_id"];
            isOneToOne: false;
            referencedRelation: "lotes";
            referencedColumns: ["id"];
          },
        ];
      };
      labores_agronomicas: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          catalogo_item_id: string | null;
          tipo: string;
          fecha_ejecucion: string;
          cantidad_ejecutada: number | null;
          unidad_medida: string | null;
          ejecutada_at: string | null;
          notas: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          lote_id: string;
          catalogo_item_id?: string | null;
          tipo: string;
          fecha_ejecucion: string;
          cantidad_ejecutada?: number | null;
          unidad_medida?: string | null;
          ejecutada_at?: string | null;
          notas?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          lote_id?: string;
          catalogo_item_id?: string | null;
          tipo?: string;
          fecha_ejecucion?: string;
          cantidad_ejecutada?: number | null;
          unidad_medida?: string | null;
          ejecutada_at?: string | null;
          notas?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "labores_agronomicas_catalogo_item_id_fkey";
            columns: ["catalogo_item_id"];
            isOneToOne: false;
            referencedRelation: "catalogo_items";
            referencedColumns: ["id"];
          },
        ];
      };
      remisiones_despacho: {
        Row: {
          id: string;
          finca_id: string;
          numero_remision: string;
          fecha_despacho: string;
          hora_salida: string;
          placa_vehiculo: string;
          conductor_identificacion: string;
          conductor_nombre: string | null;
          peso_total_kg: string;
          total_racimos: number;
          capacidad_vehiculo_kg: string | null;
          latitud: number | null;
          longitud: number | null;
          destino: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          numero_remision: string;
          fecha_despacho: string;
          hora_salida?: string;
          placa_vehiculo: string;
          conductor_identificacion: string;
          conductor_nombre?: string | null;
          peso_total_kg: number | string;
          total_racimos: number;
          capacidad_vehiculo_kg?: number | string | null;
          latitud?: number | null;
          longitud?: number | null;
          destino?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          numero_remision?: string;
          fecha_despacho?: string;
          hora_salida?: string;
          placa_vehiculo?: string;
          conductor_identificacion?: string;
          conductor_nombre?: string | null;
          peso_total_kg?: number | string;
          total_racimos?: number;
          capacidad_vehiculo_kg?: number | string | null;
          latitud?: number | null;
          longitud?: number | null;
          destino?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "remisiones_despacho_finca_id_fkey";
            columns: ["finca_id"];
            isOneToOne: false;
            referencedRelation: "fincas";
            referencedColumns: ["id"];
          },
        ];
      };
      cosechas_rff: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          fecha: string;
          peso_kg: string;
          conteo_racimos: number;
          madurez_frutos_caidos_min: number | null;
          madurez_frutos_caidos_max: number | null;
          observaciones_calidad: string | null;
          latitud: number | null;
          longitud: number | null;
          estado_acopio: Database["public"]["Enums"]["cosecha_estado_acopio"];
          remision_id: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          lote_id: string;
          fecha: string;
          peso_kg: number | string;
          conteo_racimos: number;
          madurez_frutos_caidos_min?: number | null;
          madurez_frutos_caidos_max?: number | null;
          observaciones_calidad?: string | null;
          latitud?: number | null;
          longitud?: number | null;
          estado_acopio?: Database["public"]["Enums"]["cosecha_estado_acopio"];
          remision_id?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          lote_id?: string;
          fecha?: string;
          peso_kg?: number | string;
          conteo_racimos?: number;
          madurez_frutos_caidos_min?: number | null;
          madurez_frutos_caidos_max?: number | null;
          observaciones_calidad?: string | null;
          latitud?: number | null;
          longitud?: number | null;
          estado_acopio?: Database["public"]["Enums"]["cosecha_estado_acopio"];
          remision_id?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cosechas_rff_remision_id_fkey";
            columns: ["remision_id"];
            isOneToOne: false;
            referencedRelation: "remisiones_despacho";
            referencedColumns: ["id"];
          },
        ];
      };
      alertas_fitosanitarias: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          catalogo_item_id: string | null;
          severidad: Database["public"]["Enums"]["nivel_severidad"];
          descripcion: string | null;
          evidencia_urls: Json;
          lote_estado_alerta: boolean;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
          validacion_estado: string;
          validacion_diagnostico: string | null;
          validado_por: string | null;
          validado_en: string | null;
        };
        Insert: {
          id?: string;
          finca_id: string;
          lote_id: string;
          catalogo_item_id?: string | null;
          severidad: Database["public"]["Enums"]["nivel_severidad"];
          descripcion?: string | null;
          evidencia_urls?: Json;
          lote_estado_alerta?: boolean;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
          validacion_estado?: string;
          validacion_diagnostico?: string | null;
          validado_por?: string | null;
          validado_en?: string | null;
        };
        Update: {
          id?: string;
          finca_id?: string;
          lote_id?: string;
          catalogo_item_id?: string | null;
          severidad?: Database["public"]["Enums"]["nivel_severidad"];
          descripcion?: string | null;
          evidencia_urls?: Json;
          lote_estado_alerta?: boolean;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
          validacion_estado?: string;
          validacion_diagnostico?: string | null;
          validado_por?: string | null;
          validado_en?: string | null;
        };
        Relationships: [];
      };
      ordenes_control: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          alerta_id: string;
          insumo_catalogo_id: string;
          dosis_recomendada: string;
          observaciones_tecnico: string | null;
          estado: Database["public"]["Enums"]["orden_control_estado"];
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          lote_id: string;
          alerta_id: string;
          insumo_catalogo_id: string;
          dosis_recomendada: string;
          observaciones_tecnico?: string | null;
          estado?: Database["public"]["Enums"]["orden_control_estado"];
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          lote_id?: string;
          alerta_id?: string;
          insumo_catalogo_id?: string;
          dosis_recomendada?: string;
          observaciones_tecnico?: string | null;
          estado?: Database["public"]["Enums"]["orden_control_estado"];
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      aplicaciones_fitosanitarias: {
        Row: {
          id: string;
          orden_id: string;
          finca_id: string;
          lote_id: string;
          catalogo_item_id: string;
          fecha_aplicacion: string;
          cantidad_aplicada: string;
          unidad_medida: string | null;
          epp_confirmado: boolean;
          latitud: string | null;
          longitud: string | null;
          notas: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          orden_id: string;
          finca_id: string;
          lote_id: string;
          catalogo_item_id: string;
          fecha_aplicacion: string;
          cantidad_aplicada: number | string;
          unidad_medida?: string | null;
          epp_confirmado?: boolean;
          latitud?: number | string | null;
          longitud?: number | string | null;
          notas?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          orden_id?: string;
          finca_id?: string;
          lote_id?: string;
          catalogo_item_id?: string;
          fecha_aplicacion?: string;
          cantidad_aplicada?: number | string;
          unidad_medida?: string | null;
          epp_confirmado?: boolean;
          latitud?: number | string | null;
          longitud?: number | string | null;
          notas?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      aplicaciones_fertilizacion: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          plan_id: string;
          plan_item_id: string;
          catalogo_insumo_id: string;
          fecha_aplicacion: string;
          cantidad_aplicada: number;
          dosis_programada: number;
          dosis_unidad: Database["public"]["Enums"]["plan_nutricion_dosis_unidad"];
          desviacion_pct: number;
          justificacion_desviacion: string | null;
          metodo_aplicacion: Database["public"]["Enums"]["metodo_aplicacion_fertilizacion"];
          unidad_medida: string | null;
          latitud: number;
          longitud: number;
          notas: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          lote_id: string;
          plan_id: string;
          plan_item_id: string;
          catalogo_insumo_id: string;
          fecha_aplicacion: string;
          cantidad_aplicada: number;
          dosis_programada: number;
          dosis_unidad: Database["public"]["Enums"]["plan_nutricion_dosis_unidad"];
          desviacion_pct?: number;
          justificacion_desviacion?: string | null;
          metodo_aplicacion: Database["public"]["Enums"]["metodo_aplicacion_fertilizacion"];
          unidad_medida?: string | null;
          latitud: number;
          longitud: number;
          notas?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          lote_id?: string;
          plan_id?: string;
          plan_item_id?: string;
          catalogo_insumo_id?: string;
          fecha_aplicacion?: string;
          cantidad_aplicada?: number;
          dosis_programada?: number;
          dosis_unidad?: Database["public"]["Enums"]["plan_nutricion_dosis_unidad"];
          desviacion_pct?: number;
          justificacion_desviacion?: string | null;
          metodo_aplicacion?: Database["public"]["Enums"]["metodo_aplicacion_fertilizacion"];
          unidad_medida?: string | null;
          latitud?: number;
          longitud?: number;
          notas?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventario_herramientas: {
        Row: {
          id: string;
          finca_id: string;
          catalogo_item_id: string;
          codigo: string;
          estado: Database["public"]["Enums"]["inventario_herramienta_estado"];
          assigned_to: string | null;
          notas_dano: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          catalogo_item_id: string;
          codigo: string;
          estado?: Database["public"]["Enums"]["inventario_herramienta_estado"];
          assigned_to?: string | null;
          notas_dano?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          catalogo_item_id?: string;
          codigo?: string;
          estado?: Database["public"]["Enums"]["inventario_herramienta_estado"];
          assigned_to?: string | null;
          notas_dano?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      censos_sanitarios: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          catalogo_item_id: string;
          fecha_censo: string;
          palmas_inspeccionadas: number;
          palmas_afectadas: number;
          incidencia_pct: number | string;
          supera_umbral: boolean;
          notas: string | null;
          created_by: string;
          source: Database["public"]["Enums"]["registro_source"];
          is_voided: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          finca_id: string;
          lote_id: string;
          catalogo_item_id: string;
          fecha_censo?: string;
          palmas_inspeccionadas: number;
          palmas_afectadas?: number;
          incidencia_pct: number | string;
          supera_umbral?: boolean;
          notas?: string | null;
          created_by: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          finca_id?: string;
          lote_id?: string;
          catalogo_item_id?: string;
          fecha_censo?: string;
          palmas_inspeccionadas?: number;
          palmas_afectadas?: number;
          incidencia_pct?: number | string;
          supera_umbral?: boolean;
          notas?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_superadmin: { Args: Record<string, never>; Returns: boolean };
      current_user_finca_id: { Args: Record<string, never>; Returns: string | null };
      crear_remision_despacho: {
        Args: {
          p_finca_id: string;
          p_numero_remision: string;
          p_fecha_despacho: string;
          p_placa: string;
          p_conductor_id: string;
          p_conductor_nombre: string | null;
          p_peso_total: number;
          p_total_racimos: number;
          p_capacidad: number | null;
          p_lat: number | null;
          p_lng: number | null;
          p_destino: string | null;
          p_created_by: string;
          p_source: Database["public"]["Enums"]["registro_source"];
          p_cosecha_ids: string[];
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: "superadmin" | "admin" | "agronomo" | "operario";
      registro_source: "web" | "mobile" | "api";
      catalogo_categoria:
        | "plaga"
        | "enfermedad"
        | "insumo"
        | "material_genetico"
        | "otro"
        | "labor";
      nivel_severidad: "baja" | "media" | "alta" | "critica";
      orden_control_estado: "autorizada" | "cerrada" | "cancelada";
      lote_estado_cultivo:
        | "vacante"
        | "disponible"
        | "planificado_siembra"
        | "listo_para_siembra"
        | "en_produccion";
      plan_nutricion_dosis_unidad: "por_ha" | "por_palma";
      plan_nutricion_frecuencia:
        | "once"
        | "semanal"
        | "quincenal"
        | "mensual"
        | "personalizado";
      monitoreo_fitosanitario_estado: "pendiente" | "completada" | "anulada";
      vivero_concepto_evaluacion: "apto_trasplante" | "no_apto";
      inventario_herramienta_estado: "disponible" | "en_uso" | "danada" | "perdida";
      metodo_aplicacion_fertilizacion: "manual" | "equipada" | "fertirriego" | "otro";
      preparacion_terreno_estado: "aprobado" | "pendiente_validacion_tecnico";
      cosecha_estado_acopio: "en_centro_acopio" | "en_transito";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
