-- HU18 / RF28: inventario de herramientas por finca (RN80–RN82).

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventario_herramienta_estado') THEN
    CREATE TYPE public.inventario_herramienta_estado AS ENUM (
      'disponible',
      'en_uso',
      'danada',
      'perdida'
    );
  END IF;
END
$guard$;

COMMENT ON TYPE public.inventario_herramienta_estado IS
  'RF28 RN80: disponible, en_uso, danada, perdida.';

CREATE TABLE IF NOT EXISTS public.inventario_herramientas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id uuid NOT NULL REFERENCES public.fincas (id) ON DELETE RESTRICT,
  catalogo_item_id uuid NOT NULL REFERENCES public.catalogo_items (id) ON DELETE RESTRICT,
  codigo text NOT NULL,
  estado public.inventario_herramienta_estado NOT NULL DEFAULT 'disponible'::public.inventario_herramienta_estado,
  assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  notas_dano text,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  source public.registro_source NOT NULL DEFAULT 'web',
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventario_herramientas_notas_dano_chk CHECK (
    estado NOT IN ('danada'::public.inventario_herramienta_estado, 'perdida'::public.inventario_herramienta_estado)
    OR (notas_dano IS NOT NULL AND length(trim(notas_dano)) >= 10)
  ),
  CONSTRAINT inventario_herramientas_en_uso_asignado_chk CHECK (
    estado <> 'en_uso'::public.inventario_herramienta_estado OR assigned_to IS NOT NULL
  ),
  CONSTRAINT inventario_herramientas_disponible_sin_asignado_chk CHECK (
    estado <> 'disponible'::public.inventario_herramienta_estado OR assigned_to IS NULL
  )
);

COMMENT ON TABLE public.inventario_herramientas IS
  'RF28 HU18: activos físicos (herramientas) por finca, vinculados al catálogo insumo tipo herramienta (HU05).';

CREATE UNIQUE INDEX IF NOT EXISTS inventario_herramientas_finca_codigo_lower_uidx
  ON public.inventario_herramientas (finca_id, lower(codigo))
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS inventario_herramientas_finca_estado_idx
  ON public.inventario_herramientas (finca_id, estado)
  WHERE is_voided = false;

CREATE INDEX IF NOT EXISTS inventario_herramientas_assigned_idx
  ON public.inventario_herramientas (assigned_to)
  WHERE is_voided = false AND estado = 'en_uso'::public.inventario_herramienta_estado;

-- Validar ítem de catálogo = insumo herramienta activo
CREATE OR REPLACE FUNCTION public.enforce_inventario_herramienta_catalogo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.catalogo_items ci
    WHERE ci.id = NEW.catalogo_item_id
      AND ci.categoria = 'insumo'::public.catalogo_categoria
      AND ci.activo = true
      AND lower(coalesce(ci.subcategoria, '')) = 'herramienta'
  ) THEN
    RAISE EXCEPTION 'El ítem de catálogo debe ser un insumo activo de tipo herramienta (HU05).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventario_herramienta_catalogo ON public.inventario_herramientas;
CREATE TRIGGER trg_inventario_herramienta_catalogo
  BEFORE INSERT OR UPDATE OF catalogo_item_id ON public.inventario_herramientas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_inventario_herramienta_catalogo();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.inventario_herramientas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventario_herramientas_select ON public.inventario_herramientas;
CREATE POLICY inventario_herramientas_select ON public.inventario_herramientas
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );

DROP POLICY IF EXISTS inventario_herramientas_insert ON public.inventario_herramientas;
CREATE POLICY inventario_herramientas_insert ON public.inventario_herramientas
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_superadmin()
      OR (
        public.is_finca_admin()
        AND finca_id = public.current_user_finca_id()
      )
    )
    AND created_by = auth.uid()
    AND is_voided = false
  );

DROP POLICY IF EXISTS inventario_herramientas_update ON public.inventario_herramientas;
CREATE POLICY inventario_herramientas_update ON public.inventario_herramientas
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      public.is_finca_admin()
      AND finca_id = public.current_user_finca_id()
    )
    OR (
      finca_id = public.current_user_finca_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role = 'operario'::public.user_role
      )
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR finca_id = public.current_user_finca_id()
  );
