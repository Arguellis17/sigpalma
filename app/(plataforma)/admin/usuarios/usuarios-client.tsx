"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useServerPropsState } from "@/hooks/use-server-props-state";
import { KeyRound, Pencil, Plus, Search, UserCheck, UserMinus } from "lucide-react";
import {
  crearUsuarioConRol,
  actualizarUsuario,
  inactivarUsuario,
  reactivarUsuario,
  restablecerContrasena,
} from "@/app/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type Finca = { id: string; nombre: string };

type UsuarioRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  is_active: boolean;
  finca_nombre: string | null;
  finca_id?: string | null;
  documento_identidad?: string | null;
  created_at: string | null;
};

type Props = {
  fincas: Finca[];
  usuarios: UsuarioRow[];
  /** "all" shows admin/agronomo/operario; "admin-only" restricts to admin role */
  scope?: "all" | "admin-only";
};

const SELECT_NONE = "__none__";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  agronomo: "Agrónomo",
  operario: "Operario",
};

type ActiveSheet =
  | { type: "create" }
  | { type: "edit"; usuario: UsuarioRow }
  | { type: "resetPassword"; usuario: UsuarioRow }
  | null;

export function UsuariosClient({ fincas, usuarios: initialUsuarios, scope = "all" }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useServerPropsState(initialUsuarios);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [sheet, setSheet] = useState<ActiveSheet>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tempPasswordShown, setTempPasswordShown] = useState<string | null>(null);
  const [confirmInactivar, setConfirmInactivar] = useState<UsuarioRow | null>(null);
  const [createRole, setCreateRole] = useState<"admin" | "agronomo" | "operario">(
    scope === "admin-only" ? "admin" : "agronomo"
  );
  const [createFincaId, setCreateFincaId] = useState("");
  const [editFincaId, setEditFincaId] = useState("");

  useEffect(() => {
    if (sheet?.type === "create") {
      setCreateRole(scope === "admin-only" ? "admin" : "agronomo");
      setCreateFincaId("");
    }
  }, [sheet, scope]);

  useEffect(() => {
    if (sheet?.type === "edit") {
      setEditFincaId(sheet.usuario.finca_id ?? "");
    }
  }, [sheet]);

  const filtered = useMemo(() => {
    let list = showInactive ? usuarios : usuarios.filter((u) => u.is_active);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.finca_nombre?.toLowerCase().includes(q)
    );
  }, [usuarios, search, showInactive]);

  function closeSheet() {
    setSheet(null);
    setFormError(null);
    setTempPasswordShown(null);
  }

  useEffect(() => {
    if (sheet?.type !== "resetPassword") {
      setTempPasswordShown(null);
    }
  }, [sheet]);

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const result = await crearUsuarioConRol({
      email: fd.get("email"),
      password: fd.get("password"),
      full_name: fd.get("full_name"),
      role: fd.get("role"),
      finca_id: fd.get("finca_id") || null,
    });
    setPending(false);
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    toast("Usuario creado correctamente.", "success");
    closeSheet();
    router.refresh();
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sheet?.type !== "edit") return;
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const result = await actualizarUsuario({
      id: sheet.usuario.id,
      full_name: fd.get("full_name"),
      finca_id: fd.get("finca_id") || null,
      documento_identidad: fd.get("documento_identidad") || null,
    });
    setPending(false);
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    toast("Usuario actualizado.", "success");
    closeSheet();
    router.refresh();
  }

  // ── Reset password (RN07: temporal + cambio obligatorio) ──────────────────
  async function handleGenerateTemporaryPassword() {
    if (sheet?.type !== "resetPassword") return;
    setFormError(null);
    setPending(true);
    const result = await restablecerContrasena({ id: sheet.usuario.id });
    setPending(false);
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    setTempPasswordShown(result.data.temporary_password);
    toast(
      "Contraseña temporal generada. Comuníquela al usuario; deberá elegir una nueva al entrar.",
      "success"
    );
    router.refresh();
  }

  // ── Inactivar ────────────────────────────────────────────────────────────────
  async function handleInactivar() {
    if (!confirmInactivar) return;
    const result = await inactivarUsuario(confirmInactivar.id);
    if (!result.success) {
      toast(result.error, "error");
    } else {
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === confirmInactivar.id ? { ...u, is_active: false } : u
        )
      );
      toast("Usuario inactivado.", "success");
    }
    setConfirmInactivar(null);
  }

  // ── Reactivar ────────────────────────────────────────────────────────────────
  async function handleReactivar(usuario: UsuarioRow) {
    const result = await reactivarUsuario(usuario.id);
    if (!result.success) {
      toast(result.error, "error");
    } else {
      setUsuarios((prev) =>
        prev.map((u) => (u.id === usuario.id ? { ...u, is_active: true } : u))
      );
      toast("Usuario reactivado.", "success");
    }
  }

  return (
    <div className="fade-up-enter space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar usuario…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-10 rounded-xl border-border/70 bg-background/80 pl-9 text-sm shadow-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className={`inline-flex min-h-10 items-center rounded-xl border px-3 text-sm transition-colors ${
              showInactive
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/70 bg-background/80 text-muted-foreground hover:text-foreground"
            }`}
          >
            {showInactive ? "Ocultar inactivos" : "Ver inactivos"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setSheet({ type: "create" })}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Nuevo usuario
        </button>
      </div>

      {/* User list */}
      {filtered.length === 0 ? (
        <div className="surface-panel rounded-2xl py-12 text-center text-sm text-muted-foreground">
          {search ? "No se encontraron usuarios con ese criterio." : "Aún no hay usuarios. Crea el primero."}
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((u) => (
              <div key={u.id} className="surface-panel rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{u.full_name ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{u.email ?? "—"}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {u.role ? (roleLabels[u.role] ?? u.role) : "—"}
                    </Badge>
                    <Badge variant={u.is_active ? "outline" : "destructive"} className="text-xs">
                      {u.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </div>
                {u.finca_nombre ? (
                  <p className="mt-1 text-xs text-muted-foreground">Finca: {u.finca_nombre}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setSheet({ type: "edit", usuario: u })}>
                    <Pencil className="mr-1 size-3" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setSheet({ type: "resetPassword", usuario: u })}>
                    <KeyRound className="mr-1 size-3" /> Contraseña
                  </Button>
                  {u.is_active ? (
                    <Button size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive" onClick={() => setConfirmInactivar(u)}>
                      <UserMinus className="mr-1 size-3" /> Inactivar
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-xs text-primary hover:text-primary" onClick={() => handleReactivar(u)}>
                      <UserCheck className="mr-1 size-3" /> Reactivar
                    </Button>
                  )}
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
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Finca</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => (
                  <tr
                    key={u.id}
                    className={`border-b border-border/40 last:border-0 ${idx % 2 !== 0 ? "bg-muted/20" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{u.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {u.role ? (roleLabels[u.role] ?? u.role) : "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.finca_nombre ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? "outline" : "destructive"} className="text-xs">
                        {u.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setSheet({ type: "edit", usuario: u })}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setSheet({ type: "resetPassword", usuario: u })}>
                          <KeyRound className="size-3.5" />
                        </Button>
                        {u.is_active ? (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive hover:text-destructive" onClick={() => setConfirmInactivar(u)}>
                            <UserMinus className="size-3.5" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-primary hover:text-primary" onClick={() => handleReactivar(u)}>
                            <UserCheck className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── Create Dialog ──────────────────────────────────────────────────────────── */}
      <Dialog open={sheet?.type === "create"} onOpenChange={(v) => !v && closeSheet()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>Crea una cuenta con rol de {scope === "admin-only" ? "Administrador" : "Agrónomo u Operario"}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cu-nombre">Nombre completo <span className="text-destructive">*</span></Label>
              <Input id="cu-nombre" name="full_name" required placeholder="Ej. Juan Pérez" className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-email">Correo electrónico <span className="text-destructive">*</span></Label>
              <Input id="cu-email" name="email" type="email" required placeholder="usuario@finca.co" className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-password">Contraseña temporal <span className="text-destructive">*</span></Label>
              <Input id="cu-password" name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cu-role">Rol <span className="text-destructive">*</span></Label>
                <input type="hidden" name="role" value={createRole} required />
                <Select
                  value={createRole}
                  onValueChange={(v) =>
                    setCreateRole(v as "admin" | "agronomo" | "operario")
                  }
                >
                  <SelectTrigger id="cu-role" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scope === "admin-only" ? (
                      <SelectItem value="admin">Administrador</SelectItem>
                    ) : (
                      <>
                        <SelectItem value="agronomo">Agrónomo</SelectItem>
                        <SelectItem value="operario">Operario</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cu-finca">Finca asignada {scope !== "admin-only" && <span className="text-destructive">*</span>}</Label>
                <input
                  type="hidden"
                  name="finca_id"
                  value={createFincaId}
                  required={scope !== "admin-only"}
                />
                <Select
                  value={fincas.some((f) => f.id === createFincaId) ? createFincaId : SELECT_NONE}
                  onValueChange={(v) => setCreateFincaId(v === SELECT_NONE ? "" : v)}
                >
                  <SelectTrigger id="cu-finca" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
                    <SelectValue placeholder="Seleccione…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE} disabled className="opacity-60">
                      Seleccione…
                    </SelectItem>
                    {fincas.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formError ? (
              <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive" role="alert">{formError}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={closeSheet} disabled={pending}>Cancelar</Button>
              <Button type="submit" disabled={pending} className="min-h-11">{pending ? "Creando…" : "Crear usuario"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Dialog ──────────────────────────────────────────────────────────── */}
      <Dialog open={sheet?.type === "edit"} onOpenChange={(v) => !v && closeSheet()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>Modifica el nombre y la finca asignada.</DialogDescription>
          </DialogHeader>
          {sheet?.type === "edit" ? (
            <form onSubmit={handleEdit} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="eu-nombre">Nombre completo <span className="text-destructive">*</span></Label>
                <Input id="eu-nombre" name="full_name" required defaultValue={sheet.usuario.full_name ?? ""} className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-finca">Finca asignada</Label>
                <input type="hidden" name="finca_id" value={editFincaId} />
                <Select
                  value={editFincaId || "__none__"}
                  onValueChange={(v) => setEditFincaId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger id="eu-finca" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none">
                    <SelectValue placeholder="Sin finca" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin finca</SelectItem>
                    {fincas.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-doc">Cédula / Documento de identidad</Label>
                <Input
                  id="eu-doc"
                  name="documento_identidad"
                  defaultValue={sheet.usuario.documento_identidad ?? ""}
                  placeholder="Ej. 1000123456"
                  maxLength={30}
                  className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
                />
                <p className="text-xs text-muted-foreground">Permite iniciar sesión con la cédula en lugar del correo.</p>
              </div>
              {formError ? (
                <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive" role="alert">{formError}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={closeSheet} disabled={pending}>Cancelar</Button>
                <Button type="submit" disabled={pending} className="min-h-11">{pending ? "Guardando…" : "Guardar cambios"}</Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ─── Reset Password Dialog ────────────────────────────────────────────────────────── */}
      <Dialog open={sheet?.type === "resetPassword"} onOpenChange={(v) => !v && closeSheet()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>
              {sheet?.type === "resetPassword"
                ? `Se generará una contraseña temporal para ${sheet.usuario.full_name ?? sheet.usuario.email ?? "el usuario"}. En el próximo inicio de sesión deberá elegir una contraseña nueva.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {sheet?.type === "resetPassword" ? (
            <div className="flex flex-col gap-4">
              {tempPasswordShown ? (
                <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Contraseña temporal (cópiela ahora)
                  </p>
                  <p className="break-all font-mono text-base font-semibold tracking-wide text-foreground">
                    {tempPasswordShown}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Esta ventana es la única vez que verá la contraseña completa en el sistema.
                  </p>
                </div>
              ) : null}
              {formError ? (
                <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive" role="alert">{formError}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={closeSheet} disabled={pending}>
                  {tempPasswordShown ? "Cerrar" : "Cancelar"}
                </Button>
                {!tempPasswordShown ? (
                  <Button
                    type="button"
                    disabled={pending}
                    className="min-h-11"
                    onClick={handleGenerateTemporaryPassword}
                  >
                    {pending ? "Generando…" : "Generar contraseña temporal"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ─── Inactivar Dialog ─────────────────────────────────────── */}
      <Dialog open={!!confirmInactivar} onOpenChange={(v) => !v && setConfirmInactivar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar inactivación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas inactivar la cuenta de{" "}
              <strong>{confirmInactivar?.full_name ?? confirmInactivar?.email ?? "este usuario"}</strong>?
              El usuario no podrá iniciar sesión. Esta acción es reversible desde la base de datos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setConfirmInactivar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleInactivar}>
              Inactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
