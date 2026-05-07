-- Evidencia fotográfica en alertas fitosanitarias (RF25/RN72) + Storage operario bajo fincas/{id}/alertas-fitosanitarias/

ALTER TABLE public.alertas_fitosanitarias
  ADD COLUMN IF NOT EXISTS evidencia_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.alertas_fitosanitarias.evidencia_urls IS
  'Rutas en bucket evidencia-tecnica (array JSON de strings), p. ej. fincas/{finca_id}/alertas-fitosanitarias/{uuid}.jpg';

-- Operario: solo puede INSERT bajo fincas/{su_finca_id}/alertas-fitosanitarias/
-- Agrónomo/admin/superadmin: mantiene acceso amplio al bucket (suelo, vivero, etc.)
DROP POLICY IF EXISTS evidencia_insert ON storage.objects;
CREATE POLICY evidencia_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'evidencia-tecnica'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
          AND p.role IN (
            'admin'::public.user_role,
            'agronomo'::public.user_role,
            'superadmin'::public.user_role
          )
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_active = true
            AND p.role = 'operario'::public.user_role
            AND p.finca_id IS NOT NULL
            AND split_part(name, '/', 1) = 'fincas'
            AND split_part(name, '/', 2) = p.finca_id::text
            AND split_part(name, '/', 3) = 'alertas-fitosanitarias'
        )
      )
    )
  );
