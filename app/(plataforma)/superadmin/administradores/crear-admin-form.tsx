"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { crearUsuarioConRol } from "@/app/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
};

const initialState = { success: false, error: null as string | null, data: null as { id: string } | null };

export function CrearAdminForm({ onSuccess, onCancel }: Props) {
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
      finca_id: null,
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
