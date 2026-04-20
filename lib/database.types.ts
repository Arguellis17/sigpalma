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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          ubicacion?: string | null;
          area_ha: number | string;
          propietario?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          ubicacion?: string | null;
          area_ha?: number | string;
          propietario?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Database["public"]["Enums"]["user_role"];
          finca_id: string | null;
          is_active: boolean;
          documento_identidad: string | null;
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
          tipo: string;
          fecha_ejecucion: string;
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
          tipo: string;
          fecha_ejecucion: string;
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
          tipo?: string;
          fecha_ejecucion?: string;
          notas?: string | null;
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          created_by?: string;
          source?: Database["public"]["Enums"]["registro_source"];
          is_voided?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      alertas_fitosanitarias: {
        Row: {
          id: string;
          finca_id: string;
          lote_id: string;
          catalogo_item_id: string | null;
          severidad: Database["public"]["Enums"]["nivel_severidad"];
          descripcion: string | null;
          lote_estado_alerta: boolean;
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
          severidad: Database["public"]["Enums"]["nivel_severidad"];
          descripcion?: string | null;
          lote_estado_alerta?: boolean;
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
          severidad?: Database["public"]["Enums"]["nivel_severidad"];
          descripcion?: string | null;
          lote_estado_alerta?: boolean;
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
    };
    Enums: {
      user_role: "superadmin" | "admin" | "agronomo" | "operario";
      registro_source: "web" | "mobile" | "api";
      catalogo_categoria:
        | "plaga"
        | "enfermedad"
        | "insumo"
        | "material_genetico"
        | "otro";
      nivel_severidad: "baja" | "media" | "alta" | "critica";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
