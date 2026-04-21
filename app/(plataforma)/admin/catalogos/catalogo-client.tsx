"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search } from "lucide-react";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import {
  crearItemCatalogo,
  actualizarItemCatalogo,
  inactivarItemCatalogo,
} from "@/app/actions/catalogos";
import type { CategoriaCatalogo } from "@/lib/validations/catalogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

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
  categoria?: string | null;
};

type Props = {
  categoria: CategoriaCatalogo;
  items: ItemRow[];
  showSintomas?: boolean;
  unidadLabel?: string;
  /** Allow selecting fitosanitario sub-category (plaga/enfermedad/otro) */
  allowCategorySelect?: boolean;
};

type ActiveSheet = { type: "create" } | { type: "edit"; item: ItemRow } | null;

export function CatalogoClient({
  categoria,
  items: initialItems,
  showSintomas = false,
  unidadLabel = "Unidad de medida",
  allowCategorySelect = false,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useServerPropsState(initialItems);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [sheet, setSheet] = useState<ActiveSheet>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmInactivar, setConfirmInactivar] = useState<ItemRow | null>(null);

  const filtered = useMemo(() => {
    let list = showInactive ? items : items.filter((i) => i.activo !== false);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.nombre.toLowerCase().includes(q) ||
          i.subcategoria?.toLowerCase().includes(q) ||
          i.proveedor?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, search, showInactive]);

  function closeSheet() {
    setSheet(null);
    setFormError(null);
  }

  function buildPayload(fd: FormData, forCreate: boolean) {
    const anioRaw = fd.get("anio_adquisicion");
    const cat = allowCategorySelect ? (fd.get("categoria_item") as CategoriaCatalogo ?? categoria) : categoria;
    return {
      ...(forCreate ? { categoria: cat } : {}),
      nombre: fd.get("nombre"),
      descripcion: fd.get("descripcion") || null,
      subcategoria: fd.get("subcategoria") || null,
      unidad_medida: fd.get("unidad_medida") || null,
      proveedor: fd.get("proveedor") || null,
      anio_adquisicion: anioRaw ? Number(anioRaw) : null,
      sintomas: fd.get("sintomas") || null,
    };
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const result = await crearItemCatalogo(buildPayload(fd, true));
    setPending(false);
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    toast("Ítem creado.", "success");
    closeSheet();
    router.refresh();
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sheet?.type !== "edit") return;
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const result = await actualizarItemCatalogo({
      id: sheet.item.id,
      ...buildPayload(fd, false),
    });
    setPending(false);
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    toast("Ítem actualizado.", "success");
    closeSheet();
    router.refresh();
  }

  async function handleInactivar() {
    if (!confirmInactivar) return;
    const result = await inactivarItemCatalogo(confirmInactivar.id);
    if (!result.success) {
      toast(result.error, "error");
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === confirmInactivar.id ? { ...i, activo: false } : i))
      );
      toast("Ítem inactivado.", "success");
    }
    setConfirmInactivar(null);
  }

  const ItemForm = ({ item }: { item?: ItemRow }) => (
    <form onSubmit={item ? handleEdit : handleCreate} className="flex flex-col gap-4">
      {allowCategorySelect ? (
        <div className="space-y-1.5">
          <Label htmlFor="ci-cat">Categoría <span className="text-destructive">*</span></Label>
          <select id="ci-cat" name="categoria_item" defaultValue={item?.categoria ?? "plaga"} className="flex min-h-12 w-full rounded-2xl border border-border/70 bg-background/80 px-4 text-base focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="plaga">Plaga</option>
            <option value="enfermedad">Enfermedad</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="ci-nombre">Nombre <span className="text-destructive">*</span></Label>
        <Input id="ci-nombre" name="nombre" required defaultValue={item?.nombre ?? ""} className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none" placeholder="Nombre del ítem" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ci-sub">Subcategoría</Label>
          <Input
            id="ci-sub"
            name="subcategoria"
            defaultValue={item?.subcategoria ?? ""}
            className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            placeholder={
              categoria === "insumo"
                ? "Nutrición, Fitosanitario o Herramienta (ej. Herbicida, Urea…)"
                : "Ej. Herbicida"
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ci-unidad">{unidadLabel}</Label>
          <Input id="ci-unidad" name="unidad_medida" defaultValue={item?.unidad_medida ?? ""} className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none" placeholder="kg, L, bolsa…" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ci-prov">Proveedor</Label>
          <Input id="ci-prov" name="proveedor" defaultValue={item?.proveedor ?? ""} className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ci-anio">Año adquisición</Label>
          <Input id="ci-anio" name="anio_adquisicion" type="number" min={2000} max={new Date().getFullYear() + 1} defaultValue={item?.anio_adquisicion ?? ""} className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ci-desc">Descripción</Label>
        <Textarea id="ci-desc" name="descripcion" rows={2} defaultValue={item?.descripcion ?? ""} className="rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base shadow-none" />
      </div>
      {showSintomas ? (
        <div className="space-y-1.5">
          <Label htmlFor="ci-sint">Síntomas / signos diagnósticos</Label>
          <Textarea id="ci-sint" name="sintomas" rows={3} defaultValue={item?.sintomas ?? ""} className="rounded-2xl border-border/70 bg-background/80 px-4 py-3 text-base shadow-none" placeholder="Síntomas visibles en planta, fruto o suelo…" />
        </div>
      ) : null}
      {formError ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive" role="alert">{formError}</p>
      ) : null}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={closeSheet} disabled={pending}>Cancelar</Button>
        <Button type="submit" disabled={pending} className="min-h-11">{pending ? "Guardando…" : item ? "Guardar cambios" : "Crear ítem"}</Button>
      </div>
    </form>
  );

  return (
    <div className="fade-up-enter space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar ítem…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-10 rounded-xl border-border/70 bg-background/80 pl-9 text-sm shadow-none"
            />
          </div>
          <Button
            variant={showInactive ? "secondary" : "outline"}
            size="sm"
            className="min-h-10 shrink-0 text-xs"
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? "Ocultar inactivos" : "Ver inactivos"}
          </Button>
        </div>
        <Button onClick={() => setSheet({ type: "create" })} className="min-h-10 shrink-0">
          <Plus className="mr-1.5 size-4" />
          Nuevo ítem
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-12 text-center text-sm text-muted-foreground">
          {search ? "No se encontraron ítems con ese criterio." : "Catálogo vacío. Agrega el primer ítem."}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((item) => (
              <div key={item.id} className="surface-panel rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{item.nombre}</p>
                  <Badge variant={item.activo !== false ? "outline" : "destructive"} className="text-xs shrink-0">
                    {item.activo !== false ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                {item.subcategoria ? <p className="mt-0.5 text-xs text-muted-foreground">{item.subcategoria}</p> : null}
                {item.proveedor ? <p className="mt-0.5 text-xs text-muted-foreground">Prov: {item.proveedor}</p> : null}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setSheet({ type: "edit", item })}>
                    <Pencil className="mr-1 size-3" /> Editar
                  </Button>
                  {item.activo !== false ? (
                    <Button size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive" onClick={() => setConfirmInactivar(item)}>
                      Inactivar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="surface-panel hidden overflow-hidden rounded-2xl md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Subcategoría</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={item.id} className={`border-b border-border/40 last:border-0 ${idx % 2 !== 0 ? "bg-muted/20" : ""}`}>
                    <td className="px-4 py-3 font-medium text-foreground">{item.nombre}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.subcategoria ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.proveedor ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={item.activo !== false ? "outline" : "destructive"} className="text-xs">
                        {item.activo !== false ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setSheet({ type: "edit", item })}>
                          <Pencil className="size-3.5" />
                        </Button>
                        {item.activo !== false ? (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive hover:text-destructive" onClick={() => setConfirmInactivar(item)}>
                            Inactivar
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create dialog */}
      <Dialog open={sheet?.type === "create"} onOpenChange={(v) => !v && closeSheet()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nuevo ítem</DialogTitle>
            <DialogDescription>Agrega un nuevo ítem al catálogo.</DialogDescription>
          </DialogHeader>
          <ItemForm />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={sheet?.type === "edit"} onOpenChange={(v) => !v && closeSheet()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar ítem</DialogTitle>
            <DialogDescription>Modifica los datos del ítem del catálogo.</DialogDescription>
          </DialogHeader>
          {sheet?.type === "edit" ? <ItemForm item={sheet.item} /> : null}
        </DialogContent>
      </Dialog>

      {/* Inactivar dialog */}
      <Dialog open={!!confirmInactivar} onOpenChange={(v) => !v && setConfirmInactivar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar inactivación</DialogTitle>
            <DialogDescription>
              ¿Inactivar <strong>{confirmInactivar?.nombre}</strong>? Dejará de aparecer en los formularios de labores.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfirmInactivar(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleInactivar}>Inactivar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

