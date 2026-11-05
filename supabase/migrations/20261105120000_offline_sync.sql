-- Modo offline-first: los registros capturados sin conexión se sincronizan después desde la cola del
-- dispositivo. Esta migración es ADITIVA (no rompe la versión desplegada):
--   * client_op_id: identificador de la operación generado en el dispositivo. Índice único parcial =
--     un reintento nunca crea una segunda fila (idempotencia garantizada por la base de datos).
--   * capturado_en: hora real del registro en el dispositivo (puede ser anterior a created_at).
--   * posible_duplicado_de: dos personas reportan lo mismo sin conexión → se conservan ambos registros
--     (no se pierde evidencia) y el segundo queda enlazado al primero para revisión.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'alertas_fitosanitarias', 'censos_sanitarios', 'cosechas_rff', 'remisiones_despacho',
    'aplicaciones_fertilizacion', 'aplicaciones_fitosanitarias', 'registros_germinacion',
    'preparaciones_terreno', 'registros_siembra', 'labores_agronomicas', 'evaluaciones_vivero',
    'analisis_suelo'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS client_op_id uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS capturado_en timestamptz', t);
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (client_op_id) WHERE client_op_id IS NOT NULL',
      t || '_client_op_id_uq', t
    );
    EXECUTE format(
      'COMMENT ON COLUMN public.%I.client_op_id IS %L', t,
      'Id de operación generado en el dispositivo (modo offline); garantiza que un reintento no duplique el registro.'
    );
  END LOOP;
END
$$;

ALTER TABLE public.alertas_fitosanitarias
  ADD COLUMN IF NOT EXISTS posible_duplicado_de uuid REFERENCES public.alertas_fitosanitarias (id) ON DELETE SET NULL;
COMMENT ON COLUMN public.alertas_fitosanitarias.posible_duplicado_de IS
  'Otra alerta pendiente del mismo lote y amenaza registrada en las últimas 72 h por otra persona.';

ALTER TABLE public.cosechas_rff
  ADD COLUMN IF NOT EXISTS posible_duplicado_de uuid REFERENCES public.cosechas_rff (id) ON DELETE SET NULL;
COMMENT ON COLUMN public.cosechas_rff.posible_duplicado_de IS
  'Otra cosecha del mismo lote, fecha, peso y racimos (posible doble registro sin conexión).';

-- Remisión idempotente: nueva sobrecarga con p_client_op_id. Si la operación ya se aplicó, devuelve la
-- misma remisión en lugar de fallar porque las cosechas "ya no están disponibles".
-- La firma anterior se mantiene hasta desplegar la nueva versión de la app.
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
  p_cosecha_ids uuid[],
  p_client_op_id uuid,
  p_capturado_en timestamptz DEFAULT NULL
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

  IF p_client_op_id IS NOT NULL THEN
    SELECT id INTO v_remision_id
    FROM public.remisiones_despacho
    WHERE client_op_id = p_client_op_id AND created_by = auth.uid();
    IF v_remision_id IS NOT NULL THEN
      RETURN v_remision_id;
    END IF;
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
    capacidad_vehiculo_kg, latitud, longitud, destino, created_by, source,
    client_op_id, capturado_en
  ) VALUES (
    p_finca_id, p_numero_remision, p_fecha_despacho, p_placa,
    p_conductor_id, p_conductor_nombre, p_peso_total, p_total_racimos,
    p_capacidad, p_lat, p_lng, p_destino, p_created_by, p_source,
    p_client_op_id, p_capturado_en
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

REVOKE ALL ON FUNCTION public.crear_remision_despacho(
  uuid, text, date, text, text, text, numeric, integer, numeric, numeric, numeric, text, uuid,
  public.registro_source, uuid[], uuid, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_remision_despacho(
  uuid, text, date, text, text, text, numeric, integer, numeric, numeric, numeric, text, uuid,
  public.registro_source, uuid[], uuid, timestamptz
) TO authenticated;
