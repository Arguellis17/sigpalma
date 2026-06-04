import type { createClient } from "@/lib/supabase/server";
import { actionError, actionOk, type ActionResult } from "@/app/actions/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Valida que el perfil sea operario activo de la finca indicada (HU11/HU13).
 */
export async function assertOperarioAsignadoFinca(
  supabase: Supabase,
  fincaId: string,
  operarioId: string
): Promise<ActionResult<{ nombre: string }>> {
  const { data: p, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, finca_id, is_active")
    .eq("id", operarioId)
    .maybeSingle();

  if (error || !p) return actionError("Operario no encontrado.");
  if (!p.is_active) return actionError("El operario seleccionado no está activo.");
  if (p.role !== "operario") {
    return actionError("Solo puede asignar usuarios con rol operario.");
  }
  if (p.finca_id !== fincaId) {
    return actionError("El operario no pertenece a esta finca.");
  }
  return actionOk({ nombre: p.full_name || "Operario" });
}
