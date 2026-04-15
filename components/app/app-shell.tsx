"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  Blocks,
  ChevronRight,
  LayoutDashboard,
  Leaf,
  MapPinned,
  ShieldCheck,
  Tractor,
  Users,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
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

type AppShellProps = {
  children: React.ReactNode;
  session: {
    email: string | null;
    fullName: string | null;
    role: "admin" | "agronomo" | "operario" | null;
    isActive: boolean;
    isAdmin: boolean;
  };
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
};

type BreadcrumbEntry = {
  href?: string;
  label: string;
};

type PageMeta = {
  title: string;
  description: string;
  action?: {
    href: string;
    label: string;
  };
};

const roleLabels = {
  admin: "Administrador",
  agronomo: "Agrónomo",
  operario: "Operario",
} as const;

function isRouteActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function humanizeSegment(segment: string) {
  if (segment === "campo") return "Campo";
  if (segment === "labor") return "Labor";
  if (segment === "cosecha") return "Cosecha";
  if (segment === "alerta") return "Alerta";
  if (segment === "fincas") return "Fincas";
  if (segment === "lotes") return "Lotes";
  if (segment === "nueva") return "Nueva finca";
  if (segment === "nuevo") return "Nuevo lote";
  if (segment === "editar") return "Editar";
  if (segment.length > 16) return "Detalle";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

function buildBreadcrumbs(pathname: string): BreadcrumbEntry[] {
  if (pathname === "/") {
    return [{ label: "Dashboard" }];
  }

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: BreadcrumbEntry[] = [{ href: "/", label: "Dashboard" }];

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isLast = index === segments.length - 1;
    const previous = segments[index - 1];

    let label = humanizeSegment(segment);

    if (previous === "fincas" && segment.length > 16) {
      label = "Detalle";
    }

    if (previous === "lotes" && segment.length > 16) {
      label = "Detalle lote";
    }

    crumbs.push(isLast ? { label } : { href, label });
  });

  return crumbs;
}

function getPageMeta(pathname: string, isAdmin: boolean): PageMeta {
  if (pathname === "/") {
    return {
      title: "Dashboard",
      description:
        "Resumen de fincas, lotes, labores y alertas visibles según el perfil actual.",
      action: {
        href: "/campo/labor",
        label: "Registrar labor",
      },
    };
  }

  if (pathname === "/campo") {
    return {
      title: "Campo",
      description:
        "Accesos rápidos para registrar labores, cosechas y alertas desde la operación diaria.",
      action: {
        href: "/campo/labor",
        label: "Nueva labor",
      },
    };
  }

  if (pathname === "/campo/labor") {
    return {
      title: "Registrar labor",
      description: "Captura labores agronómicas por lote con validación y sesión protegida.",
    };
  }

  if (pathname === "/campo/cosecha") {
    return {
      title: "Registrar cosecha",
      description: "Registra RFF, peso, racimos y observaciones por lote.",
    };
  }

  if (pathname === "/campo/alerta") {
    return {
      title: "Registrar alerta",
      description: "Reporta incidencias fitosanitarias para seguimiento técnico.",
    };
  }

  if (pathname === "/fincas") {
    return {
      title: "Fincas",
      description:
        "Inventario de fincas visibles por RLS y acceso a lotes, edición e historial.",
      action: isAdmin
        ? {
            href: "/fincas/nueva",
            label: "Nueva finca",
          }
        : undefined,
    };
  }

  if (pathname === "/fincas/nueva") {
    return {
      title: "Nueva finca",
      description: "Crea una unidad productiva y habilita su estructura base.",
    };
  }

  if (pathname.startsWith("/fincas/") && pathname.includes("/lotes/") && pathname.endsWith("/editar")) {
    return {
      title: "Editar lote",
      description: "Actualiza la configuración productiva y técnica del lote.",
    };
  }

  if (pathname.startsWith("/fincas/") && pathname.includes("/lotes/") && pathname.endsWith("/nuevo")) {
    return {
      title: "Nuevo lote",
      description: "Registra un nuevo lote dentro de la finca seleccionada.",
    };
  }

  if (pathname.startsWith("/fincas/") && pathname.includes("/lotes/")) {
    return {
      title: "Detalle de lote",
      description: "Consulta historial operativo, cosechas y alertas del lote.",
    };
  }

  if (pathname.startsWith("/fincas/") && pathname.endsWith("/editar")) {
    return {
      title: "Editar finca",
      description: "Ajusta los datos base de la finca y su contexto administrativo.",
    };
  }

  if (pathname.startsWith("/fincas/")) {
    return {
      title: "Detalle de finca",
      description: "Revisa la ficha de la finca y navega hacia sus lotes e historial.",
    };
  }

  return {
    title: "SIG-Palma",
    description: "Panel operativo del sistema.",
  };
}

export function AppShell({ children, session }: AppShellProps) {
  const pathname = usePathname();

  const isAuthRoute = pathname.startsWith("/auth");

  const navItems = useMemo<NavItem[]>(
    () => [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/campo", label: "Campo", icon: Tractor },
      { href: "/fincas", label: "Fincas", icon: MapPinned },
      ...(session.isAdmin
        ? [{ href: "/auth/register", label: "Usuarios", icon: Users }]
        : []),
    ],
    [session.isAdmin]
  );

  const pageMeta = useMemo(
    () => getPageMeta(pathname, session.isAdmin),
    [pathname, session.isAdmin]
  );
  const breadcrumbs = useMemo(() => buildBreadcrumbs(pathname), [pathname]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="p-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar px-3 py-3"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Leaf />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                SIG-Palma
              </p>
              <p className="truncate text-xs text-sidebar-foreground/70">
                Gestión técnica y trazabilidad
              </p>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navegación</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
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
        </SidebarContent>

        <SidebarFooter className="p-3 pt-0">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3 group-data-[collapsible=icon]:hidden">
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
              <Badge variant="secondary">
                {session.role ? roleLabels[session.role] : "Sin rol"}
              </Badge>
              <Badge variant={session.isActive ? "outline" : "destructive"}>
                {session.isActive ? "Activa" : "Pendiente"}
              </Badge>
            </div>
          </div>

          <SignOutButton
            className="w-full justify-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            labelClassName="group-data-[collapsible=icon]:hidden"
          />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-svh bg-transparent">
        <div className="app-shell-bg min-h-svh">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
              <SidebarTrigger className="shrink-0" />

              <div className="min-w-0 flex-1">
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

                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground sm:text-lg">
                    {pageMeta.title}
                  </p>
                  <p className="hidden truncate text-sm text-muted-foreground lg:block">
                    {pageMeta.description}
                  </p>
                </div>
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                {session.role ? (
                  <Badge variant="outline">{roleLabels[session.role]}</Badge>
                ) : null}
                {session.email ? (
                  <Badge variant="secondary">{session.email}</Badge>
                ) : null}
              </div>

              {pageMeta.action ? (
                <Button asChild className="hidden sm:inline-flex">
                  <Link href={pageMeta.action.href}>{pageMeta.action.label}</Link>
                </Button>
              ) : null}
            </div>
          </header>

          <div className="px-4 py-4 sm:px-6 sm:py-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">{children}</div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
