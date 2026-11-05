import type { ComponentProps, ComponentType } from "react";
import {
  Bug,
  Calendar,
  CalendarClock,
  Repeat,
  Wallet,
  CheckCircle2,
  ClipboardList,
  Droplets,
  FlaskConical,
  Layers,
  Leaf,
  LayoutDashboard,
  MapPinned,
  Package,
  ShieldCheck,
  Sprout,
  Thermometer,
  Tractor,
  Users,
  Wheat,
  Truck,
  BarChart3,
  ScrollText,
  ClipboardCheck,
  Waypoints,
  Wrench,
} from "lucide-react";
import type { RolUsuario } from "@/lib/auth/rutas-rol";

/** Menú de cada rol. Las pruebas de vistas y permisos recorren estas rutas (e2e/README.md). */
export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<ComponentProps<"svg">>;
  badgeCount?: number;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export function buildNavGroups(role: RolUsuario | null, monitoreosPendientesCount = 0): NavGroup[] {
  switch (role) {
    case "superadmin":
      return [
        {
          label: "Sistema",
          items: [
            { href: "/superadmin", label: "Dashboard", icon: LayoutDashboard },
            { href: "/superadmin/administradores", label: "Administradores", icon: ShieldCheck },
            { href: "/superadmin/usuarios", label: "Usuarios", icon: Users },
            { href: "/superadmin/fincas", label: "Fincas", icon: MapPinned },
            { href: "/superadmin/auditoria", label: "Auditoría por finca", icon: ScrollText },
            {
              href: "/superadmin/reportes/productividad",
              label: "Productividad RFF",
              icon: BarChart3,
            },
            {
              href: "/superadmin/reportes/rspo",
              label: "Expediente RSPO",
              icon: ShieldCheck,
            },
          ],
        },
      ];

    case "admin":
      return [
        {
          label: "General",
          items: [
            { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
            { href: "/admin/usuarios", label: "Usuarios", icon: Users },
            { href: "/admin/fincas", label: "Fincas", icon: MapPinned },
            { href: "/admin/auditoria", label: "Actividad de campo", icon: ScrollText },
            { href: "/admin/jornales", label: "Liquidación de jornales", icon: Wallet },
            {
              href: "/admin/reportes/productividad",
              label: "Productividad RFF",
              icon: BarChart3,
            },
            {
              href: "/admin/reportes/rspo",
              label: "Expediente RSPO",
              icon: ShieldCheck,
            },
          ],
        },
        {
          label: "Catálogos",
          items: [
            { href: "/admin/catalogos/insumos", label: "Insumos", icon: Package },
            { href: "/admin/catalogos/material-genetico", label: "Material genético", icon: Sprout },
            { href: "/admin/catalogos/fitosanitario", label: "Fitosanitario", icon: FlaskConical },
            { href: "/admin/catalogos/labores", label: "Labores agronómicas", icon: Tractor },
            {
              href: "/admin/inventario-herramientas",
              label: "Inventario herramientas",
              icon: Wrench,
            },
          ],
        },
      ];

    case "agronomo":
      return [
        {
          label: "Técnico",
          items: [
            { href: "/tecnico", label: "Dashboard", icon: LayoutDashboard },
            { href: "/tecnico/agenda", label: "Agenda de labores", icon: Calendar },
            { href: "/tecnico/cronogramas", label: "Cronogramas de labores", icon: Repeat },
            {
              href: "/tecnico/trazabilidad",
              label: "Trazabilidad por lote",
              icon: Waypoints,
            },
            {
              href: "/tecnico/reportes/productividad",
              label: "Productividad RFF",
              icon: BarChart3,
            },
            {
              href: "/tecnico/planificacion-siembra",
              label: "Planificación de siembra",
              icon: Leaf,
            },
            {
              href: "/tecnico/preparacion-terreno",
              label: "Preparación de terreno",
              icon: Layers,
            },
            {
              href: "/tecnico/vivero/evaluacion",
              label: "Evaluación de vivero",
              icon: ClipboardCheck,
            },
            {
              href: "/tecnico/nutricion-riego",
              label: "Nutrición y riego",
              icon: Droplets,
            },
            { href: "/tecnico/suelo", label: "Análisis de suelo", icon: Layers },
            {
              href: "/tecnico/sanidad/programacion-monitoreos",
              label: "Programación monitoreos",
              icon: CalendarClock,
            },
            {
              href: "/tecnico/sanidad/validacion",
              label: "Validación sanidad",
              icon: CheckCircle2,
            },
            {
              href: "/tecnico/sanidad/ordenes",
              label: "Órdenes de control",
              icon: ClipboardList,
            },
          ],
        },
      ];

    case "operario":
      return [
        {
          label: "Operaciones",
          items: [
            { href: "/operario", label: "Dashboard", icon: LayoutDashboard },
            { href: "/operario/labores", label: "Labores", icon: Tractor },
            { href: "/operario/nutricion", label: "Fertilización", icon: Droplets },
            {
              href: "/operario/preparacion-terreno",
              label: "Preparación terreno",
              icon: Layers,
            },
            { href: "/operario/siembra", label: "Siembra", icon: Sprout },
            { href: "/operario/cosecha", label: "Cosecha", icon: Wheat },
            { href: "/operario/despacho", label: "Despacho", icon: Truck },
            {
              href: "/operario/inventario-herramientas",
              label: "Inventario herramientas",
              icon: Wrench,
            },
          ],
        },
        {
          label: "Consultas",
          items: [
            { href: "/operario/mi-finca", label: "Mi finca y lotes", icon: MapPinned },
            { href: "/operario/suelo", label: "Análisis de suelo", icon: Layers },
            { href: "/operario/catalogos/insumos", label: "Insumos", icon: Package },
            {
              href: "/operario/catalogos/material-genetico",
              label: "Material genético",
              icon: Sprout,
            },
            {
              href: "/operario/vivero/germinacion",
              label: "Germinación (vivero)",
              icon: Thermometer,
            },
            {
              href: "/operario/catalogos/fitosanitario",
              label: "Fitosanitario",
              icon: FlaskConical,
            },
          ],
        },
        {
          label: "Sanidad",
          items: [
            { href: "/operario/sanidad/alertas", label: "Alertas", icon: Bug },
            {
              href: "/operario/sanidad/monitoreos-pendientes",
              label: "Monitoreos pendientes",
              icon: Calendar,
              badgeCount: monitoreosPendientesCount,
            },
            {
              href: "/operario/sanidad/aplicaciones",
              label: "Aplicaciones",
              icon: ClipboardList,
            },
            {
              href: "/operario/sanidad/censos",
              label: "Censos sanitarios",
              icon: ClipboardCheck,
            },
          ],
        },
      ];

    default:
      return [];
  }
}
