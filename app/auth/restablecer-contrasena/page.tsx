"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cambiarContrasenaObligatoriaSchema } from "@/lib/validations/usuario";
import { getRoleDashboardPath } from "@/lib/auth/role-dashboard-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RestablecerContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setSessionReady(!!data.session);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = cambiarContrasenaObligatoriaSchema.safeParse({
      password,
      confirm_password: confirm,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join("; "));
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updErr } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    setPending(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: prof } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };
    router.push(getRoleDashboardPath(prof?.role ?? null));
    router.refresh();
  }

  if (sessionReady === false) {
    return (
      <div className="mx-auto w-full max-w-md rounded-[2rem] border border-border/60 bg-background/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Sesión requerida</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Abra el enlace del correo de recuperación o solicite uno nuevo.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button asChild className="min-h-12 rounded-2xl">
            <Link href="/auth/recuperar-contrasena">Solicitar enlace</Link>
          </Button>
          <Link
            href="/auth/login"
            className="text-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  if (sessionReady === null) {
    return (
      <div className="mx-auto w-full max-w-md rounded-[2rem] border border-border/60 bg-background/90 p-8 text-center text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-[2rem] border border-border/60 bg-background/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Nueva contraseña</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Elija una contraseña segura (mínimo 8 caracteres). Luego podrá iniciar sesión con ella.
      </p>
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="np-r">Nueva contraseña</Label>
          <Input
            id="np-r"
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
          <Label htmlFor="npc-r">Confirmar contraseña</Label>
          <Input
            id="npc-r"
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
          {pending ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/auth/login" className="underline underline-offset-2 hover:text-foreground">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
