import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { TreePalm } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión | SIG-Palma",
  description: "Acceso a SIG-Palma",
};

type Props = {
  searchParams: Promise<{ redirectTo?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { redirectTo } = await searchParams;

  return (
    <div className="w-full max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <div className="surface-panel order-2 overflow-hidden rounded-[2.5rem] border border-border/70 p-0 shadow-[0_24px_80px_rgba(12,29,18,0.12)] dark:shadow-[0_28px_90px_rgba(0,0,0,0.55)] lg:order-1">
          <div className="relative min-h-[28rem] overflow-hidden lg:min-h-[40rem]">
            <Image
              src="/aceitepalma.jpg"
              alt="Palma de aceite vista desde abajo"
              fill
              priority
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,18,9,0.06)_0%,rgba(8,18,9,0.26)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(10,73,30,0.18),transparent_32%)]" />

            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6 lg:p-8">
              <div className="max-w-md rounded-[1.9rem] border border-white/15 bg-black/28 p-4 text-white backdrop-blur-md sm:p-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-white/85">
                  <TreePalm className="size-4" />
                  SIG·PALMA
                </div>
                <p className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
                  Del lote a la extractora,{" "}<span className="text-white/75">cada dato cuenta.</span>
                </p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-white/75">
                  Planificación, cosecha y trazabilidad certificada — todo en una sola plataforma.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 flex flex-col items-center justify-center gap-3 lg:order-2">
          <LoginForm redirectTo={redirectTo} />
          <p className="w-full max-w-md text-center text-xs text-muted-foreground">
            Cuentas creadas por administración.{" "}
            <Link
              href="mailto:soporte@sig-palma.co"
              className="font-medium text-primary underline underline-offset-4"
            >
              Contactar soporte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
