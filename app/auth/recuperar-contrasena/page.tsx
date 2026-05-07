"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setPending(false);
      setError("Indique un correo electrónico válido.");
      return;
    }

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const redirectTo = `${origin}/auth/confirm?next=${encodeURIComponent("/auth/restablecer-contrasena")}`;

    const supabase = createClient();
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });
    setPending(false);
    if (resetErr) {
      setError(resetErr.message);
      return;
    }
    setDone(true);
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-[2rem] border border-border/60 bg-background/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Recuperar contraseña
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Escriba el correo de su cuenta. Si existe en el sistema, recibirá un enlace para elegir una
        nueva contraseña.
      </p>
      {done ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm text-foreground">
            Si el correo está registrado, en breve recibirá instrucciones. Revise también la carpeta
            de spam.
          </p>
          <Button asChild variant="outline" className="min-h-12 w-full rounded-2xl">
            <Link href="/auth/login">Volver al inicio de sesión</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-rec">Correo electrónico</Label>
            <Input
              id="email-rec"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-12 rounded-2xl"
            />
          </div>
          {error ? (
            <p className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="min-h-12 rounded-2xl">
            {pending ? "Enviando…" : "Enviar enlace"}
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/auth/login" className="underline underline-offset-2 hover:text-foreground">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
