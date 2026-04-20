import { AppShell } from "@/components/app/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { getSessionProfile, isAdmin, isSuperAdmin } from "@/lib/auth/session-profile";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PlataformaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionProfile();

  if (!session) {
    redirect("/auth/login");
  }

  let fincaName: string | null = null;
  const fincaId = session.profile?.finca_id ?? null;
  if (fincaId) {
    const supabase = await createClient();
    const { data: finca } = await supabase
      .from("fincas")
      .select("nombre")
      .eq("id", fincaId)
      .maybeSingle();
    fincaName = finca?.nombre ?? null;
  }

  return (
    <ToastProvider>
      <AppShell
        session={{
          email: session.user.email ?? null,
          fullName: session.profile?.full_name ?? null,
          role: session.profile?.role ?? null,
          fincaName,
          isActive: Boolean(session.profile?.is_active),
          isAdmin: isAdmin(session.profile ?? null),
          isSuperAdmin: isSuperAdmin(session.profile ?? null),
        }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
