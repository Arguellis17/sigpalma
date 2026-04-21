"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn("size-9 shrink-0 rounded-xl border border-transparent", className)}
        aria-hidden
      />
    );
  }

  const active = theme ?? "system";
  const icon =
    active === "dark" || (active === "system" && resolvedTheme === "dark") ? (
      <Moon className="size-[1.15rem]" />
    ) : (
      <Sun className="size-[1.15rem]" />
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "size-9 shrink-0 rounded-xl border-border/70 bg-background/80 shadow-none",
            className
          )}
          aria-label="Tema de la interfaz"
        >
          {icon}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-2">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Tema</p>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant={active === "light" ? "secondary" : "ghost"}
            size="sm"
            className="justify-start gap-2"
            onClick={() => setTheme("light")}
          >
            <Sun className="size-4" />
            Claro
          </Button>
          <Button
            type="button"
            variant={active === "dark" ? "secondary" : "ghost"}
            size="sm"
            className="justify-start gap-2"
            onClick={() => setTheme("dark")}
          >
            <Moon className="size-4" />
            Oscuro
          </Button>
          <Button
            type="button"
            variant={active === "system" ? "secondary" : "ghost"}
            size="sm"
            className="justify-start gap-2"
            onClick={() => setTheme("system")}
          >
            <Monitor className="size-4" />
            Sistema
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
