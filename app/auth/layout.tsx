import { AuthPageBackdrop } from "@/components/auth/auth-page-backdrop";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background p-4 text-foreground sm:p-6 lg:p-8">
      <AuthPageBackdrop />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
