"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPinned, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FincaCreateForm } from "@/components/fincas/finca-create-form";

type Finca = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  area_ha: string | number | null;
  propietario: string | null;
  created_at: string;
};

type Props = { fincas: Finca[]; canCreateFinca: boolean };

export function FincasClient({ fincas: initialFincas, canCreateFinca }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const fincas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialFincas;
    return initialFincas.filter(
      (f) =>
        f.nombre.toLowerCase().includes(q) ||
        f.ubicacion?.toLowerCase().includes(q) ||
        f.propietario?.toLowerCase().includes(q)
    );
  }, [initialFincas, search]);

  function handleCreated(_id: string) {
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="fade-up-enter space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar finca…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-10 rounded-xl border-border/70 bg-background/80 pl-9 text-sm shadow-none"
          />
        </div>
        {canCreateFinca ? (
          <Button
            onClick={() => setOpen(true)}
            className="min-h-10 shrink-0"
          >
            <Plus className="mr-1.5 size-4" />
            Nueva finca
          </Button>
        ) : null}
      </div>

      {/* Grid */}
      {fincas.length === 0 ? (
        <div className="surface-panel rounded-2xl py-16 text-center">
          <MapPinned className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {search ? "No se encontraron fincas con ese criterio." : "No hay fincas registradas. Crea la primera."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fincas.map((finca) => (
            <Link
              key={finca.id}
              href={`/admin/fincas/${finca.id}`}
              className="surface-panel group rounded-2xl p-5 ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:ring-primary/30"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <MapPinned className="size-4" />
                </div>
                {finca.area_ha ? (
                  <Badge variant="secondary" className="text-xs">
                    {finca.area_ha} ha
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 font-semibold text-foreground">{finca.nombre}</p>
              {finca.ubicacion ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{finca.ubicacion}</p>
              ) : null}
              {finca.propietario ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Propietario: {finca.propietario}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={canCreateFinca && open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva finca</DialogTitle>
            <DialogDescription>
              Registra una nueva finca con su área y ubicación.
            </DialogDescription>
          </DialogHeader>
          <FincaCreateForm
            onSuccess={handleCreated}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
