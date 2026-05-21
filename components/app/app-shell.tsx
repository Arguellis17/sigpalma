"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  Bug,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
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
  ScrollText,
  ClipboardCheck,
  Waypoints,
  Wrench,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type UserRole = "superadmin" | "admin" | "agronomo" | "operario";

type AppShellProps = {
  children: React.ReactNode;
  session: {
    email: string | null;
    fullName: string | null;
    role: UserRole | null;
    /** Finca asignada (admin, agrónomo, operario); null para superadmin sin finca */
    fincaName: string | null;
    isActive: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  };
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

type BreadcrumbEntry = {
  href?: string;
  label: string;
};

type PageMeta = {
  title: string;
  description: string;
};

const roleLabels: Record<UserRole, string> = {
  superadmin: "Super Administrador",
  admin: "Administrador",
  agronomo: "Agrónomo",
  operario: "Operario",
};

function buildNavGroups(role: UserRole | null): NavGroup[] {
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
            {
              href: "/tecnico/trazabilidad",
              label: "Trazabilidad por lote",
              icon: Waypoints,
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

function isRouteActive(pathname: string, href: string) {
  const exactDashboards = ["/superadmin", "/admin", "/tecnico", "/operario"];
  if (exactDashboards.includes(href)) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const breadcrumbLabels: Record<string, string> = {
  superadmin: "Dashboard",
  admin: "Dashboard",
  tecnico: "Dashboard",
  operario: "Dashboard",
  administradores: "Administradores",
  usuarios: "Usuarios",
  fincas: "Fincas",
  lotes: "Lotes",
  catalogos: "Catálogos",
  insumos: "Insumos",
  "material-genetico": "Material genético",
  fitosanitario: "Fitosanitario",
  agenda: "Agenda",
  trazabilidad: "Trazabilidad",
  "planificacion-siembra": "Planificación de siembra",
  suelo: "Análisis de suelo",
  "mi-finca": "Mi finca",
  sanidad: "Sanidad",
  validacion: "Validación",
  ordenes: "Órdenes",
  aplicaciones: "Aplicaciones",
  alertas: "Alertas",
  censos: "Censos sanitarios",
  "monitoreos-pendientes": "Monitoreos pendientes",
  "programacion-monitoreos": "Programación monitoreos",
  labores: "Labores",
  cosecha: "Cosecha",
  "inventario-herramientas": "Inventario herramientas",
  vivero: "Vivero",
  germinacion: "Germinación",
  evaluacion: "Evaluación",
  editar: "Editar",
  nuevo_usuario: "Nuevo usuario",
};

// UUID pattern
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function humanizeSegment(segment: string, prevSegment?: string): string {
  if (UUID_RE.test(segment)) {
    if (prevSegment === "fincas") return "Finca";
    if (prevSegment === "lotes") return "Lote";
    if (prevSegment === "usuarios") return "Usuario";
    if (prevSegment === "administradores") return "Administrador";
    return "Detalle";
  }
  return (
    breadcrumbLabels[segment] ??
    (segment.charAt(0).toUpperCase() + segment.slice(1))
  );
}

function buildBreadcrumbs(pathname: string): BreadcrumbEntry[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Dashboard" }];

  const rootSegment = segments[0];
  const rootHref = `/${rootSegment}`;

  if (segments.length === 1) {
    return [{ label: "Dashboard" }];
  }

  const crumbs: BreadcrumbEntry[] = [
    { href: rootHref, label: "Dashboard" },
  ];

  segments.slice(1).forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 2).join("/")}`;
    const isLast = index === segments.length - 2;
    const prevSegment = segments[index]; // segments[index] is one before current in slice(1)
    const label = humanizeSegment(segment, prevSegment);
    crumbs.push(isLast ? { label } : { href, label });
  });

  return crumbs;
}

function getPageMeta(pathname: string): PageMeta {
  if (/^\/(superadmin|admin|tecnico|operario)$/.test(pathname)) {
    return {
      title: "Dashboard",
      description: "Vista general de actividad y métricas del sistema.",
    };
  }
  if (pathname === "/superadmin/administradores") {
    return {
      title: "Administradores",
      description: "Gestión de cuentas con rol de Administrador.",
    };
  }
  if (pathname === "/superadmin/usuarios") {
    return {
      title: "Usuarios",
      description: "Gestión global de todas las cuentas del sistema.",
    };
  }
  if (pathname === "/superadmin/fincas") {
    return {
      title: "Fincas",
      description: "Gestión global de fincas registradas en el sistema.",
    };
  }
  if (pathname === "/admin/usuarios") {
    return {
      title: "Usuarios",
      description: "Creación, edición e inactivación de cuentas.",
    };
  }
  if (pathname === "/admin/fincas") {
    return {
      title: "Fincas",
      description: "Inventario de fincas y acceso a sus lotes.",
    };
  }
  if (pathname.endsWith("/editar")) {
    return { title: "Editar", description: "Edición de registro." };
  }
  if (pathname.includes("/lotes/") && !pathname.endsWith("/lotes")) {
    return { title: "Lote", description: "Detalle del lote de cultivo." };
  }
  if (pathname.startsWith("/admin/fincas/") && !pathname.endsWith("/fincas")) {
    return { title: "Finca", description: "Gestión de lotes e historial de la finca." };
  }
  if (pathname === "/admin/catalogos/insumos") {
    return {
      title: "Insumos",
      description: "Catálogo de insumos: nutrición, fitosanitarios y herramientas.",
    };
  }
  if (pathname === "/admin/catalogos/material-genetico") {
    return {
      title: "Material genético",
      description: "Variedades certificadas (DxP) con proveedor para planificación y trazabilidad.",
    };
  }
  if (pathname === "/admin/catalogos/fitosanitario") {
    return {
      title: "Fitosanitario",
      description: "Plagas y enfermedades estandarizadas para reportes MIP y alertas en campo.",
    };
  }
  if (pathname === "/admin/catalogos/labores") {
    return {
      title: "Labores agronómicas",
      description: "Tipos de labor de mantenimiento (poda, malezas, etc.) para la programación en agenda.",
    };
  }
  if (pathname === "/tecnico/agenda") {
    return {
      title: "Agenda de labores",
      description: "Programación de labores de mantenimiento por lote y fecha.",
    };
  }
  if (pathname === "/tecnico/trazabilidad") {
    return {
      title: "Trazabilidad por lote",
      description:
        "Línea de tiempo técnica: genética/plan de siembra, vivero, labores, nutrición, sanidad, suelo y cosecha (solo lectura).",
    };
  }
  if (pathname === "/tecnico/planificacion-siembra") {
    return {
      title: "Planificación de siembra",
      description:
        "Material genético certificado y fecha proyectada por lote. Distinto del mantenimiento (agenda).",
    };
  }
  if (pathname === "/tecnico/vivero/evaluacion") {
    return {
      title: "Evaluación de vivero",
      description:
        "Acta técnica sobre germinación previa; concepto Apto / No apto y evidencia fotográfica opcional. Habilita plan de siembra cuando el concepto es Apto.",
    };
  }
  if (pathname === "/tecnico/nutricion-riego") {
    return {
      title: "Nutrición y riego",
      description:
        "Planes de fertilización (nutrición) y riego por lote. Bloqueo tras aplicación en campo (pendiente).",
    };
  }
  if (pathname === "/tecnico/suelo") {
    return {
      title: "Análisis de suelo",
      description: "pH, humedad, compactación, nutrientes y PDF de laboratorio por lote (RF16).",
    };
  }
  if (pathname === "/operario/labores") {
    return {
      title: "Labores",
      description: "Registro de labores agronómicas diarias.",
    };
  }
  if (pathname === "/operario/nutricion") {
    return {
      title: "Fertilización",
      description:
        "Registro de aplicaciones de fertilizantes según el plan nutricional programado por el técnico.",
    };
  }
  if (pathname === "/operario/preparacion-terreno") {
    return {
      title: "Preparación de terreno",
      description:
        "Adecuación física del lote planificado: actividades, pendiente final y habilitación para siembra.",
    };
  }
  if (pathname === "/operario/siembra") {
    return {
      title: "Registro de siembra",
      description:
        "Formalice la siembra de plántulas en lotes con preparación aprobada; confirme parámetros técnicos y cantidad sembrada.",
    };
  }
  if (pathname === "/operario/cosecha") {
    return {
      title: "Cosecha",
      description: "Registro de racimos RFF por lote.",
    };
  }
  if (pathname === "/operario/mi-finca") {
    return {
      title: "Mi finca y lotes",
      description: "Consulta de la finca asignada y sus lotes.",
    };
  }
  if (pathname === "/operario/suelo") {
    return {
      title: "Análisis de suelo",
      description: "Historial de análisis de suelo de su finca (solo lectura).",
    };
  }
  if (pathname === "/operario/catalogos/insumos") {
    return {
      title: "Insumos",
      description: "Catálogo de insumos activos (solo lectura).",
    };
  }
  if (pathname === "/operario/catalogos/material-genetico") {
    return {
      title: "Material genético",
      description: "Catálogo de material genético (solo lectura).",
    };
  }
  if (pathname === "/operario/vivero/germinacion") {
    return {
      title: "Germinación en vivero",
      description:
        "Tratamiento térmico y datos de germinación por material genético; requisito previo para la evaluación de vivero.",
    };
  }
  if (pathname === "/operario/catalogos/fitosanitario") {
    return {
      title: "Fitosanitario",
      description: "Plagas y enfermedades del catálogo (solo lectura).",
    };
  }
  if (pathname === "/operario/sanidad/monitoreos-pendientes") {
    return {
      title: "Monitoreos pendientes",
      description: "Inspecciones fitosanitarias asignadas por el agrónomo.",
    };
  }
  if (pathname === "/operario/sanidad/alertas") {
    return {
      title: "Alertas fitosanitarias",
      description: "Registro de hallazgos y seguimiento de validación.",
    };
  }
  if (pathname === "/operario/sanidad/aplicaciones") {
    return {
      title: "Aplicación fitosanitaria",
      description: "Ejecución de órdenes de control con confirmación de EPP.",
    };
  }
  if (pathname === "/tecnico/sanidad/programacion-monitoreos") {
    return {
      title: "Programación de monitoreos",
      description:
        "Inspecciones fitosanitarias por lote, fecha y operario; evita duplicados pendientes para el mismo lote y fecha.",
    };
  }
  if (pathname === "/tecnico/sanidad/validacion") {
    return {
      title: "Validación sanidad",
      description: "Bandeja de diagnóstico y emisión de órdenes de control fitosanitario.",
    };
  }
  if (pathname === "/tecnico/sanidad/ordenes") {
    return {
      title: "Órdenes de control",
      description: "Órdenes fitosanitarias de la finca.",
    };
  }
  return { title: "SIG-Palma", description: "Panel operativo del sistema." };
}

export function AppShell({ children, session }: AppShellProps) {
  const pathname = usePathname();

  const navGroups = useMemo(() => buildNavGroups(session.role), [session.role]);
  const pageMeta = useMemo(() => getPageMeta(pathname), [pathname]);
  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname]);

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <Link
            href={session.role ? `/${session.role === "agronomo" ? "tecnico" : session.role}` : "/"}
            title={
              [
                "SIG-Palma",
                session.fincaName ?? undefined,
                session.role ? roleLabels[session.role] : undefined,
              ]
                .filter(Boolean)
                .join(" · ") || "SIG-Palma"
            }
            className="flex items-center gap-3 rounded-md border border-sidebar-border bg-sidebar px-3 py-3 transition-[padding,gap] group-data-[collapsible=icon]/sidebar:min-h-10 group-data-[collapsible=icon]/sidebar:w-full group-data-[collapsible=icon]/sidebar:justify-center group-data-[collapsible=icon]/sidebar:gap-0 group-data-[collapsible=icon]/sidebar:border-0 group-data-[collapsible=icon]/sidebar:bg-transparent group-data-[collapsible=icon]/sidebar:px-0 group-data-[collapsible=icon]/sidebar:py-0"
          >
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-none bg-primary/10">
              <Image
                src="/logo.png"
                alt="SIG-Palma"
                width={72}
                height={72}
                className="size-[1.85rem] object-contain sm:size-8"
                priority
              />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]/sidebar:hidden">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                SIG-Palma
              </p>
              <p className="truncate text-xs text-sidebar-foreground/70">
                Gestión técnica y trazabilidad
              </p>
              {session.fincaName ? (
                <p className="mt-1 truncate text-xs font-semibold text-sidebar-foreground">
                  {session.fincaName}
                </p>
              ) : null}
              {session.role ? (
                <p
                  className={cn(
                    "truncate text-xs font-bold text-sidebar-foreground",
                    session.fincaName ? "mt-0.5" : "mt-1"
                  )}
                >
                  {roleLabels[session.role]}
                </p>
              ) : null}
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          {navGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isRouteActive(pathname, item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          size="lg"
                        >
                          <Link href={item.href}>
                            <Icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="pt-0">
          <div className="rounded-md border border-sidebar-border bg-sidebar-accent/50 p-3 group-data-[collapsible=icon]/sidebar:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-wide text-sidebar-foreground/60 uppercase">
                  Sesión
                </p>
                <p className="mt-1 truncate font-medium text-sidebar-foreground">
                  {session.fullName ?? session.email ?? "Usuario"}
                </p>
                {session.email ? (
                  <p className="truncate text-xs text-sidebar-foreground/70">
                    {session.email}
                  </p>
                ) : null}
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <ShieldCheck />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={session.isActive ? "outline" : "destructive"}>
                {session.isActive ? "Activa" : "Inactiva"}
              </Badge>
            </div>
            <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
              <Link href="/cuenta/contrasena">Cambiar contraseña</Link>
            </Button>
          </div>

          <SignOutButton
            variant="destructive"
            className={cn(
              "mt-2 w-full justify-start overflow-hidden border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground",
              "group-data-[collapsible=icon]/sidebar:mt-2 group-data-[collapsible=icon]/sidebar:size-10 group-data-[collapsible=icon]/sidebar:min-w-0 group-data-[collapsible=icon]/sidebar:justify-center group-data-[collapsible=icon]/sidebar:px-0"
            )}
            labelClassName="group-data-[collapsible=icon]/sidebar:hidden"
          />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset
        className={cn(
          "min-h-svh bg-transparent",
          // Tighter than default shadcn inset: no outer “card” margin, flush with sidebar column
          "md:peer-data-[variant=inset]:!m-0 md:peer-data-[variant=inset]:!rounded-none md:peer-data-[variant=inset]:!shadow-none",
          "md:peer-data-[variant=inset]:peer-data-[state=collapsed]:!m-0"
        )}
      >
        <div className="app-shell-bg min-h-svh">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="flex h-16 w-full items-center gap-3 px-3 sm:px-4 lg:px-5">
              <SidebarTrigger className="shrink-0" />

              <div className="min-w-0 flex-1 pr-1">
                <Breadcrumb className="hidden md:block">
                  <BreadcrumbList>
                    {breadcrumbs.map((crumb, index) => {
                      const isLast = index === breadcrumbs.length - 1;
                      return (
                        <div key={`${crumb.label}-${index}`} className="contents">
                          <BreadcrumbItem>
                            {isLast ? (
                              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink asChild>
                                <Link href={crumb.href ?? "/"}>{crumb.label}</Link>
                              </BreadcrumbLink>
                            )}
                          </BreadcrumbItem>
                          {!isLast ? (
                            <BreadcrumbSeparator>
                              <ChevronRight />
                            </BreadcrumbSeparator>
                          ) : null}
                        </div>
                      );
                    })}
                  </BreadcrumbList>
                </Breadcrumb>

                <p className="truncate text-base font-bold text-foreground sm:text-lg md:hidden">
                  {pageMeta.title}
                </p>
                <p className="hidden truncate text-sm text-muted-foreground lg:block">
                  {pageMeta.description}
                </p>
              </div>

              <ThemeToggle className="shrink-0" />
            </div>
          </header>

          <div className="px-3 py-4 sm:px-4 sm:py-5 lg:px-5">
            <div className="flex w-full min-w-0 flex-col gap-4">{children}</div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

