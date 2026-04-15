"use client";

import type { VariantProps } from "class-variance-authority";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/auth/login");
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className ?? "min-h-12 min-w-[140px]"}
      onClick={signOut}
    >
      <LogOut data-icon="inline-start" />
      <span className={labelClassName}>{label}</span>
    </Button>
  );
}
