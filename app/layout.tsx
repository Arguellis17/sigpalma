import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "@serwist/turbopack/react";
import { IBM_Plex_Mono, Lora, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  applicationName: "SIG-Palma",
  appleWebApp: { capable: true, title: "SIG-Palma", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#1f5f3f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${ibmPlexMono.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground selection:bg-primary/20 selection:text-foreground">
        {/* PWA: registra el service worker; sin recarga automática al volver la señal para no
            interrumpir formularios ni la sincronización de la cola offline. */}
        <SerwistProvider swUrl="/serwist/sw.js" reloadOnOnline={false} cacheOnNavigation>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}

