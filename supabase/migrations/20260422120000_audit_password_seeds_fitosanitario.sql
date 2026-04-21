-- SIG-Palma: auditoría de finca, cambio obligatorio de contraseña, semillas RN19
-- Apply: npx supabase db push

-- -----------------------------------------------------------------------------
-- 1. Perfil: forzar cambio de contraseña (RN07)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.must_change_password IS
  'Si es true, el usuario debe establecer una nueva contraseña antes de usar la plataforma.';

-- -----------------------------------------------------------------------------
-- 2. Eventos de auditoría por finca (solo insert desde app; lectura admin/superadmin)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finca_audit_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id     uuid NOT NULL REFERENCES public.fincas (id) ON DELETE CASCADE,
  actor_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  action_key   text NOT NULL,
  titulo       text NOT NULL,
  detalle      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finca_audit_events_finca_created_idx
  ON public.finca_audit_events (finca_id, created_at DESC);

CREATE INDEX IF NOT EXISTS finca_audit_events_actor_idx
  ON public.finca_audit_events (actor_id);

COMMENT ON TABLE public.finca_audit_events IS
  'Registro legible de acciones de campo por finca; insert desde Server Actions.';

ALTER TABLE public.finca_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finca_audit_events_select ON public.finca_audit_events;
CREATE POLICY finca_audit_events_select ON public.finca_audit_events
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR (
      public.is_finca_admin()
      AND finca_id = public.current_user_finca_id()
    )
  );

DROP POLICY IF EXISTS finca_audit_events_insert ON public.finca_audit_events;
CREATE POLICY finca_audit_events_insert ON public.finca_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      public.is_superadmin()
      OR (
        finca_id = public.current_user_finca_id()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_active = true
            AND p.role IN (
              'agronomo'::public.user_role,
              'operario'::public.user_role
            )
        )
      )
      OR (
        public.is_finca_admin()
        AND finca_id = public.current_user_finca_id()
      )
    )
  );

-- No UPDATE/DELETE: trazabilidad inmutable en UI

-- -----------------------------------------------------------------------------
-- 3. Semillas catálogo fitosanitario (RN19) — idempotente
-- -----------------------------------------------------------------------------
INSERT INTO public.catalogo_items (categoria, nombre, descripcion, sintomas, activo)
SELECT 'plaga'::public.catalogo_categoria,
       'Picudo rojo (Rhynchophorus palmarum)',
       'Gorgojo que daña el apical y puede causar la muerte de la palma; plaga regulada en palma aceitera.',
       'Orificios de penetración en la base de las hojas o el estípite; presencia de larvas o adultos; amarillamiento o marchitez del cogollo.',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'plaga'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Picudo rojo (Rhynchophorus palmarum)')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, sintomas, activo)
SELECT 'plaga'::public.catalogo_categoria,
       'Escarabajo rinoceronte (Oryctes rhinoceros)',
       'Escarabajo que puede dañar el cogollo y la inflorescencia en palma.',
       'Daños mecánicos en hojas jóvenes y tejidos del cogollo; presencia de adultos nocturnos en la copa.',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'plaga'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Escarabajo rinoceronte (Oryctes rhinoceros)')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, sintomas, activo)
SELECT 'plaga'::public.catalogo_categoria,
       'Lagarta desfoliadora (Lebeda sp. y similares)',
       'Larvas que consumen folíolo y reducen el área fotosintética.',
       'Defoliación irregular, presencia de orugas y heces en el envés de las hojas.',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'plaga'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Lagarta desfoliadora (Lebeda sp. y similares)')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, sintomas, activo)
SELECT 'plaga'::public.catalogo_categoria,
       'Ácaros (Eriophyidae / Tetranychidae)',
       'Ácaros que provocan plateado o bronceo en el follaje.',
       'Manchas plateadas o necrosis en folíolos; en casos severos enrollamiento o caída prematura de hojas.',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'plaga'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Ácaros (Eriophyidae / Tetranychidae)')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, sintomas, activo)
SELECT 'plaga'::public.catalogo_categoria,
       'Comezón de la palma (Eutetranychus orientalis)',
       'Ácaro fitófago frecuente en palma con daño foliar característico.',
       'Clorosis puntiforme, aspecto “arenoso” en el haz del folíolo; puede asociarse a telarañas finas.',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'plaga'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Comezón de la palma (Eutetranychus orientalis)')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, sintomas, activo)
SELECT 'enfermedad'::public.catalogo_categoria,
       'Pudrición del cogollo',
       'Síndrome asociado a patógenos o complejos que afectan el tejido central de la copa.',
       'Ablandamiento y decoloración del tejido del cogollo; olor fétido; hojas jóvenes fácilmente extraíbles (“cogollo húmedo”).',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'enfermedad'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Pudrición del cogollo')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, sintomas, activo)
SELECT 'enfermedad'::public.catalogo_categoria,
       'Marchitez letal / anillo anaranjado (phytoplasma)',
       'Enfermedad sistémica transmitida por insectos vectores; reportada en palmas en varias regiones.',
       'Rápido amarillamiento y necrosis de hojas jóvenes; síntomas en “anillo” en el estípite en algunos casos; declive acelerado.',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'enfermedad'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Marchitez letal / anillo anaranjado (phytoplasma)')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, sintomas, activo)
SELECT 'enfermedad'::public.catalogo_categoria,
       'Pudrición basal por Ganoderma (Ganoderma boninense)',
       'Hongo basidiomiceto que coloniza la base del estípite y la raíz.',
       'Presencia de cuerpos fructíferos en la base; declive general de la copa; debilitamiento progresivo de la palma.',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'enfermedad'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Pudrición basal por Ganoderma (Ganoderma boninense)')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, sintomas, activo)
SELECT 'enfermedad'::public.catalogo_categoria,
       'Mancha foliar por Helminthosporium / Curvularia',
       'Lesiones foliares fúngicas frecuentes en ambientos húmedos.',
       'Lesiones necróticas alargadas en folíolos; anillos concéntricos en algunas especies de patógeno.',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'enfermedad'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Mancha foliar por Helminthosporium / Curvularia')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, sintomas, activo)
SELECT 'enfermedad'::public.catalogo_categoria,
       'Pudrición de la espata / inflorescencia',
       'Afectación de tejidos florales que reduce la polinización y el fruto.',
       'Necrosis y oscurecimiento de la espata; aborto floral; síntomas húmedos en la inserción de la inflorescencia.',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'enfermedad'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Pudrición de la espata / inflorescencia')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, sintomas, activo)
SELECT 'enfermedad'::public.catalogo_categoria,
       'Amarillamiento letal / marchitez asociada a complejos bacterianos',
       'Síndrome de declive con componente vascular/bacteriano según contexto regional.',
       'Amarillamiento difuso, necrosis en hojas intermedias, declive rápido; requiere diagnóstico de laboratorio.',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'enfermedad'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Amarillamiento letal / marchitez asociada a complejos bacterianos')
);
