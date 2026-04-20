"use client";

import { useState } from "react";
import type { VariantProps } from "class-variance-authority";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoutTransitionOverlay } from "@/components/auth/logout-transition-overlay";
import { Button, buttonVariants } from "@/components/ui/button";

type SignOutButtonProps = {
  className?: string;
  label?: string;
  labelClassName?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
};

export function SignOutButton({
  className,
  label = "Cerrar sesión",
  labelClassName,
  variant = "outline",
  size = "lg",
}: SignOutButtonProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function signOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.refresh();
      router.push("/auth/login");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <LogoutTransitionOverlay open={loggingOut} />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className ?? "min-h-12 min-w-[140px]"}
        onClick={signOut}
        disabled={loggingOut}
      >
        <LogOut data-icon="inline-start" />
        <span className={labelClassName}>{label}</span>
      </Button>
    </>
  );
}
