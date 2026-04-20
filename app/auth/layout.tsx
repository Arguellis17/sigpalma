export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(32,104,56,0.14),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(166,120,47,0.12),_transparent_30%),linear-gradient(180deg,#f8faf5_0%,#f4efe4_100%)] p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.55)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.18]" />
      <div className="pointer-events-none absolute -left-20 top-10 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 size-96 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="relative w-full">
        {children}
      </div>
    </div>
  );
}
