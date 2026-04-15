import { z } from "zod";

const roles = ["admin", "agronomo", "operario"] as const;

export const crearUsuarioAdminSchema = z
  .object({
    email: z.string().email("Correo inválido."),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    full_name: z.string().min(1, "Indique el nombre.").max(200),
    role: z.enum(roles),
    finca_id: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "admin") {
      if (data.finca_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Los administradores no llevan finca asignada.",
          path: ["finca_id"],
        });
      }
      return;
    }
    if (!data.finca_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Seleccione la finca para agrónomo u operario.",
        path: ["finca_id"],
      });
    }
  });

export type CrearUsuarioAdminInput = z.infer<typeof crearUsuarioAdminSchema>;
