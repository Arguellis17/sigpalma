import { z } from "zod";

// Roles that non-superadmin admins can assign (cannot escalate to admin or superadmin)
export const rolesAsignablesPorAdmin = ["agronomo", "operario"] as const;
// Roles superadmin can assign (all except superadmin itself)
export const rolesAsignablesPorSuperadmin = ["admin", "agronomo", "operario"] as const;

export const crearUsuarioAdminSchema = z
  .object({
    email: z.string().email("Correo inválido."),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    full_name: z.string().min(1, "Indique el nombre.").max(200),
    role: z.enum(["admin", "agronomo", "operario"]),
    finca_id: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.finca_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Seleccione la finca para el usuario.",
        path: ["finca_id"],
      });
    }
  });

export type CrearUsuarioAdminInput = z.infer<typeof crearUsuarioAdminSchema>;

export const actualizarUsuarioSchema = z.object({
  id: z.string().uuid("ID inválido."),
  full_name: z.string().min(1, "Indique el nombre.").max(200).optional(),
  finca_id: z.string().uuid().nullable().optional(),
  documento_identidad: z.string().max(30).nullable().optional(),
});

export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;

export const restablecerContrasenaSchema = z.object({
  id: z.string().uuid("ID inválido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export type RestablecerContrasenaInput = z.infer<typeof restablecerContrasenaSchema>;

