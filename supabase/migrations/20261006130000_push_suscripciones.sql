-- Web Push: suscripciones de navegador por usuario (un registro por dispositivo/navegador).
-- El envío se hace desde el servidor con service role; cada usuario solo ve y gestiona las suyas.
CREATE TABLE IF NOT EXISTS public.push_suscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.push_suscripciones IS 'Suscripciones Web Push (PushSubscription del navegador) para notificaciones con la app cerrada.';

CREATE INDEX IF NOT EXISTS push_suscripciones_user_idx ON public.push_suscripciones (user_id);

ALTER TABLE public.push_suscripciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_suscripciones_select ON public.push_suscripciones;
CREATE POLICY push_suscripciones_select ON public.push_suscripciones
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_suscripciones_insert ON public.push_suscripciones;
CREATE POLICY push_suscripciones_insert ON public.push_suscripciones
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_suscripciones_update ON public.push_suscripciones;
CREATE POLICY push_suscripciones_update ON public.push_suscripciones
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_suscripciones_delete ON public.push_suscripciones;
CREATE POLICY push_suscripciones_delete ON public.push_suscripciones
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
