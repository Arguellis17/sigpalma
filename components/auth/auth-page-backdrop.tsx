/**
 * Shared full-bleed background for auth routes and logout overlay.
 * Mirrors theme: light wash vs dark charcoal + subtle brand glows.
 */
export function AuthPageBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(168deg,oklch(0.985_0.012_125)_0%,oklch(0.965_0.018_95)_42%,oklch(0.978_0.014_155)_100%)] dark:bg-[linear-gradient(168deg,oklch(0.16_0.018_145)_0%,oklch(0.1_0.012_95)_45%,oklch(0.12_0.014_155)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_72%_at_50%_38%,rgba(255,255,255,0.55)_0%,transparent_55%)] dark:bg-[radial-gradient(ellipse_90%_72%_at_50%_38%,rgba(255,255,255,0.07)_0%,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-28 top-[-4rem] size-[26rem] rounded-full bg-[radial-gradient(circle,rgba(32,104,56,0.09)_0%,transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(32,104,56,0.28)_0%,transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-36 -right-24 size-[30rem] rounded-full bg-[radial-gradient(circle,rgba(180,130,55,0.07)_0%,transparent_72%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(180,130,55,0.18)_0%,transparent_74%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(22,48,34,0.045)_1px,transparent_1px)] bg-[length:22px_22px] opacity-[0.65] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_45%,black,transparent)] dark:bg-[radial-gradient(rgba(255,255,255,0.055)_1px,transparent_1px)] dark:opacity-[0.45]"
      />
    </>
  );
}
