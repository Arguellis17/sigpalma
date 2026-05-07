-- RF16 / HU16 (RN44): variables adicionales opcionales en análisis de suelo.
-- ph, humedad_pct, compactacion ya existían; nuevas columnas NULL para filas históricas.

ALTER TABLE public.analisis_suelo
  ADD COLUMN IF NOT EXISTS fertilidad_completa text,
  ADD COLUMN IF NOT EXISTS textura text,
  ADD COLUMN IF NOT EXISTS aluminio numeric(10, 3),
  ADD COLUMN IF NOT EXISTS cic numeric(10, 2),
  ADD COLUMN IF NOT EXISTS materia_organica_pct numeric(6, 2),
  ADD COLUMN IF NOT EXISTS drenaje_campo text;

COMMENT ON COLUMN public.analisis_suelo.fertilidad_completa IS 'Resumen o indicador de fertilidad completa (laboratorio / técnico).';
COMMENT ON COLUMN public.analisis_suelo.textura IS 'Clase textural del suelo.';
COMMENT ON COLUMN public.analisis_suelo.aluminio IS 'Al intercambiable o tóxico según informe (valor numérico).';
COMMENT ON COLUMN public.analisis_suelo.cic IS 'Capacidad de intercambio catiónico (CIC).';
COMMENT ON COLUMN public.analisis_suelo.materia_organica_pct IS 'Materia orgánica (%).';
COMMENT ON COLUMN public.analisis_suelo.drenaje_campo IS 'Evaluación de drenaje en campo.';
