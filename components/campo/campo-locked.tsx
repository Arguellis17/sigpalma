import type { Tables } from "@/lib/database.types";

type Props = {
  profile: Tables<"profiles"> | null;
};

export function CampoLocked({ profile }: Props) {
  const reason =
    profile?.role === "admin"
      ? "El rol administrador no registra labores ni cosecha en campo (política RLS). Use un usuario operario o agrónomo con finca asignada, o pruebe con otro entorno."
      : !profile?.finca_id
        ? "Su perfil no tiene finca asignada. Un administrador debe vincular su cuenta a una finca."
        : "Su cuenta no puede registrar operaciones de campo.";

  return (
    <div
      className="surface-panel rounded-[1.75rem] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-950"
      role="status"
    >
      <p className="font-medium tracking-tight">Registro en campo no disponible</p>
      <p className="mt-2 leading-6 text-amber-900/90">{reason}</p>
    </div>
  );
}
