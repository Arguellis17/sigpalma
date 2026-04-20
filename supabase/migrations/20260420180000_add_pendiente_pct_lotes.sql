-- Migration: add pendiente_pct to lotes (HU04 — RN12: slope > 12% triggers technical alert)
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS pendiente_pct numeric(5,2) CHECK (pendiente_pct IS NULL OR pendiente_pct >= 0);
