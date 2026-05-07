import type { SupabaseClient } from "@supabase/supabase-js";

export const EVIDENCIA_TECNICA_BUCKET = "evidencia-tecnica";

/** Normaliza columna jsonb `evidencia_urls` a lista de rutas en Storage. */
export function parseEvidenciaPaths(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  }
  if (typeof raw === "string") {
    try {
      return parseEvidenciaPaths(JSON.parse(raw) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

export async function createSignedUrlsForStoragePaths(
  supabase: SupabaseClient,
  paths: string[],
  expiresSec = 3600
): Promise<string[]> {
  const urls: string[] = [];
  for (const path of paths) {
    const p = path.trim();
    if (!p) continue;
    const { data, error } = await supabase.storage
      .from(EVIDENCIA_TECNICA_BUCKET)
      .createSignedUrl(p, expiresSec);
    if (!error && data?.signedUrl) urls.push(data.signedUrl);
  }
  return urls;
}
