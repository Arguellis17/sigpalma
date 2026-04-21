/** Shared helpers for paginated list URLs and Supabase range queries. */

export const DEFAULT_PAGE = 1;

export function sanitizeIlikeFragment(raw: string): string {
  return raw.trim().slice(0, 120).replace(/[%_\\]/g, "");
}

export function parsePositiveInt(s: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(s ?? ""), 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

export function parseEnumInt<T extends number>(
  s: string | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  const n = Number.parseInt(String(s ?? ""), 10);
  return allowed.includes(n as T) ? (n as T) : fallback;
}

export function offsetFromPage(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/** After count is known, clamp page into valid range. */
export function clampPage(page: number, total: number, pageSize: number): number {
  const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1);
  return Math.min(Math.max(1, page), maxPage);
}
