-- CR-05 / PU13: cronogramas de labores recurrentes.
-- La regla vive en cronogramas_labores; las ocurrencias se materializan como labores normales en
-- labores_agronomicas (agenda, operario, cosecha y reportes no cambian). Migración aditiva.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cronograma_frecuencia') THEN
    CREATE TYPE public.cronograma_frecuencia AS ENUM ('diaria', 'semanal', 'mensual');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.cronogramas_labores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  lote_id uuid NOT NULL REFERENCES public.lotes (id) ON DELETE RESTRICT,
  catalogo_item_id uuid NOT NULL REFERENCES public.catalogo_items (id) ON DELETE RESTRICT,
  assigned_to uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  frecuencia public.cronograma_frecuencia NOT NULL,
  intervalo integer NOT NULL DEFAULT 1 CHECK (intervalo BETWEEN 1 AND 52),
  -- ISO: 1 = lunes … 7 = domingo. Solo frecuencia semanal.
  dias_semana smallint[] NOT NULL DEFAULT '{}',
  fecha_inicio date NOT NULL,
  fecha_fin date,
  notas text,
  activo boolean NOT NULL DEFAULT true,
  -- Última fecha ya evaluada: una labor anulada a mano no se vuelve a generar.
  generado_hasta date,
  is_voided boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cronogramas_labores_vigencia_chk CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
  CONSTRAINT cronogramas_labores_dias_chk CHECK (
    frecuencia <> 'semanal' OR (cardinality(dias_semana) > 0 AND dias_semana <@ ARRAY[1,2,3,4,5,6,7]::smallint[])
  )
);

COMMENT ON TABLE public.cronogramas_labores IS
  'Reglas de recurrencia: generan labores programadas automáticamente (CR-05).';

-- Una sola regla activa por lote y tipo de labor.
CREATE UNIQUE INDEX IF NOT EXISTS cronogramas_labores_activo_uq
  ON public.cronogramas_labores (lote_id, catalogo_item_id)
  WHERE is_voided = false AND activo = true;

CREATE INDEX IF NOT EXISTS cronogramas_labores_finca_idx ON public.cronogramas_labores (finca_id);

DROP TRIGGER IF EXISTS trg_cronogramas_lote_finca ON public.cronogramas_labores;
CREATE TRIGGER trg_cronogramas_lote_finca
  BEFORE INSERT OR UPDATE OF lote_id, finca_id ON public.cronogramas_labores
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lote_matches_finca();

ALTER TABLE public.labores_agronomicas
  ADD COLUMN IF NOT EXISTS cronograma_id uuid REFERENCES public.cronogramas_labores (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.labores_agronomicas.cronograma_id IS
  'Cronograma que generó esta labor (NULL = programada a mano).';

-- Garantía de la base de datos: el mismo cronograma no genera dos labores el mismo día.
CREATE UNIQUE INDEX IF NOT EXISTS labores_cronograma_fecha_uq
  ON public.labores_agronomicas (cronograma_id, fecha_ejecucion)
  WHERE cronograma_id IS NOT NULL AND is_voided = false;

-- ── RLS ──────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cronogramas_labores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cronogramas_labores_select ON public.cronogramas_labores;
CREATE POLICY cronogramas_labores_select ON public.cronogramas_labores
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN ('agronomo'::public.user_role, 'admin'::public.user_role)
      )
    )
  );

DROP POLICY IF EXISTS cronogramas_labores_insert ON public.cronogramas_labores;
CREATE POLICY cronogramas_labores_insert ON public.cronogramas_labores
  FOR INSERT TO authenticated
  WITH CHECK (
    finca_id = public.current_user_finca_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role = 'agronomo'::public.user_role
    )
  );

DROP POLICY IF EXISTS cronogramas_labores_update ON public.cronogramas_labores;
CREATE POLICY cronogramas_labores_update ON public.cronogramas_labores
  FOR UPDATE TO authenticated
  USING (
    finca_id = public.current_user_finca_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role = 'agronomo'::public.user_role
    )
  )
  WITH CHECK (finca_id = public.current_user_finca_id());

-- ── Regla de recurrencia (espejo de lib/cronogramas.ts, cubierto por las pruebas) ────────────
CREATE OR REPLACE FUNCTION public.cronograma_aplica(
  p_frecuencia public.cronograma_frecuencia,
  p_intervalo integer,
  p_dias smallint[],
  p_inicio date,
  p_fecha date
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_ultimo_dia integer;
  v_meses integer;
BEGIN
  IF p_fecha < p_inicio THEN
    RETURN false;
  END IF;

  IF p_frecuencia = 'diaria' THEN
    RETURN (p_fecha - p_inicio) % p_intervalo = 0;
  END IF;

  IF p_frecuencia = 'semanal' THEN
    RETURN extract(isodow FROM p_fecha)::smallint = ANY (p_dias)
      AND ((p_fecha - (p_inicio - (extract(isodow FROM p_inicio)::integer - 1))) / 7) % p_intervalo = 0;
  END IF;

  -- Mensual: mismo día del mes que el inicio; si el mes es más corto, su último día.
  v_meses := (extract(year FROM p_fecha)::integer - extract(year FROM p_inicio)::integer) * 12
    + extract(month FROM p_fecha)::integer - extract(month FROM p_inicio)::integer;
  v_ultimo_dia := extract(day FROM (date_trunc('month', p_fecha) + interval '1 month - 1 day'))::integer;
  RETURN v_meses % p_intervalo = 0
    AND extract(day FROM p_fecha)::integer = least(extract(day FROM p_inicio)::integer, v_ultimo_dia);
END;
$$;

-- ── Generación: desde pg_cron (sin sesión) o desde la app para un cronograma ─────────────────
CREATE OR REPLACE FUNCTION public.generar_labores_cronogramas(p_cronograma_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Horizonte: alcanza a mostrar la próxima ocurrencia de un cronograma mensual.
  c_horizonte_dias CONSTANT integer := 45;
  v_hoy date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_total integer := 0;
  v_creadas integer;
  v_desde date;
  v_hasta date;
  c record;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_cronograma_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.cronogramas_labores cl
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE cl.id = p_cronograma_id
        AND cl.finca_id = p.finca_id
        AND p.is_active = true
        AND p.role = 'agronomo'::public.user_role
    ) THEN
      RAISE EXCEPTION 'No autorizado para generar labores de este cronograma.';
    END IF;
  END IF;

  FOR c IN
    SELECT cl.*, cat.nombre AS labor_nombre
    FROM public.cronogramas_labores cl
    JOIN public.lotes l ON l.id = cl.lote_id
    JOIN public.catalogo_items cat ON cat.id = cl.catalogo_item_id
    JOIN public.profiles o ON o.id = cl.assigned_to
    WHERE cl.activo = true
      AND cl.is_voided = false
      AND (p_cronograma_id IS NULL OR cl.id = p_cronograma_id)
      -- Lote, labor u operario dados de baja: se detiene sin avanzar la fecha ni fallar.
      AND l.activo = true
      AND cat.activo = true
      AND o.is_active = true
      AND o.role = 'operario'::public.user_role
      AND o.finca_id = cl.finca_id
    FOR UPDATE OF cl
  LOOP
    -- Nunca en el pasado: si el proceso estuvo detenido, sigue desde hoy.
    v_desde := greatest(c.fecha_inicio, v_hoy, coalesce(c.generado_hasta + 1, c.fecha_inicio));
    v_hasta := least(v_hoy + c_horizonte_dias, coalesce(c.fecha_fin, v_hoy + c_horizonte_dias));
    CONTINUE WHEN v_desde > v_hasta;

    INSERT INTO public.labores_agronomicas (
      finca_id, lote_id, tipo, fecha_ejecucion, notas, assigned_to, created_by, catalogo_item_id, cronograma_id
    )
    SELECT
      c.finca_id, c.lote_id, c.labor_nombre, d::date,
      coalesce(c.notas, 'Generada por cronograma recurrente.'),
      c.assigned_to, c.created_by, c.catalogo_item_id, c.id
    FROM generate_series(v_desde::timestamp, v_hasta::timestamp, interval '1 day') AS d
    WHERE public.cronograma_aplica(c.frecuencia, c.intervalo, c.dias_semana, c.fecha_inicio, d::date)
    ON CONFLICT (cronograma_id, fecha_ejecucion)
      WHERE cronograma_id IS NOT NULL AND is_voided = false
      DO NOTHING;

    GET DIAGNOSTICS v_creadas = ROW_COUNT;
    v_total := v_total + v_creadas;

    UPDATE public.cronogramas_labores SET generado_hasta = v_hasta WHERE id = c.id;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.generar_labores_cronogramas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_labores_cronogramas(uuid) TO authenticated;

-- ── Generación diaria: 06:00 UTC = 01:00 en Colombia ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'generar-labores-cronogramas',
  '0 6 * * *',
  $cron$SELECT public.generar_labores_cronogramas();$cron$
);
