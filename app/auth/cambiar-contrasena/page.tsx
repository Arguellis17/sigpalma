"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cambiarContrasenaObligatoria } from "@/app/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function dashboardForRole(role: string | null | undefined): string {
  switch (role) {
    case "superadmin":
      return "/superadmin";
    case "admin":
      return "/admin";
    case "agronomo":
      return "/tecnico";
    case "operario":
      return "/operario";
    default:
      return "/auth/login";
  }
}

export default function CambiarContrasenaObligatoriaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await cambiarContrasenaObligatoria({
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
    router.push(dashboardForRole(prof?.role ?? null));
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-[2rem] border border-border/60 bg-background/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Nueva contraseña
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Su administrador restableció el acceso. Elija una contraseña segura (mínimo 8
        caracteres) para continuar.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="np">Nueva contraseña</Label>
          <Input
            id="np"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 rounded-2xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="npc">Confirmar contraseña</Label>
          <Input
            id="npc"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="min-h-12 rounded-2xl"
          />
        </div>
        {error ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="min-h-12 rounded-2xl">
          {pending ? "Guardando…" : "Guardar y continuar"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/auth/login" className="underline underline-offset-2 hover:text-foreground">
          Cerrar sesión
        </Link>
      </p>
    </div>
  );
}
