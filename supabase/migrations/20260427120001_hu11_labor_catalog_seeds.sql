-- HU11: semillas del catálogo de tipos de labor (ejecutar después del ADD VALUE en otra transacción).

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, activo)
SELECT 'labor'::public.catalogo_categoria, 'Poda', 'Labor de poda del cultivo.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'labor'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Poda')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, activo)
SELECT 'labor'::public.catalogo_categoria, 'Control de malezas', 'Control químico o manual de malezas.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'labor'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Control de malezas')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, activo)
SELECT 'labor'::public.catalogo_categoria, 'Plateo', 'Plateo o reconstrucción de terrazas.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'labor'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Plateo')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, activo)
SELECT 'labor'::public.catalogo_categoria, 'Riego', 'Programación de riego.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'labor'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Riego')
);

INSERT INTO public.catalogo_items (categoria, nombre, descripcion, activo)
SELECT 'labor'::public.catalogo_categoria, 'Fertilización', 'Aplicación de fertilización de mantenimiento.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalogo_items ci
  WHERE ci.categoria = 'labor'::public.catalogo_categoria
    AND lower(ci.nombre) = lower('Fertilización')
);
