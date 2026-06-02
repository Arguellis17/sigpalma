import { getSessionProfile } from "@/lib/auth/session-profile";
import {
  getCosechasDisponiblesDespacho,
  getRemisionesPorFinca,
} from "@/app/actions/despacho";
import { DespachoOperarioClient } from "@/components/operario/despacho-operario-client";

export default async function OperarioDespachoPage() {
  const session = await getSessionProfile();
  const fincaId = session?.profile?.finca_id ?? null;

  const [dispRes, remRes] = fincaId
    ? await Promise.all([
        getCosechasDisponiblesDespacho(fincaId),
        getRemisionesPorFinca(fincaId),
      ])
    : [
        { success: false as const, error: "" },
        { success: false as const, error: "" },
      ];

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Despacho y remisiones
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Consolide fruta cosechada en acopio, registre el transporte y genere la remisión PDF.
        </p>
      </div>
      <DespachoOperarioClient
        fincaId={fincaId}
        initialDisponibles={dispRes.success ? dispRes.data : []}
        initialRemisiones={remRes.success ? remRes.data : []}
      />
    </div>
  );
}
