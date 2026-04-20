"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, TreePalm } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolveLoginIdentifier } from "@/app/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LoginFormProps = {
  /** Ruta interna tras login (misma app). */
  redirectTo?: string;
};

function normalizeRedirectTo(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }
  return path;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const afterLogin = normalizeRedirectTo(redirectTo);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    // Step 1: resolve email from identifier (email or cédula)
    const resolved = await resolveLoginIdentifier(identifier);
    if (!resolved.success) {
      setError(resolved.error);
      setPending(false);
      return;
    }

    // Step 2: sign in with the resolved email
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: resolved.data.email,
      password,
    });
    setPending(false);
    if (signError) {
      setError("Credenciales incorrectas. Verifica tu contraseña.");
      return;
    }
    window.location.assign(afterLogin);
  }

  return (
    <Card className="surface-panel fade-up-enter w-full rounded-[2rem] border border-border/60 py-0 shadow-[0_24px_80px_rgba(12,29,18,0.08)]">
      <CardHeader className="space-y-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/12 p-3 text-primary shadow-sm shadow-primary/10">
            <TreePalm className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              SIG·PALMA
            </p>
            <CardTitle className="text-2xl font-semibold tracking-tight">Iniciar sesión</CardTitle>
          </div>
        </div>
        <CardDescription>
          Ingresa con tu correo institucional o número de cédula.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="space-y-2">
            <Label htmlFor="identifier">Correo o cédula</Label>
            <Input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="correo@sigpalma.com o 1000123456"
              className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 text-base shadow-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                className="min-h-12 rounded-2xl border-border/70 bg-background/80 px-4 pr-12 text-base shadow-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-1.5 right-1.5 inline-flex min-h-9 min-w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Usa la contraseña asignada por tu administrador.
            </p>
          </div>
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/6 px-4 py-3"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-destructive">No pudimos iniciar sesión</p>
                <p className="text-xs leading-5 text-destructive/80">{error}</p>
              </div>
            </div>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="relative min-h-12 w-full rounded-2xl text-base shadow-lg shadow-primary/15 transition-all"
            disabled={pending}
          >
            <span
              className={`inline-flex items-center gap-2 transition-opacity duration-200 ${
                pending ? "opacity-0" : "opacity-100"
              }`}
            >
              Ingresar
              <ArrowRight className="size-4" />
            </span>
            {pending && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-5 animate-spin" />
              </span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
