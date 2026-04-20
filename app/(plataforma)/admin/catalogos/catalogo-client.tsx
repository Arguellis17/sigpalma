"use client";

import { useState } from "react";
import {
  crearItemCatalogo,
  inactivarItemCatalogo,
} from "@/app/actions/catalogos";
import type { CategoriaCatalogo } from "@/lib/validations/catalogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ItemRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  subcategoria: string | null;
  unidad_medida: string | null;
  proveedor: string | null;
  anio_adquisicion: number | null;
  sintomas: string | null;
  activo: boolean | null;
};

type Props = {
  categoria: CategoriaCatalogo;
  items: ItemRow[];
  /** Show sintomas field (fitosanitario) */
  showSintomas?: boolean;
  /** Label for unidad_medida (varies by category) */
  unidadLabel?: string;
};

export function CatalogoClient({
  categoria,
  items: initialItems,
  showSintomas = false,
  unidadLabel = "Unidad de medida",
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmInactivar, setConfirmInactivar] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const fd = new FormData(e.currentTarget);
    const anioRaw = fd.get("anio_adquisicion");

    const result = await crearItemCatalogo({
      nombre: fd.get("nombre"),
      categoria,
      descripcion: fd.get("descripcion") || null,
      subcategoria: fd.get("subcategoria") || null,
      unidad_medida: fd.get("unidad_medida") || null,
      proveedor: fd.get("proveedor") || null,
      anio_adquisicion: anioRaw ? Number(anioRaw) : null,
      sintomas: fd.get("sintomas") || null,
    });

    setPending(false);

    if (!result.success) {
      setError(result.error);
    } else {
      setSuccess("Ítem creado correctamente.");
      setShowForm(false);
      window.location.reload();
    }
  }

  async function handleInactivar(id: string) {
    const result = await inactivarItemCatalogo(id);
    if (!result.success) {
      setError(result.error);
    } else {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, activo: false } : item))
      );
      setConfirmInactivar(null);
    }
  }

  return (
    <div className="fade-up-enter space-y-6">
      {success ? (
        <div className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          {success}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Formulario crear */}
      {showForm ? (
        <div className="surface-panel rounded-2xl p-5 sm:p-6">
          <h3 className="mb-4 font-semibold text-foreground">Nuevo ítem</h3>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" name="nombre" required placeholder="Nombre del ítem" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subcategoria">Subcategoría</Label>
              <Input id="subcategoria" name="subcategoria" placeholder="Ej. Herbicida sistémico" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unidad_medida">{unidadLabel}</Label>
              <Input id="unidad_medida" name="unidad_medida" placeholder="Ej. kg, L, bolsa" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="proveedor">Proveedor</Label>
              <Input id="proveedor" name="proveedor" placeholder="Nombre del proveedor" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="anio_adquisicion">Año de adquisición</Label>
              <Input
                id="anio_adquisicion"
                name="anio_adquisicion"
                type="number"
                min={2000}
                max={new Date().getFullYear() + 1}
                placeholder={String(new Date().getFullYear())}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                name="descripcion"
                rows={2}
                placeholder="Descripción opcional"
                className="rounded-xl"
              />
            </div>

            {showSintomas ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sintomas">Síntomas / signos diagnósticos</Label>
                <Textarea
                  id="sintomas"
                  name="sintomas"
                  rows={3}
                  placeholder="Describa síntomas visibles en planta, fruto o suelo…"
                  className="rounded-xl"
                />
              </div>
            ) : null}

            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setShowForm(false); setError(null); }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Crear ítem"}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => { setShowForm(true); setError(null); setSuccess(null); }}>
            Nuevo ítem
          </Button>
        </div>
      )}

      {/* Lista */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ítems registrados ({items.filter((i) => i.activo !== false).length} activos)
        </h3>

        {items.length === 0 ? (
          <div className="surface-panel rounded-2xl py-12 text-center text-sm text-muted-foreground">
            Catálogo vacío. Agrega el primer ítem.
          </div>
        ) : (
          <div className="surface-panel overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Subcategoría</th>
                  <th className="hidden px-4 py-3 md:table-cell">Proveedor</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-b border-border/40 last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {item.nombre}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {item.subcategoria ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {item.proveedor ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={item.activo !== false ? "outline" : "destructive"}
                        className="text-xs"
                      >
                        {item.activo !== false ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.activo !== false ? (
                        confirmInactivar === item.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-muted-foreground">¿Confirmar?</span>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleInactivar(item.id)}
                            >
                              Sí
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmInactivar(null)}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setConfirmInactivar(item.id)}
                          >
                            Inactivar
                          </Button>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">Inactivo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
