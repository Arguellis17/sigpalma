import type { Metadata } from "next";
import CuentaContrasenaClient from "./cuenta-contrasena-client";

export const metadata: Metadata = {
  title: "Contraseña | SIG-Palma",
  description: "Cambiar contraseña de su cuenta",
};

export default function CuentaContrasenaPage() {
  return <CuentaContrasenaClient />;
}
