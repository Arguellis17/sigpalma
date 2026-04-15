import type { Metadata } from "next";
import { IBM_Plex_Mono, Lora, Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "@/components/app/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionProfile, isAdmin } from "@/lib/auth/session-profile";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "SIG-Palma",
  description:
    "Gestión técnica y trazabilidad del cultivo de palma de aceite (UFPS).",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionProfile();

  return (
    <html
      lang="es"
      className={`${plusJakartaSans.variable} ${ibmPlexMono.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col text-foreground selection:bg-primary/20 selection:text-foreground">
        <TooltipProvider>
          <AppShell
            session={{
              email: session?.user.email ?? null,
              fullName: session?.profile?.full_name ?? null,
              role: session?.profile?.role ?? null,
              isActive: Boolean(session?.profile?.is_active),
              isAdmin: isAdmin(session?.profile ?? null),
            }}
          >
            {children}
          </AppShell>
        </TooltipProvider>
      </body>
    </html>
  );
}
