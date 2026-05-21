import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  listInventarioHerramientasForFinca,
} from "@/app/actions/herramientas";
import { InventarioHerramientasClient } from "@/components/inventario/inventario-herramientas-client";

export default async function OperarioInventarioHerramientasPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;
  const userId = session?.user?.id ?? "";

  if (!fincaId) {
    return (
      <div className="fade-up-enter space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Inventario de herramientas</h2>
        <p className="text-sm text-muted-foreground">
          Su usuario no tiene finca asignada. Contacte al administrador.
        </p>
      </div>
    );
  }

  const listResult = await listInventarioHerramientasForFinca(fincaId);
  const rows = listResult.success ? listResult.data : [];

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Inventario de herramientas
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Busque por código o nombre, tome herramientas disponibles y devuélvalas al terminar. Reporte
          daños o pérdidas con una descripción clara.
        </p>
      </div>
      {!listResult.success && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {listResult.error}
        </p>
      )}
      <InventarioHerramientasClient
        initialRows={rows}
        fincaId={fincaId}
        currentUserId={userId}
        mode="operario"
      />
    </div>
  );
}
