"use client";

import { useState, useTransition } from "react";
import { ArrowRight, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Database } from "@/lib/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

type FincaOption = { id: string; nombre: string };

const SELECT_NONE = "__none__";

const allowedRoles = ["admin", "agronomo", "operario"] as const;

const roleLabels: Record<(typeof allowedRoles)[number], string> = {
  admin: "Administrador",
  agronomo: "Agrónomo",
  operario: "Operario",
};

export function RegisterForm({ fincas }: { fincas: FincaOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<(typeof allowedRoles)[number]>("operario");
  const [fincaId, setFincaId] = useState<string>("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await crearUsuarioConRol({
        email,
        password,
        full_name: fullName,
        role,
        finca_id: fincaId || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess("Usuario creado. Ya puede iniciar sesión con ese correo.");
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("operario");
      setFincaId("");
      router.refresh();
    });
  }

  const showFinca = true;

  return (
    <Card className="surface-panel fade-up-enter w-full max-w-md rounded-[2rem] border-0 py-0 shadow-none">
      <CardHeader className="space-y-2 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/12 p-3 text-primary shadow-sm shadow-primary/10">
            <UserPlus className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Gestión segura
            </p>
            <CardTitle className="text-2xl font-semibold tracking-tight">Registrar usuario</CardTitle>
          </div>
        </div>
        <CardDescription>
          Cree una cuenta con correo, contraseña y rol. Todo usuario distinto del
          superadministrador debe salir con una finca asignada.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="mb-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border/70">
            Alta por correo
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            Rol y finca
          </span>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="space-y-2">
            <Label htmlFor="reg-email">Correo</Label>
            <Input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-password">Contraseña inicial</Label>
            <Input
              id="reg-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            />
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-name">Nombre completo</Label>
            <Input
              id="reg-name"
              name="full_name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-role">Rol</Label>
            <input type="hidden" name="role" value={role} required />
            <Select
              value={role}
              onValueChange={(v) => setRole(v as (typeof allowedRoles)[number])}
            >
              <SelectTrigger id="reg-role" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none md:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showFinca ? (
            <div className="space-y-2">
              <Label htmlFor="reg-finca">Finca</Label>
              <input type="hidden" name="finca_id" value={fincaId} required />
              <Select
                value={fincas.some((f) => f.id === fincaId) ? fincaId : SELECT_NONE}
                onValueChange={(v) => setFincaId(v === SELECT_NONE ? "" : v)}
              >
                <SelectTrigger id="reg-finca" className="min-h-12 rounded-2xl border-border/70 bg-background/80 text-base shadow-none md:text-sm">
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
              {!fincas.length ? (
                <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                  No hay fincas. Cree una finca antes de registrar agrónomos u
                  operarios.
                </p>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700" role="status">
              {success}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="min-h-12 w-full rounded-2xl text-base shadow-lg shadow-primary/15"
            disabled={
              pending ||
              (showFinca && (fincas.length === 0 || !fincaId))
            }
          >
            {pending ? "Creando…" : "Crear usuario"}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
