import { NextResponse } from "next/server";
import { buildExpedienteRspoPdfData } from "@/app/actions/reportes-rspo";
import { renderExpedienteRspoPdfBuffer } from "@/lib/pdf/render-expediente-rspo-pdf";

type Params = { params: Promise<{ loteId: string }> };

/** HU09: expediente RSPO en PDF (Node + @react-pdf/renderer). */
export async function GET(_req: Request, { params }: Params) {
  const { loteId } = await params;
  const built = await buildExpedienteRspoPdfData(loteId);
  if (!built.success) {
    return NextResponse.json({ error: built.error }, { status: 404 });
  }

  try {
    const buf = await renderExpedienteRspoPdfBuffer(built.data);
    const filename = `expediente-rspo-${built.data.lote_codigo}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[rspo-pdf]", e);
    return NextResponse.json(
      { error: "No se pudo generar el expediente RSPO." },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
