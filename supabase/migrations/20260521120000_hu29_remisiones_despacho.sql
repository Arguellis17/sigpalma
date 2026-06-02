-- HU29: remisiones de despacho RFF + FK desde cosechas_rff (RN79/RN85).

CREATE TABLE IF NOT EXISTS public.remisiones_despacho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  numero_remision text NOT NULL,
  fecha_despacho date NOT NULL,
  hora_salida timestamptz NOT NULL DEFAULT now(),
  placa_vehiculo text NOT NULL,
  conductor_identificacion text NOT NULL,
  conductor_nombre text,
  peso_total_kg numeric(14, 3) NOT NULL,
  total_racimos integer NOT NULL,
  capacidad_vehiculo_kg numeric(14, 3),
  latitud numeric(10, 7),
  longitud numeric(10, 7),
  destino text,
  created_by uuid NOT NULL,
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT remisiones_despacho_peso_chk CHECK (peso_total_kg > 0),
  CONSTRAINT remisiones_despacho_racimos_chk CHECK (total_racimos > 0),
  CONSTRAINT remisiones_despacho_placa_chk CHECK (char_length(trim(placa_vehiculo)) >= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS remisiones_despacho_finca_numero_uidx
  ON public.remisiones_despacho (finca_id, numero_remision);

CREATE INDEX IF NOT EXISTS remisiones_despacho_finca_fecha_idx
  ON public.remisiones_despacho (finca_id, fecha_despacho DESC);

COMMENT ON TABLE public.remisiones_despacho IS 'HU29: remisión de salida de fruta hacia acopio o extractora.';

-- FK cosechas → remisión (columna ya existe desde HU27)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cosechas_rff_remision_id_fkey'
  ) THEN
    ALTER TABLE public.cosechas_rff
      ADD CONSTRAINT cosechas_rff_remision_id_fkey
      FOREIGN KEY (remision_id) REFERENCES public.remisiones_despacho (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- RN79: no editar cosecha ya despachada (salvo anulación lógica vía is_voided)
CREATE OR REPLACE FUNCTION public.cosechas_rff_bloquear_si_despachada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.remision_id IS NOT NULL THEN
    IF NEW.is_voided IS DISTINCT FROM true OR OLD.is_voided = false THEN
      IF (
        NEW.peso_kg IS DISTINCT FROM OLD.peso_kg
        OR NEW.conteo_racimos IS DISTINCT FROM OLD.conteo_racimos
        OR NEW.fecha IS DISTINCT FROM OLD.fecha
        OR NEW.lote_id IS DISTINCT FROM OLD.lote_id
        OR NEW.estado_acopio IS DISTINCT FROM OLD.estado_acopio
        OR NEW.remision_id IS DISTINCT FROM OLD.remision_id
      ) AND NEW.is_voided = OLD.is_voided THEN
        RAISE EXCEPTION 'Cosecha bloqueada: ya vinculada a remisión de despacho (RN79).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cosechas_bloquear_despacho ON public.cosechas_rff;
CREATE TRIGGER trg_cosechas_bloquear_despacho
  BEFORE UPDATE ON public.cosechas_rff
  FOR EACH ROW
  EXECUTE FUNCTION public.cosechas_rff_bloquear_si_despachada();

ALTER TABLE public.remisiones_despacho ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS remisiones_select ON public.remisiones_despacho;
CREATE POLICY remisiones_select ON public.remisiones_despacho
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS remisiones_insert ON public.remisiones_despacho;
CREATE POLICY remisiones_insert ON public.remisiones_despacho
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_superadmin()
    AND NOT public.is_finca_admin()
    AND finca_id = public.current_user_finca_id()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('agronomo'::public.user_role, 'operario'::public.user_role)
    )
  );

DROP POLICY IF EXISTS remisiones_update ON public.remisiones_despacho;
CREATE POLICY remisiones_update ON public.remisiones_despacho
  FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Creación atómica remisión + vínculo cosechas (RN85)
CREATE OR REPLACE FUNCTION public.crear_remision_despacho(
  p_finca_id uuid,
  p_numero_remision text,
  p_fecha_despacho date,
  p_placa text,
  p_conductor_id text,
  p_conductor_nombre text,
  p_peso_total numeric,
  p_total_racimos integer,
  p_capacidad numeric,
  p_lat numeric,
  p_lng numeric,
  p_destino text,
  p_created_by uuid,
  p_source public.registro_source,
  p_cosecha_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remision_id uuid;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada.';
  END IF;

  IF NOT public.is_superadmin() AND (
    p_finca_id IS DISTINCT FROM public.current_user_finca_id()
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
        AND p.role IN ('operario'::public.user_role, 'agronomo'::public.user_role)
    )
  ) THEN
    RAISE EXCEPTION 'No autorizado para crear remisiones en esta finca.';
  END IF;

  IF p_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'El responsable debe ser el usuario autenticado.';
  END IF;

  IF array_length(p_cosecha_ids, 1) IS NULL OR array_length(p_cosecha_ids, 1) < 1 THEN
    RAISE EXCEPTION 'Debe incluir al menos una cosecha.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.cosechas_rff c
  WHERE c.id = ANY (p_cosecha_ids)
    AND c.finca_id = p_finca_id
    AND c.is_voided = false
    AND c.estado_acopio = 'en_centro_acopio'::public.cosecha_estado_acopio
    AND c.remision_id IS NULL;

  IF v_count <> array_length(p_cosecha_ids, 1) THEN
    RAISE EXCEPTION 'Una o más cosechas no están disponibles para despacho.';
  END IF;

  INSERT INTO public.remisiones_despacho (
    finca_id, numero_remision, fecha_despacho, placa_vehiculo,
    conductor_identificacion, conductor_nombre, peso_total_kg, total_racimos,
    capacidad_vehiculo_kg, latitud, longitud, destino, created_by, source
  ) VALUES (
    p_finca_id, p_numero_remision, p_fecha_despacho, p_placa,
    p_conductor_id, p_conductor_nombre, p_peso_total, p_total_racimos,
    p_capacidad, p_lat, p_lng, p_destino, p_created_by, p_source
  )
  RETURNING id INTO v_remision_id;

  UPDATE public.cosechas_rff
  SET
    remision_id = v_remision_id,
    estado_acopio = 'en_transito'::public.cosecha_estado_acopio,
    updated_at = now()
  WHERE id = ANY (p_cosecha_ids)
    AND finca_id = p_finca_id
    AND is_voided = false
    AND estado_acopio = 'en_centro_acopio'::public.cosecha_estado_acopio
    AND remision_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudieron vincular las cosechas a la remisión.';
  END IF;

  RETURN v_remision_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_remision_despacho FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_remision_despacho TO authenticated;
