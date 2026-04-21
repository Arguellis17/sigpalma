"use client";

import { useRef, useState } from "react";
import { crearUsuarioConRol } from "@/app/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FincaOption = { id: string; nombre: string };

const SELECT_NONE = "__none__";

type Props = {
  fincas: FincaOption[];
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
};

export function CrearAdminForm({ fincas, onSuccess, onCancel }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fincaId, setFincaId] = useState("");
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
      setFincaId("");
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
        <input type="hidden" name="finca_id" value={fincaId} required />
        <Select
          value={fincas.some((f) => f.id === fincaId) ? fincaId : SELECT_NONE}
          onValueChange={(v) => setFincaId(v === SELECT_NONE ? "" : v)}
        >
          <SelectTrigger id="finca_id" className="rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
            <SelectValue placeholder="Seleccione una finca…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_NONE} disabled className="opacity-60">
              Seleccione una finca…
            </SelectItem>
            {fincas.map((finca) => (
              <SelectItem key={finca.id} value={finca.id}>
                {finca.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
