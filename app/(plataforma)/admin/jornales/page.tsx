import { listarLiquidaciones, listarTarifas } from "@/app/actions/jornales";
import { getCatalogoLabores } from "@/app/actions/queries";
import { JornalesClient } from "@/components/admin/jornales-client";

export default async function AdminJornalesPage() {
  const [tarifas, liquidaciones, labores] = await Promise.all([
    listarTarifas(),
    listarLiquidaciones(),
    getCatalogoLabores(),
  ]);

  if (!tarifas.success || !liquidaciones.success || !labores.success) {
    const error = !tarifas.success ? tarifas.error : !liquidaciones.success ? liquidaciones.error : !labores.success ? labores.error : "";
    return (
      <div className="fade-up-enter space-y-6">
        <p className="surface-panel rounded-[1.5rem] p-4 text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="fade-up-enter space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Liquidación de jornales</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Calcule y consolide los pagos de cada trabajador según las labores que ejecutó y las tarifas vigentes.
        </p>
      </div>
      <JornalesClient tarifas={tarifas.data} liquidaciones={liquidaciones.data} labores={labores.data} />
    </div>
  );
}
