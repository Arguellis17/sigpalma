-- SIG-Palma: core schema, RLS, auth profile trigger, storage bucket
-- Apply with: supabase db push / supabase migration up (or SQL editor on hosted project)

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('admin', 'agronomo', 'operario');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registro_source') THEN
    CREATE TYPE public.registro_source AS ENUM ('web', 'mobile', 'api');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'catalogo_categoria') THEN
    CREATE TYPE public.catalogo_categoria AS ENUM (
      'plaga',
      'enfermedad',
      'insumo',
      'material_genetico',
      'otro'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nivel_severidad') THEN
    CREATE TYPE public.nivel_severidad AS ENUM ('baja', 'media', 'alta', 'critica');
  END IF;
END$$;

-- -----------------------------------------------------------------------------
-- Fincas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fincas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  ubicacion text,
  area_ha numeric(12, 4) NOT NULL CHECK (area_ha > 0),
  propietario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fincas_nombre_unique ON public.fincas (lower(nombre));

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'operario',
  finca_id uuid REFERENCES public.fincas (id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_finca_id_idx ON public.profiles (finca_id);

-- -----------------------------------------------------------------------------
-- Lotes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  codigo text NOT NULL,
  area_ha numeric(12, 4) NOT NULL CHECK (area_ha > 0),
  anio_siembra integer NOT NULL CHECK (anio_siembra >= 1900 AND anio_siembra <= 2100),
  material_genetico text,
  densidad_palmas_ha numeric(10, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (finca_id, codigo)
);

CREATE INDEX IF NOT EXISTS lotes_finca_id_idx ON public.lotes (finca_id);

-- -----------------------------------------------------------------------------
-- Catálogo maestro (referencia)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalogo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria public.catalogo_categoria NOT NULL,
  nombre text NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalogo_items_categoria_nombre_lower
  ON public.catalogo_items (categoria, lower(nombre));

-- -----------------------------------------------------------------------------
-- Labores agronómicas (ejecución)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.labores_agronomicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  tipo text NOT NULL,
  fecha_ejecucion date NOT NULL,
  notas text,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS labores_finca_fecha_idx ON public.labores_agronomicas (finca_id, fecha_ejecucion DESC);

-- -----------------------------------------------------------------------------
-- Cosecha RFF
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cosechas_rff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  fecha date NOT NULL,
  peso_kg numeric(14, 3) NOT NULL CHECK (peso_kg > 0),
  conteo_racimos integer NOT NULL CHECK (conteo_racimos > 0),
  madurez_frutos_caidos_min integer CHECK (madurez_frutos_caidos_min IS NULL OR madurez_frutos_caidos_min >= 0),
  madurez_frutos_caidos_max integer CHECK (madurez_frutos_caidos_max IS NULL OR madurez_frutos_caidos_max >= 0),
  observaciones_calidad text,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cosechas_finca_fecha_idx ON public.cosechas_rff (finca_id, fecha DESC);

-- -----------------------------------------------------------------------------
-- Alertas fitosanitarias
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alertas_fitosanitarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  catalogo_item_id uuid REFERENCES public.catalogo_items (id) ON DELETE SET NULL,
  severidad public.nivel_severidad NOT NULL,
  descripcion text,
  lote_estado_alerta boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alertas_finca_created_idx ON public.alertas_fitosanitarias (finca_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Triggers: lote/finca consistency
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_lote_matches_finca()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.lotes l
    WHERE l.id = NEW.lote_id
      AND l.finca_id = NEW.finca_id
  ) THEN
    RAISE EXCEPTION 'lote_id no pertenece a finca_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_labores_lote_finca ON public.labores_agronomicas;
CREATE TRIGGER trg_labores_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.labores_agronomicas
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lote_matches_finca();

DROP TRIGGER IF EXISTS trg_cosechas_lote_finca ON public.cosechas_rff;
CREATE TRIGGER trg_cosechas_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.cosechas_rff
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lote_matches_finca();

DROP TRIGGER IF EXISTS trg_alertas_lote_finca ON public.alertas_fitosanitarias;
CREATE TRIGGER trg_alertas_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.alertas_fitosanitarias
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lote_matches_finca();

-- Sum of lot areas <= finca area (warning-level: enforced on insert/update lotes)
CREATE OR REPLACE FUNCTION public.enforce_lotes_area_vs_finca()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  finca_area numeric;
  sum_lotes numeric;
  fid uuid;
BEGIN
  fid := COALESCE(NEW.finca_id, OLD.finca_id);
  SELECT f.area_ha INTO finca_area FROM public.fincas f WHERE f.id = fid;
  IF finca_area IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT COALESCE(SUM(l.area_ha), 0) INTO sum_lotes FROM public.lotes l WHERE l.finca_id = fid;
  IF sum_lotes > finca_area THEN
    RAISE EXCEPTION 'la suma de hectáreas de lotes (%) excede el área de la finca (%)', sum_lotes, finca_area;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lotes_area_check ON public.lotes;
CREATE TRIGGER trg_lotes_area_check
  AFTER INSERT OR UPDATE OF area_ha, finca_id OR DELETE ON public.lotes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lotes_area_vs_finca();

-- -----------------------------------------------------------------------------
-- Auth: new user → profile
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'operario'::public.user_role
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Helper: is admin (for policies)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = true
      AND p.role = 'admin'::public.user_role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_finca_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.finca_id
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.is_active = true;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.fincas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labores_agronomicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosechas_rff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_fitosanitarias ENABLE ROW LEVEL SECURITY;

-- Fincas
DROP POLICY IF EXISTS fincas_select ON public.fincas;
CREATE POLICY fincas_select ON public.fincas
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS fincas_insert ON public.fincas;
CREATE POLICY fincas_insert ON public.fincas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS fincas_update ON public.fincas;
CREATE POLICY fincas_update ON public.fincas
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Lotes
DROP POLICY IF EXISTS lotes_select ON public.lotes;
CREATE POLICY lotes_select ON public.lotes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS lotes_insert ON public.lotes;
CREATE POLICY lotes_insert ON public.lotes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('admin'::public.user_role, 'agronomo'::public.user_role)
      )
    )
  );

DROP POLICY IF EXISTS lotes_update ON public.lotes;
CREATE POLICY lotes_update ON public.lotes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('admin'::public.user_role, 'agronomo'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR finca_id = public.current_user_finca_id()
  );

-- Catálogo: readable by authenticated; write admin/agronomo
DROP POLICY IF EXISTS catalogo_select ON public.catalogo_items;
CREATE POLICY catalogo_select ON public.catalogo_items
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS catalogo_write ON public.catalogo_items;
CREATE POLICY catalogo_write ON public.catalogo_items
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role = 'agronomo'::public.user_role
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role = 'agronomo'::public.user_role
    )
  );

-- Labores
DROP POLICY IF EXISTS labores_select ON public.labores_agronomicas;
CREATE POLICY labores_select ON public.labores_agronomicas
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS labores_insert ON public.labores_agronomicas;
CREATE POLICY labores_insert ON public.labores_agronomicas
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_admin()
    AND finca_id = public.current_user_finca_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
    )
  );

DROP POLICY IF EXISTS labores_update ON public.labores_agronomicas;
CREATE POLICY labores_update ON public.labores_agronomicas
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR finca_id = public.current_user_finca_id()
  );

-- Cosechas
DROP POLICY IF EXISTS cosechas_select ON public.cosechas_rff;
CREATE POLICY cosechas_select ON public.cosechas_rff
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS cosechas_insert ON public.cosechas_rff;
CREATE POLICY cosechas_insert ON public.cosechas_rff
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_admin()
    AND finca_id = public.current_user_finca_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
    )
  );

DROP POLICY IF EXISTS cosechas_update ON public.cosechas_rff;
CREATE POLICY cosechas_update ON public.cosechas_rff
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR finca_id = public.current_user_finca_id()
  );

-- Alertas
DROP POLICY IF EXISTS alertas_select ON public.alertas_fitosanitarias;
CREATE POLICY alertas_select ON public.alertas_fitosanitarias
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS alertas_insert ON public.alertas_fitosanitarias;
CREATE POLICY alertas_insert ON public.alertas_fitosanitarias
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_admin()
    AND finca_id = public.current_user_finca_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
    )
  );

DROP POLICY IF EXISTS alertas_update ON public.alertas_fitosanitarias;
CREATE POLICY alertas_update ON public.alertas_fitosanitarias
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
      )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR finca_id = public.current_user_finca_id()
  );

-- -----------------------------------------------------------------------------
-- Storage: bucket evidencia-tecnica
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('evidencia-tecnica', 'evidencia-tecnica', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS evidencia_select ON storage.objects;
CREATE POLICY evidencia_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'evidencia-tecnica');

DROP POLICY IF EXISTS evidencia_insert ON storage.objects;
CREATE POLICY evidencia_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidencia-tecnica'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('admin'::public.user_role, 'agronomo'::public.user_role)
    )
  );

DROP POLICY IF EXISTS evidencia_update ON storage.objects;
CREATE POLICY evidencia_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'evidencia-tecnica'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('admin'::public.user_role, 'agronomo'::public.user_role)
    )
  );

DROP POLICY IF EXISTS evidencia_delete ON storage.objects;
CREATE POLICY evidencia_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'evidencia-tecnica'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role = 'admin'::public.user_role
    )
  );
