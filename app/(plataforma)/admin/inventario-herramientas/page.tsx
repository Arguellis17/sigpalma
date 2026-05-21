import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  listCatalogoHerramientasActivas,
  listInventarioHerramientasForFinca,
} from "@/app/actions/herramientas";
import { InventarioHerramientasClient } from "@/components/inventario/inventario-herramientas-client";

export default async function AdminInventarioHerramientasPage() {
  const session = await getSessionProfile();
  if (!session?.profile) redirect("/login");

  const role = session.profile.role;
  if (role !== "admin" && role !== "superadmin") {
    redirect("/admin");
  }

  const fincaId = session.profile.finca_id;
  const userId = session.user.id;

  if (!fincaId && role !== "superadmin") {
    return (
      <div className="fade-up-enter space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Inventario de herramientas</h2>
        <p className="text-sm text-muted-foreground">
          Asigne una finca a su perfil de administrador para gestionar el inventario.
        </p>
      </div>
    );
  }

  let effectiveFincaId = fincaId;
  if (role === "superadmin" && !effectiveFincaId) {
    const supabase = await createClient();
    const { data: fincas } = await supabase
      .from("fincas")
      .select("id")
      .eq("is_active", true)
      .order("nombre")
      .limit(1);
    effectiveFincaId = fincas?.[0]?.id ?? null;
  }

  if (!effectiveFincaId) {
    return (
      <div className="fade-up-enter space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Inventario de herramientas</h2>
        <p className="text-sm text-muted-foreground">No hay fincas activas registradas.</p>
      </div>
    );
  }

  const [listResult, catalogoResult] = await Promise.all([
    listInventarioHerramientasForFinca(effectiveFincaId),
    listCatalogoHerramientasActivas(),
  ]);

  const rows = listResult.success ? listResult.data : [];
  const catalogo = catalogoResult.success ? catalogoResult.data : [];

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Inventario de herramientas
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vista por finca: dé de alta activos vinculados al catálogo de insumos tipo herramienta y
          supervise su estado.
        </p>
      </div>
      {!listResult.success && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {listResult.error}
        </p>
      )}
      <InventarioHerramientasClient
        initialRows={rows}
        fincaId={effectiveFincaId}
        currentUserId={userId}
        mode="admin"
        catalogoHerramientas={catalogo}
      />
    </div>
  );
}
