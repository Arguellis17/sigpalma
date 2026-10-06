-- Centro de notificaciones: cada aviso queda guardado por usuario (ver, abrir, marcar leído, borrar).
-- El servidor inserta con service role; el navegador recibe sus filas nuevas por Realtime
-- (Postgres Changes filtrado por user_id + RLS) y, con la app cerrada, por Web Push.
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('alerta_fitosanitaria', 'monitoreo_asignado')),
  titulo text NOT NULL,
  cuerpo text NOT NULL DEFAULT '',
  url text NOT NULL,
  referencia_id uuid,
  severidad public.nivel_severidad,
  leida_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notificaciones IS 'Bandeja de notificaciones por usuario (alertas fitosanitarias, monitoreos asignados).';
COMMENT ON COLUMN public.notificaciones.referencia_id IS 'Registro de origen (alerta o monitoreo) para deduplicar y enlazar.';

CREATE INDEX IF NOT EXISTS notificaciones_user_created_idx
  ON public.notificaciones (user_id, created_at DESC);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificaciones_select ON public.notificaciones;
CREATE POLICY notificaciones_select ON public.notificaciones
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notificaciones_update ON public.notificaciones;
CREATE POLICY notificaciones_update ON public.notificaciones
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notificaciones_delete ON public.notificaciones;
CREATE POLICY notificaciones_delete ON public.notificaciones
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Sin política INSERT: solo el servidor (service role) crea notificaciones.
-- El usuario solo puede cambiar `leida_at` de sus propias filas.
REVOKE INSERT, UPDATE ON public.notificaciones FROM authenticated, anon;
GRANT UPDATE (leida_at) ON public.notificaciones TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notificaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
  END IF;
END
$$;

-- Nota: esta tabla reemplaza la escucha directa de `alertas_fitosanitarias` y el canal Broadcast
-- `monitoreos:<id>`. Se dejan activos para no romper la versión desplegada mientras se publica
-- este cambio; se retiran en una migración posterior.
