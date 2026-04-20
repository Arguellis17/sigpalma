"use client";

import { useRef, useState } from "react";
import { crearUsuarioConRol } from "@/app/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FincaOption = { id: string; nombre: string };

type Props = {
  fincas: FincaOption[];
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
};

export function CrearAdminForm({ fincas, onSuccess, onCancel }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const result = await crearUsuarioConRol({
      email: fd.get("email"),
      password: fd.get("password"),
      full_name: fd.get("full_name"),
      role: "admin",
      finca_id: fd.get("finca_id") || null,
    });

    setPending(false);

    if (!result.success) {
      setError(result.error);
    } else {
      formRef.current?.reset();
      onSuccess?.(result.data.id);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="full_name">Nombre completo</Label>
        <Input id="full_name" name="full_name" required placeholder="Ej. María García" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input id="email" name="email" type="email" required placeholder="admin@finca.co" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña temporal</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="finca_id">Finca asignada</Label>
        <select
          id="finca_id"
          name="finca_id"
          required
          className="flex min-h-12 w-full rounded-2xl border border-border/70 bg-background/80 px-4 text-base focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Seleccione una finca…</option>
          {fincas.map((finca) => (
            <option key={finca.id} value={finca.id}>
              {finca.nombre}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Cada administrador queda asociado a una finca específica.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear administrador"}
        </Button>
      </div>
    </form>
  );
}
