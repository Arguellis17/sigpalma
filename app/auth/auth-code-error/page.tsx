import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Enlace inválido | SIG-Palma",
  description: "No se pudo validar el enlace de acceso.",
};

export default function AuthCodeErrorPage() {
  return (
    <div className="mx-auto w-full max-w-md rounded-[2rem] border border-border/60 bg-background/90 p-6 shadow-sm backdrop-blur-sm sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Enlace inválido o vencido
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        El enlace de recuperación no es válido, ya expiró o ya fue usado. Solicite un nuevo correo
        desde la página de recuperación de contraseña.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/auth/recuperar-contrasena"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-4 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Solicitar nuevo enlace
        </Link>
        <Link
          href="/auth/login"
          className="text-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
