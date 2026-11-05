-- CR-06 / PU12: liquidación básica de jornales por labor ejecutada. Migración aditiva.

-- ── Quién ejecutó la labor ───────────────────────────────────────────────────────────────────
-- Una labor sin asignar la puede ejecutar cualquier operario; hasta ahora no quedaba en la fila.
ALTER TABLE public.labores_agronomicas
  ADD COLUMN IF NOT EXISTS ejecutada_por uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.labores_agronomicas.ejecutada_por IS
  'Trabajador que reportó la ejecución; es a quien se le liquida la labor.';

-- Labores ya ejecutadas: el autor está en la auditoría.
UPDATE public.labores_agronomicas l
SET ejecutada_por = e.actor_id
FROM (
  SELECT DISTINCT ON (detalle ->> 'registroId')
    (detalle ->> 'registroId')::uuid AS labor_id,
    actor_id
  FROM public.finca_audit_events
  WHERE action_key = 'labor.ejecutar' AND detalle ? 'registroId'
  ORDER BY detalle ->> 'registroId', created_at DESC
) e
WHERE l.id = e.labor_id
  AND l.ejecutada_por IS NULL
  AND l.cantidad_ejecutada IS NOT NULL;

-- ── Tarifas con vigencia: cambiar un precio no altera lo ya trabajado ────────────────────────
CREATE TABLE IF NOT EXISTS public.tarifas_labor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  catalogo_item_id uuid NOT NULL REFERENCES public.catalogo_items (id) ON DELETE RESTRICT,
  unidad_medida text NOT NULL CHECK (unidad_medida IN ('palmas', 'ha')),
  valor_unitario numeric(14, 2) NOT NULL CHECK (valor_unitario > 0),
  vigente_desde date NOT NULL,
  is_voided boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tarifas_labor IS 'Valor en COP por unidad de cada labor, desde una fecha (CR-06).';

CREATE UNIQUE INDEX IF NOT EXISTS tarifas_labor_vigencia_uq
  ON public.tarifas_labor (finca_id, catalogo_item_id, unidad_medida, vigente_desde)
  WHERE is_voided = false;

-- ── Liquidaciones ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.liquidaciones_jornales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consecutivo bigint GENERATED ALWAYS AS IDENTITY,
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  periodo_desde date NOT NULL,
  periodo_hasta date NOT NULL,
  total numeric(16, 2) NOT NULL,
  trabajadores integer NOT NULL,
  labores integer NOT NULL,
  is_voided boolean NOT NULL DEFAULT false,
  motivo_anulacion text,
  anulada_por uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  anulada_en timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT liquidaciones_jornales_periodo_chk CHECK (periodo_hasta >= periodo_desde)
);

-- El detalle es una copia: la liquidación cerrada no cambia si después cambian tarifas o nombres.
CREATE TABLE IF NOT EXISTS public.liquidaciones_jornales_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacion_id uuid NOT NULL REFERENCES public.liquidaciones_jornales (id) ON DELETE RESTRICT,
  labor_id uuid NOT NULL REFERENCES public.labores_agronomicas (id) ON DELETE RESTRICT,
  trabajador_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  trabajador_nombre text NOT NULL,
  trabajador_documento text,
  labor_nombre text NOT NULL,
  lote_codigo text NOT NULL,
  fecha date NOT NULL,
  cantidad numeric NOT NULL,
  unidad_medida text NOT NULL,
  valor_unitario numeric(14, 2) NOT NULL,
  subtotal numeric(16, 2) NOT NULL,
  vigente boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS liquidaciones_detalle_liquidacion_idx
  ON public.liquidaciones_jornales_detalle (liquidacion_id);

-- Garantía de la base de datos: una labor no se paga dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS liquidaciones_detalle_labor_uq
  ON public.liquidaciones_jornales_detalle (labor_id)
  WHERE vigente = true;

-- ── Permisos ─────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.puede_liquidar_finca(p_finca uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_superadmin() OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_active = true
      AND p.role = 'admin'::public.user_role
      AND p.finca_id = p_finca
  );
$$;

ALTER TABLE public.tarifas_labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidaciones_jornales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidaciones_jornales_detalle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tarifas_labor_select ON public.tarifas_labor;
CREATE POLICY tarifas_labor_select ON public.tarifas_labor
  FOR SELECT TO authenticated USING (public.puede_liquidar_finca(finca_id));

DROP POLICY IF EXISTS tarifas_labor_insert ON public.tarifas_labor;
CREATE POLICY tarifas_labor_insert ON public.tarifas_labor
  FOR INSERT TO authenticated
  WITH CHECK (public.puede_liquidar_finca(finca_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS tarifas_labor_update ON public.tarifas_labor;
CREATE POLICY tarifas_labor_update ON public.tarifas_labor
  FOR UPDATE TO authenticated
  USING (public.puede_liquidar_finca(finca_id))
  WITH CHECK (public.puede_liquidar_finca(finca_id));

-- Liquidaciones: solo lectura directa; se escriben únicamente con las funciones de abajo.
DROP POLICY IF EXISTS liquidaciones_jornales_select ON public.liquidaciones_jornales;
CREATE POLICY liquidaciones_jornales_select ON public.liquidaciones_jornales
  FOR SELECT TO authenticated USING (public.puede_liquidar_finca(finca_id));

DROP POLICY IF EXISTS liquidaciones_detalle_select ON public.liquidaciones_jornales_detalle;
CREATE POLICY liquidaciones_detalle_select ON public.liquidaciones_jornales_detalle
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.liquidaciones_jornales l
    WHERE l.id = liquidacion_id AND public.puede_liquidar_finca(l.finca_id)
  ));

-- ── Cálculo: fuente única para la vista previa y para el cierre ──────────────────────────────
CREATE OR REPLACE FUNCTION public.calcular_liquidacion_jornales(p_finca uuid, p_desde date, p_hasta date)
RETURNS TABLE (
  labor_id uuid,
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
  SELECT
    l.id,
    t.id,
    coalesce(t.full_name, 'Sin nombre'),
    t.documento_identidad,
    l.catalogo_item_id,
    coalesce(cat.nombre, l.tipo),
    lo.codigo,
    l.fecha_ejecucion,
    l.cantidad_ejecutada::numeric,
    l.unidad_medida,
    tar.valor_unitario,
    round(l.cantidad_ejecutada::numeric * tar.valor_unitario, 2)
  FROM public.labores_agronomicas l
  JOIN public.lotes lo ON lo.id = l.lote_id
  JOIN public.profiles t ON t.id = coalesce(l.ejecutada_por, l.assigned_to, l.created_by)
  LEFT JOIN public.catalogo_items cat ON cat.id = l.catalogo_item_id
  LEFT JOIN LATERAL (
    SELECT ta.valor_unitario
    FROM public.tarifas_labor ta
    WHERE ta.finca_id = l.finca_id
      AND ta.catalogo_item_id = l.catalogo_item_id
      AND ta.unidad_medida = l.unidad_medida
      AND ta.vigente_desde <= l.fecha_ejecucion
      AND ta.is_voided = false
    ORDER BY ta.vigente_desde DESC
    LIMIT 1
  ) tar ON true
  WHERE l.finca_id = p_finca
    AND l.is_voided = false
    AND l.cantidad_ejecutada IS NOT NULL
    AND l.fecha_ejecucion BETWEEN p_desde AND p_hasta
    AND NOT EXISTS (
      SELECT 1 FROM public.liquidaciones_jornales_detalle d
      WHERE d.labor_id = l.id AND d.vigente = true
    )
  ORDER BY t.full_name, l.fecha_ejecucion;
END;
$$;

CREATE OR REPLACE FUNCTION public.cerrar_liquidacion_jornales(p_finca uuid, p_desde date, p_hasta date)
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
      liquidacion_id, labor_id, trabajador_id, trabajador_nombre, trabajador_documento,
      labor_nombre, lote_codigo, fecha, cantidad, unidad_medida, valor_unitario, subtotal
    )
    SELECT v_id, labor_id, trabajador_id, trabajador_nombre, trabajador_documento,
      labor_nombre, lote_codigo, fecha, cantidad, unidad_medida, valor_unitario, subtotal
    FROM _liq;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Otra liquidación incluyó estas labores al mismo tiempo. Vuelva a calcular.';
  END;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.anular_liquidacion_jornales(p_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_finca uuid;
  v_anulada boolean;
BEGIN
  SELECT finca_id, is_voided INTO v_finca, v_anulada
  FROM public.liquidaciones_jornales WHERE id = p_id FOR UPDATE;

  IF v_finca IS NULL OR NOT public.puede_liquidar_finca(v_finca) THEN
    RAISE EXCEPTION 'Liquidación no encontrada.';
  END IF;
  IF v_anulada THEN
    RAISE EXCEPTION 'Esta liquidación ya está anulada.';
  END IF;
  IF length(trim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Indique el motivo de la anulación (mínimo 10 caracteres).';
  END IF;

  UPDATE public.liquidaciones_jornales
  SET is_voided = true, motivo_anulacion = trim(p_motivo), anulada_por = auth.uid(), anulada_en = now()
  WHERE id = p_id;

  -- Las labores quedan libres para volver a liquidarse.
  UPDATE public.liquidaciones_jornales_detalle SET vigente = false WHERE liquidacion_id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.calcular_liquidacion_jornales(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cerrar_liquidacion_jornales(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.anular_liquidacion_jornales(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.puede_liquidar_finca(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_liquidacion_jornales(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_liquidacion_jornales(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anular_liquidacion_jornales(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_liquidar_finca(uuid) TO authenticated;

-- ── Una labor ya pagada no cambia ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.proteger_labor_liquidada()
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
  WHERE d.labor_id = NEW.id AND d.vigente = true;

  IF v_consecutivo IS NOT NULL THEN
    RAISE EXCEPTION 'Esta labor ya fue liquidada (liquidación N.º %). Anule la liquidación para poder cambiarla.', v_consecutivo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_labor_liquidada ON public.labores_agronomicas;
CREATE TRIGGER trg_proteger_labor_liquidada
  BEFORE UPDATE OF is_voided, cantidad_ejecutada, unidad_medida, fecha_ejecucion, ejecutada_por, catalogo_item_id
  ON public.labores_agronomicas
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_labor_liquidada();
