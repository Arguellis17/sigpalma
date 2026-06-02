import { z } from "zod";

export const consultarExpedienteRspoSchema = z.object({
  lote_id: z.string().uuid(),
});

export type ConsultarExpedienteRspoInput = z.infer<typeof consultarExpedienteRspoSchema>;
