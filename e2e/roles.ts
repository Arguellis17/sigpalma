import path from "node:path";
import { buildNavGroups } from "../components/app/nav-rol";
import { DASHBOARD_POR_ROL, ROLES, type RolUsuario } from "../lib/auth/rutas-rol";

export { DASHBOARD_POR_ROL, ROLES, type RolUsuario };

/** Credenciales desde el entorno: nunca en el repositorio. */
export function credenciales(rol: RolUsuario) {
  const email = process.env[`E2E_${rol.toUpperCase()}_EMAIL`];
  const password = process.env[`E2E_${rol.toUpperCase()}_PASSWORD`] ?? process.env.E2E_PASSWORD;
  return email && password ? { email, password } : null;
}

export const estadoSesion = (rol: RolUsuario) => path.join(__dirname, ".auth", `${rol}.json`);

export const rutasDe = (rol: RolUsuario) => buildNavGroups(rol).flatMap((g) => g.items.map((i) => i.href));

/** La cuenta no se pudo usar en este entorno: sus pruebas se omiten y el reporte lo dice. */
export const motivoOmitir = (rol: RolUsuario) => `Sin credenciales válidas de ${rol} (E2E_${rol.toUpperCase()}_EMAIL / E2E_PASSWORD).`;
