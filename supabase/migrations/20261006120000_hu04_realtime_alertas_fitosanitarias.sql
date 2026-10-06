-- Notificaciones en tiempo real de alertas fitosanitarias (Supabase Realtime · Postgres Changes).
-- El técnico conectado recibe cada INSERT sin recargar la página. Realtime evalúa la política
-- RLS `alertas_select` por suscriptor, así que cada usuario solo recibe alertas de su finca.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'alertas_fitosanitarias'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_fitosanitarias;
  END IF;
END
$$;
