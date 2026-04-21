import {
  clampPage,
  DEFAULT_PAGE,
  parseEnumInt,
  parsePositiveInt,
  sanitizeIlikeFragment,
} from "@/lib/list-query";

export const AUDIT_PAGE_SIZES = [10, 20, 50] as const;
export type AuditPageSize = (typeof AUDIT_PAGE_SIZES)[number];

export const AUDIT_SORT_KEYS = [
  "created_at",
  "action_key",
  "titulo",
  "actor_id",
] as const;
export type AuditSortKey = (typeof AUDIT_SORT_KEYS)[number];

export type AuditoriaListQuery = {
  page: number;
  pageSize: AuditPageSize;
  sort: AuditSortKey;
  dir: "asc" | "desc";
  q: string;
};

const DEFAULT_PAGE_SIZE: AuditPageSize = 20;
const DEFAULT_SORT: AuditSortKey = "created_at";
const DEFAULT_DIR: "asc" | "desc" = "desc";

function parseSortKey(s: string | undefined): AuditSortKey {
  if (s && (AUDIT_SORT_KEYS as readonly string[]).includes(s)) {
    return s as AuditSortKey;
  }
  return DEFAULT_SORT;
}

function parseDir(s: string | undefined): "asc" | "desc" {
  return s === "asc" ? "asc" : s === "desc" ? "desc" : DEFAULT_DIR;
}

/** Parse `page`, `pageSize`, `sort`, `dir`, `q` from URL search params. */
export function parseAuditoriaListQuery(
  sp: Record<string, string | string[] | undefined>
): AuditoriaListQuery {
  const get = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const pageSize = parseEnumInt(get("pageSize"), AUDIT_PAGE_SIZES, DEFAULT_PAGE_SIZE);
  const sort = parseSortKey(get("sort"));
  const dir = parseDir(get("dir"));
  let page = parsePositiveInt(get("page"), DEFAULT_PAGE);
  const qRaw = get("q") ?? "";
  const q = sanitizeIlikeFragment(qRaw);

  return {
    page,
    pageSize,
    sort,
    dir,
    q,
  };
}

/** Clamp page after total count (mutates nothing; returns new query object). */
export function withClampedPage(
  query: AuditoriaListQuery,
  total: number
): AuditoriaListQuery {
  const page = clampPage(query.page, total, query.pageSize);
  return page === query.page ? query : { ...query, page };
}

export function nextSortToggle(
  currentSort: AuditSortKey,
  currentDir: "asc" | "desc",
  clicked: AuditSortKey
): { sort: AuditSortKey; dir: "asc" | "desc" } {
  if (clicked === currentSort) {
    return { sort: clicked, dir: currentDir === "asc" ? "desc" : "asc" };
  }
  const defaultDesc: AuditSortKey[] = ["created_at"];
  return {
    sort: clicked,
    dir: defaultDesc.includes(clicked) ? "desc" : "asc",
  };
}

export function auditoriaQueriesEqual(
  a: AuditoriaListQuery,
  b: AuditoriaListQuery
): boolean {
  return (
    a.page === b.page &&
    a.pageSize === b.pageSize &&
    a.sort === b.sort &&
    a.dir === b.dir &&
    a.q === b.q
  );
}

/** Serializa filtros de lista para `router` o `redirect` (sin `?`). */
export function auditoriaListToQueryString(
  q: AuditoriaListQuery,
  opts?: { fincaId?: string }
): string {
  const p = new URLSearchParams();
  if (opts?.fincaId) {
    p.set("finca", opts.fincaId);
  }
  p.set("page", String(q.page));
  p.set("pageSize", String(q.pageSize));
  p.set("sort", q.sort);
  p.set("dir", q.dir);
  if (q.q) {
    p.set("q", q.q);
  }
  return p.toString();
}
