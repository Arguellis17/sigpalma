"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cambiarContrasenaConSesion } from "@/app/actions/usuarios";
import { getRoleDashboardPath } from "@/lib/auth/role-dashboard-path";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CuentaContrasenaClient() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await cambiarContrasenaConSesion({
      current_password: current,
      password,
      confirm_password: confirm,
    });
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: prof } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };
    router.push(getRoleDashboardPath(prof?.role ?? null));
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cambiar contraseña</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indique su contraseña actual y la nueva contraseña (mínimo 8 caracteres).
        </p>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-6 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="cur-pw">Contraseña actual</Label>
          <Input
            id="cur-pw"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="min-h-11 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-pw">Nueva contraseña</Label>
          <Input
            id="new-pw"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-11 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-pw">Confirmar nueva contraseña</Label>
          <Input
            id="cf-pw"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="min-h-11 rounded-xl"
          />
        </div>
        {error ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Actualizar contraseña"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/auth/recuperar-contrasena">Olvidé mi contraseña</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
