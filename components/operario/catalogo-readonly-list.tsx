"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ReadonlyCatalogRow = {
  id: string;
  nombre: string;
  subcategoria: string | null;
  unidad_medida: string | null;
  descripcion: string | null;
  proveedor?: string | null;
  sintomas?: string | null;
  categoria?: string | null;
};

type Props = {
  title: string;
  description: string;
  rows: ReadonlyCatalogRow[];
  extraColumns?: { key: keyof ReadonlyCatalogRow; label: string }[];
};

export function CatalogoReadonlyList({
  title,
  description,
  rows,
  extraColumns = [],
}: Props) {
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<ReadonlyCatalogRow | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.nombre.toLowerCase().includes(s) ||
        r.subcategoria?.toLowerCase().includes(s) ||
        r.descripcion?.toLowerCase().includes(s) ||
        r.proveedor?.toLowerCase().includes(s) ||
        r.categoria?.toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <div className="fade-up-enter space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          className="min-h-11 rounded-2xl border-border/70 bg-background/80 pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="surface-panel rounded-2xl p-6 text-sm text-muted-foreground">
          No hay ítems activos que coincidan.
        </p>
      ) : (
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Subcategoría</th>
                  {extraColumns.map((c) => (
                    <th key={String(c.key)} className="px-4 py-3">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/40 last:border-0 ${
                      idx % 2 !== 0 ? "bg-muted/15" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {r.nombre}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.subcategoria ?? "—"}
                    </td>
                    {extraColumns.map((c) => (
                      <td key={String(c.key)} className="px-4 py-3 text-muted-foreground">
                        {(r[c.key] as string | null | undefined) ?? "—"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-xs"
                        onClick={() => setDetail(r)}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.nombre}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <dl className="space-y-3 text-sm">
              {detail.categoria ? (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Categoría
                  </dt>
                  <dd>{detail.categoria}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Subcategoría
                </dt>
                <dd>{detail.subcategoria ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Unidad
                </dt>
                <dd>{detail.unidad_medida ?? "—"}</dd>
              </div>
              {detail.proveedor ? (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Proveedor
                  </dt>
                  <dd>{detail.proveedor}</dd>
                </div>
              ) : null}
              {detail.sintomas ? (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Síntomas / notas
                  </dt>
                  <dd className="whitespace-pre-wrap">{detail.sintomas}</dd>
                </div>
              ) : null}
              {detail.descripcion ? (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Descripción
                  </dt>
                  <dd className="whitespace-pre-wrap text-muted-foreground">
                    {detail.descripcion}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
