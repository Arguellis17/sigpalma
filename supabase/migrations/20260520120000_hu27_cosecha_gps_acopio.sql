-- HU27: GPS, estado de acopio y enlace futuro a remisión (HU29 / RN79).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cosecha_estado_acopio') THEN
    CREATE TYPE public.cosecha_estado_acopio AS ENUM (
      'en_centro_acopio',
      'en_transito'
    );
  END IF;
END $$;

COMMENT ON TYPE public.cosecha_estado_acopio IS
  'HU27 poscondición / HU29: fruta en centro de acopio o en tránsito tras remisión.';

ALTER TABLE public.cosechas_rff
  ADD COLUMN IF NOT EXISTS latitud numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitud numeric(10, 7),
  ADD COLUMN IF NOT EXISTS estado_acopio public.cosecha_estado_acopio NOT NULL DEFAULT 'en_centro_acopio',
  ADD COLUMN IF NOT EXISTS remision_id uuid;

COMMENT ON COLUMN public.cosechas_rff.latitud IS 'HU27: coordenada GPS al registrar cosecha en campo.';
COMMENT ON COLUMN public.cosechas_rff.longitud IS 'HU27: coordenada GPS al registrar cosecha en campo.';
COMMENT ON COLUMN public.cosechas_rff.estado_acopio IS 'HU27/HU29: inventario temporal en finca vs despachado.';
COMMENT ON COLUMN public.cosechas_rff.remision_id IS 'HU29: remisión de despacho que bloquea edición (RN79).';

-- Catálogo labor «Cosecha RFF» para HU11 / HU27
INSERT INTO public.catalogo_items (categoria, nombre, descripcion, activo)
SELECT 'labor'::public.catalogo_categoria,
  'Cosecha RFF',
  'Recolección de racimos de fruta fresca (RFF) por lote.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'labor'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Cosecha RFF')
);
