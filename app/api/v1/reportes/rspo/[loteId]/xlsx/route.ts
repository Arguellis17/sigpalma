import { NextResponse } from "next/server";
import { buildExpedienteRspoPdfData } from "@/app/actions/reportes-rspo";
import { buildExpedienteRspoWorkbook } from "@/lib/excel/expediente-rspo-workbook";

type Params = { params: Promise<{ loteId: string }> };

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** HU02: informe de trazabilidad RSPO en Excel para auditoría. */
export async function GET(_req: Request, { params }: Params) {
  const { loteId } = await params;
  const built = await buildExpedienteRspoPdfData(loteId, { formato: "xlsx" });
  if (!built.success) {
    return NextResponse.json({ error: built.error }, { status: 404 });
  }

  try {
    const buf = await buildExpedienteRspoWorkbook(built.data);
    const slug = built.data.lote_codigo.replace(/[^\w\-]+/g, "-").slice(0, 40);
    const filename = `expediente-rspo-${slug}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[rspo-xlsx]", e);
    return NextResponse.json(
      { error: "No se pudo generar el Excel del expediente RSPO." },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
