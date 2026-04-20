"use client";

import { useState } from "react";
import {
  crearUsuarioConRol,
  inactivarUsuario,
} from "@/app/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Finca = { id: string; nombre: string };

type UsuarioRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  is_active: boolean;
  finca_nombre: string | null;
  created_at: string | null;
};

type Props = {
  fincas: Finca[];
  usuarios: UsuarioRow[];
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  agronomo: "Agrónomo",
  operario: "Operario",
};

export function UsuariosClient({ fincas, usuarios: initialUsuarios }: Props) {
  const [usuarios, setUsuarios] = useState(initialUsuarios);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"agronomo" | "operario">("agronomo");
  const [confirmInactivar, setConfirmInactivar] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const fd = new FormData(e.currentTarget);
    const fincaId = fd.get("finca_id") as string | null;

    const result = await crearUsuarioConRol({
      email: fd.get("email"),
      password: fd.get("password"),
      full_name: fd.get("full_name"),
      role: fd.get("role"),
      finca_id: fincaId || null,
    });

    setPending(false);

    if (!result.success) {
      setError(result.error);
    } else {
      setSuccess("Usuario creado correctamente.");
      setShowForm(false);
      // Reload page to get fresh list
      window.location.reload();
    }
  }

  async function handleInactivar(id: string) {
    const result = await inactivarUsuario(id);
    if (!result.success) {
      setError(result.error);
    } else {
      setUsuarios((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_active: false } : u))
      );
      setConfirmInactivar(null);
    }
  }

  return (
    <div className="fade-up-enter space-y-6">
      {/* Success/Error global */}
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

      {/* Crear usuario */}
      {showForm ? (
        <div className="surface-panel rounded-2xl p-5 sm:p-6">
          <h3 className="mb-4 font-semibold text-foreground">Nuevo usuario</h3>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input id="full_name" name="full_name" required placeholder="Ej. Juan Pérez" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" name="email" type="email" required placeholder="usuario@finca.co" />
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
              <Label htmlFor="role">Rol</Label>
              <select
                id="role"
                name="role"
                required
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as typeof selectedRole)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="agronomo">Agrónomo</option>
                <option value="operario">Operario</option>
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="finca_id">Finca asignada</Label>
              <select
                id="finca_id"
                name="finca_id"
                required
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Seleccione una finca…</option>
                {fincas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setShowForm(false); setError(null); }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creando…" : "Crear usuario"}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => { setShowForm(true); setError(null); setSuccess(null); }}>
            Nuevo usuario
          </Button>
        </div>
      )}

      {/* Tabla de usuarios */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Usuarios registrados ({usuarios.length})
        </h3>

        {usuarios.length === 0 ? (
          <div className="surface-panel rounded-2xl py-12 text-center text-sm text-muted-foreground">
            Aún no hay usuarios. Crea el primero arriba.
          </div>
        ) : (
          <div className="surface-panel overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Correo</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="hidden px-4 py-3 md:table-cell">Finca</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u, idx) => (
                  <tr
                    key={u.id}
                    className={`border-b border-border/40 last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {u.full_name ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {u.email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {u.role ? (roleLabels[u.role] ?? u.role) : "—"}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {u.finca_nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? "outline" : "destructive"} className="text-xs">
                        {u.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.is_active ? (
                        confirmInactivar === u.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs text-muted-foreground">¿Confirmar?</span>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleInactivar(u.id)}
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
                            onClick={() => setConfirmInactivar(u.id)}
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
