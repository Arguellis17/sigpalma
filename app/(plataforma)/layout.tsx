import { AppShell } from "@/components/app/app-shell";
import { getSessionProfile, isAdmin, isSuperAdmin } from "@/lib/auth/session-profile";
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

  return (
    <AppShell
      session={{
        email: session.user.email ?? null,
        fullName: session.profile?.full_name ?? null,
        role: session.profile?.role ?? null,
        isActive: Boolean(session.profile?.is_active),
        isAdmin: isAdmin(session.profile ?? null),
        isSuperAdmin: isSuperAdmin(session.profile ?? null),
      }}
    >
      {children}
    </AppShell>
  );
}
