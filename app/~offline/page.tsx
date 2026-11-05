import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión · SIG-Palma" };

/**
 * Respaldo que muestra el service worker cuando se abre una página que aún no está guardada en el
 * dispositivo y no hay señal. Es estática: no depende de la sesión ni de la base de datos.
 */
export default function SinConexionPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <img src="/icons/icon-192.png" alt="" width={96} height={96} className="rounded-2xl" />
      <h1 className="text-2xl font-bold">Sin conexión</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Esta página todavía no está guardada en el dispositivo. Las páginas que ya abrió y los
        formularios de campo siguen funcionando sin señal; lo que registre se guarda y se
        sincroniza solo cuando vuelva la conexión.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <a href="/" className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-semibold text-primary-foreground">
          Ir al inicio
        </a>
        <a href="" className="inline-flex min-h-12 items-center rounded-2xl border border-border px-5 font-semibold">
          Reintentar
        </a>
      </div>
    </main>
  );
}
