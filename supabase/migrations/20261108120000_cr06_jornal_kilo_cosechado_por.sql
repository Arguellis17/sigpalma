-- CR-06 / PU12: formas de pago que usa la finca. Migración aditiva.
--   * Labores: por palma, por hectárea o por jornal (día trabajado), según la tarifa que fija el administrador.
--   * Cosecha: por kilo o por racimo cosechado, pagado a quien cosechó (no a quien lo registró).

-- ── Quién cosechó ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cosechas_rff
  ADD COLUMN IF NOT EXISTS cosechado_por uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cosechas_rff.cosechado_por IS
  'Trabajador que cosechó la fruta; se le paga la cosecha. NULL = quien registró (created_by).';

-- Lista de operarios de la propia finca para elegir quién cosechó. El RLS de profiles no deja que
-- un operario vea a sus compañeros; esta función expone solo id y nombre.
CREATE OR REPLACE FUNCTION public.operarios_finca()
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, coalesce(nullif(trim(p.full_name), ''), 'Operario')
  FROM public.profiles p
  WHERE p.finca_id = public.current_user_finca_id()
    AND p.role = 'operario'::public.user_role
    AND p.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid() AND me.is_active = true
        AND me.role IN ('operario'::public.user_role, 'agronomo'::public.user_role, 'admin'::public.user_role)
    )
  ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.operarios_finca() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.operarios_finca() TO authenticated;

-- ── Tarifas: jornal por labor; kilo o racimo para la cosecha (sin labor) ─────────────────────
ALTER TABLE public.tarifas_labor ALTER COLUMN catalogo_item_id DROP NOT NULL;
ALTER TABLE public.tarifas_labor DROP CONSTRAINT IF EXISTS tarifas_labor_unidad_medida_check;
ALTER TABLE public.tarifas_labor DROP CONSTRAINT IF EXISTS tarifas_labor_unidad_chk;
ALTER TABLE public.tarifas_labor ADD CONSTRAINT tarifas_labor_unidad_chk CHECK (
  (catalogo_item_id IS NOT NULL AND unidad_medida IN ('palmas', 'ha', 'jornal'))
  OR (catalogo_item_id IS NULL AND unidad_medida IN ('kg', 'racimo'))
);

DROP INDEX IF EXISTS public.tarifas_labor_vigencia_uq;
CREATE UNIQUE INDEX IF NOT EXISTS tarifas_labor_vigencia_uq
  ON public.tarifas_labor (
    finca_id,
    coalesce(catalogo_item_id, '00000000-0000-0000-0000-000000000000'::uuid),
    unidad_medida,
    vigente_desde
  )
  WHERE is_voided = false;

-- ── El detalle puede ser una labor o una cosecha ─────────────────────────────────────────────
ALTER TABLE public.liquidaciones_jornales_detalle ALTER COLUMN labor_id DROP NOT NULL;
ALTER TABLE public.liquidaciones_jornales_detalle
  ADD COLUMN IF NOT EXISTS cosecha_id uuid REFERENCES public.cosechas_rff (id) ON DELETE RESTRICT;
ALTER TABLE public.liquidaciones_jornales_detalle DROP CONSTRAINT IF EXISTS liquidaciones_detalle_origen_chk;
ALTER TABLE public.liquidaciones_jornales_detalle ADD CONSTRAINT liquidaciones_detalle_origen_chk
  CHECK ((labor_id IS NULL) <> (cosecha_id IS NULL));

-- Garantía de la base de datos: una cosecha no se paga dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS liquidaciones_detalle_cosecha_uq
  ON public.liquidaciones_jornales_detalle (cosecha_id)
  WHERE vigente = true AND cosecha_id IS NOT NULL;

-- ── Cálculo ──────────────────────────────────────────────────────────────────────────────────
-- Cambia el tipo de retorno: se recrean juntas las dos funciones que lo usan.
DROP FUNCTION IF EXISTS public.cerrar_liquidacion_jornales(uuid, date, date);
DROP FUNCTION IF EXISTS public.calcular_liquidacion_jornales(uuid, date, date);

CREATE FUNCTION public.calcular_liquidacion_jornales(p_finca uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  labor_id uuid,
  cosecha_id uuid,
  trabajador_id uuid,
  trabajador_nombre text,
  trabajador_documento text,
  catalogo_item_id uuid,
  labor_nombre text,
  lote_codigo text,
  fecha date,
  cantidad numeric,
  unidad_medida text,
  valor_unitario numeric,
  subtotal numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.puede_liquidar_finca(p_finca) THEN
    RAISE EXCEPTION 'No autorizado para liquidar jornales de esta finca.';
  END IF;

  RETURN QUERY
  WITH
  -- Tarifa de cosecha (kilo o racimo) vigente en cada fecha: la más reciente.
  cosecha_tarifa AS (
    SELECT d::date AS dia, t.unidad_medida AS unidad, t.valor_unitario AS valor
    FROM generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') d
    JOIN LATERAL (
      SELECT ta.unidad_medida, ta.valor_unitario
      FROM public.tarifas_labor ta
      WHERE ta.finca_id = p_finca AND ta.catalogo_item_id IS NULL AND ta.is_voided = false
        AND ta.vigente_desde <= d::date
      ORDER BY ta.vigente_desde DESC, ta.created_at DESC
      LIMIT 1
    ) t ON true
  ),
  labores AS (
    SELECT
      l.id AS lab_id,
      t.id AS trab_id,
      coalesce(t.full_name, 'Sin nombre') AS trab_nombre,
      t.documento_identidad AS trab_doc,
      l.catalogo_item_id AS cat_id,
      coalesce(cat.nombre, l.tipo) AS lab_nombre,
      lo.codigo AS lote,
      l.fecha_ejecucion AS dia,
      l.cantidad_ejecutada::numeric AS cant,
      l.unidad_medida AS unidad,
      tu.valor_unitario AS v_unidad,
      tu.vigente_desde AS d_unidad,
      tj.valor_unitario AS v_jornal,
      tj.vigente_desde AS d_jornal
    FROM public.labores_agronomicas l
    JOIN public.lotes lo ON lo.id = l.lote_id
    JOIN public.profiles t ON t.id = coalesce(l.ejecutada_por, l.assigned_to, l.created_by)
    LEFT JOIN public.catalogo_items cat ON cat.id = l.catalogo_item_id
    LEFT JOIN LATERAL (
      SELECT ta.valor_unitario, ta.vigente_desde FROM public.tarifas_labor ta
      WHERE ta.finca_id = l.finca_id AND ta.catalogo_item_id = l.catalogo_item_id
        AND ta.unidad_medida = l.unidad_medida AND ta.vigente_desde <= l.fecha_ejecucion AND ta.is_voided = false
      ORDER BY ta.vigente_desde DESC LIMIT 1
    ) tu ON true
    LEFT JOIN LATERAL (
      SELECT ta.valor_unitario, ta.vigente_desde FROM public.tarifas_labor ta
      WHERE ta.finca_id = l.finca_id AND ta.catalogo_item_id = l.catalogo_item_id
        AND ta.unidad_medida = 'jornal' AND ta.vigente_desde <= l.fecha_ejecucion AND ta.is_voided = false
      ORDER BY ta.vigente_desde DESC LIMIT 1
    ) tj ON true
    WHERE l.finca_id = p_finca
      AND l.is_voided = false
      AND l.cantidad_ejecutada IS NOT NULL
      AND l.fecha_ejecucion BETWEEN p_desde AND p_hasta
      AND NOT EXISTS (
        SELECT 1 FROM public.liquidaciones_jornales_detalle dd WHERE dd.labor_id = l.id AND dd.vigente = true
      )
      -- Si ese día la cosecha se paga por lo cosechado, la labor «Cosecha RFF» no se paga aparte.
      AND NOT (
        (
          lower(trim(coalesce(cat.nombre, l.tipo))) IN ('cosecha', 'cosecha rff')
          OR lower(coalesce(cat.nombre, l.tipo)) LIKE '%cosecha rff%'
        )
        AND EXISTS (SELECT 1 FROM cosecha_tarifa ct WHERE ct.dia = l.fecha_ejecucion)
      )
  ),
  -- Por jornal cuando hay tarifa de jornal y es igual o más reciente que la de unidad.
  clasificadas AS (
    SELECT lb.*, (lb.v_jornal IS NOT NULL AND (lb.v_unidad IS NULL OR lb.d_jornal >= lb.d_unidad)) AS es_jornal
    FROM labores lb
  ),
  -- Un día de trabajo se paga una sola vez por trabajador, aunque haga varias labores por jornal.
  jornales AS (
    SELECT c.*,
      row_number() OVER (PARTITION BY c.trab_id, c.dia ORDER BY c.v_jornal DESC, c.lab_id) AS orden,
      EXISTS (
        SELECT 1 FROM public.liquidaciones_jornales_detalle dd
        WHERE dd.trabajador_id = c.trab_id AND dd.fecha = c.dia AND dd.vigente = true
          AND dd.unidad_medida = 'jornal' AND dd.cantidad > 0
      ) AS dia_ya_pagado
    FROM clasificadas c
    WHERE c.es_jornal
  ),
  todo AS (
    SELECT c.lab_id, NULL::uuid AS cos_id, c.trab_id, c.trab_nombre, c.trab_doc, c.cat_id,
      c.lab_nombre, c.lote, c.dia, c.cant, c.unidad, c.v_unidad AS valor, round(c.cant * c.v_unidad, 2) AS sub
    FROM clasificadas c
    WHERE NOT c.es_jornal

    UNION ALL

    SELECT j.lab_id, NULL::uuid, j.trab_id, j.trab_nombre, j.trab_doc, j.cat_id,
      j.lab_nombre, j.lote, j.dia,
      CASE WHEN j.orden = 1 AND NOT j.dia_ya_pagado THEN 1 ELSE 0 END::numeric,
      'jornal', j.v_jornal,
      CASE WHEN j.orden = 1 AND NOT j.dia_ya_pagado THEN j.v_jornal ELSE 0 END
    FROM jornales j

    UNION ALL

    SELECT NULL::uuid, c.id, t.id, coalesce(t.full_name, 'Sin nombre'), t.documento_identidad, NULL::uuid,
      'Cosecha RFF', lo.codigo, c.fecha,
      CASE WHEN ct.unidad = 'kg' THEN c.peso_kg::numeric ELSE c.conteo_racimos::numeric END,
      ct.unidad, ct.valor,
      round(CASE WHEN ct.unidad = 'kg' THEN c.peso_kg::numeric ELSE c.conteo_racimos::numeric END * ct.valor, 2)
    FROM public.cosechas_rff c
    JOIN cosecha_tarifa ct ON ct.dia = c.fecha
    JOIN public.lotes lo ON lo.id = c.lote_id
    JOIN public.profiles t ON t.id = coalesce(c.cosechado_por, c.created_by)
    WHERE c.finca_id = p_finca
      AND c.is_voided = false
      AND c.fecha BETWEEN p_desde AND p_hasta
      AND NOT EXISTS (
        SELECT 1 FROM public.liquidaciones_jornales_detalle dd WHERE dd.cosecha_id = c.id AND dd.vigente = true
      )
  )
  SELECT * FROM todo ORDER BY todo.trab_nombre, todo.dia;
END;
$$;

CREATE FUNCTION public.cerrar_liquidacion_jornales(p_finca uuid, p_desde date, p_hasta date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_labores integer;
  v_sin_tarifa integer;
  v_trabajadores integer;
  v_total numeric;
BEGIN
  IF NOT public.puede_liquidar_finca(p_finca) THEN
    RAISE EXCEPTION 'No autorizado para liquidar jornales de esta finca.';
  END IF;
  IF p_hasta < p_desde THEN
    RAISE EXCEPTION 'La fecha final no puede ser anterior a la inicial.';
  END IF;

  CREATE TEMP TABLE _liq ON COMMIT DROP AS
    SELECT * FROM public.calcular_liquidacion_jornales(p_finca, p_desde, p_hasta);

  SELECT count(*), count(*) FILTER (WHERE valor_unitario IS NULL), count(DISTINCT trabajador_id), coalesce(sum(subtotal), 0)
  INTO v_labores, v_sin_tarifa, v_trabajadores, v_total
  FROM _liq;

  IF v_labores = 0 THEN
    RAISE EXCEPTION 'No hay labores ejecutadas sin liquidar en este periodo.';
  END IF;
  IF v_sin_tarifa > 0 THEN
    RAISE EXCEPTION 'Hay % labores sin tarifa vigente: registre las tarifas antes de cerrar.', v_sin_tarifa;
  END IF;

  INSERT INTO public.liquidaciones_jornales (finca_id, periodo_desde, periodo_hasta, total, trabajadores, labores, created_by)
  VALUES (p_finca, p_desde, p_hasta, v_total, v_trabajadores, v_labores, auth.uid())
  RETURNING id INTO v_id;

  BEGIN
    INSERT INTO public.liquidaciones_jornales_detalle (
      liquidacion_id, labor_id, cosecha_id, trabajador_id, trabajador_nombre, trabajador_documento,
      labor_nombre, lote_codigo, fecha, cantidad, unidad_medida, valor_unitario, subtotal
    )
    SELECT v_id, labor_id, cosecha_id, trabajador_id, trabajador_nombre, trabajador_documento,
      labor_nombre, lote_codigo, fecha, cantidad, unidad_medida, valor_unitario, subtotal
    FROM _liq;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Otra liquidación incluyó estas labores al mismo tiempo. Vuelva a calcular.';
  END;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.calcular_liquidacion_jornales(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cerrar_liquidacion_jornales(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_liquidacion_jornales(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_liquidacion_jornales(uuid, date, date) TO authenticated;

-- ── Una cosecha ya pagada no cambia ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.proteger_cosecha_liquidada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consecutivo bigint;
BEGIN
  SELECT l.consecutivo INTO v_consecutivo
  FROM public.liquidaciones_jornales_detalle d
  JOIN public.liquidaciones_jornales l ON l.id = d.liquidacion_id
  WHERE d.cosecha_id = NEW.id AND d.vigente = true;

  IF v_consecutivo IS NOT NULL THEN
    RAISE EXCEPTION 'Esta cosecha ya fue liquidada (liquidación N.º %). Anule la liquidación para poder cambiarla.', v_consecutivo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_cosecha_liquidada ON public.cosechas_rff;
CREATE TRIGGER trg_proteger_cosecha_liquidada
  BEFORE UPDATE OF is_voided, peso_kg, conteo_racimos, fecha, cosechado_por
  ON public.cosechas_rff
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_cosecha_liquidada();
