import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { ExpedienteRspoDocument } from "@/lib/pdf/expediente-rspo-document";
import type { ExpedienteRspoPdfData } from "@/lib/pdf/expediente-rspo-types";

export async function renderExpedienteRspoPdfBuffer(
  data: ExpedienteRspoPdfData
): Promise<Buffer> {
  const element = createElement(ExpedienteRspoDocument, { data });
  const buf = await renderToBuffer(element as ReactElement<DocumentProps>);
  return Buffer.from(buf);
}
