"use client";

import { useState } from "react";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setPending(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    window.location.assign(afterLogin);
  }

  return (
    <Card className="surface-panel fade-up-enter w-full max-w-md rounded-[2rem] border-0 py-0 shadow-none">
      <CardHeader className="space-y-2 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/12 p-3 text-primary shadow-sm shadow-primary/10">
            <ShieldCheck className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Acceso seguro
            </p>
            <CardTitle className="text-2xl font-semibold tracking-tight">SIG-Palma</CardTitle>
          </div>
        </div>
        <CardDescription>
          Ingrese con su correo y contraseña para acceder a los módulos habilitados
          para su perfil.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="mb-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border/70">
            Email + contraseña
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            Acceso controlado
          </span>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.nombre@sigpalma.com"
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
              Use la cuenta asignada por administración.
            </p>
          </div>
          {error ? (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="min-h-12 w-full rounded-2xl text-base shadow-lg shadow-primary/15"
            disabled={pending}
          >
            {pending ? "Ingresando…" : "Ingresar"}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
