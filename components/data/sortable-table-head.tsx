"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { AuditSortKey } from "@/lib/audit/audit-list-query";
import { cn } from "@/lib/utils";

type Props = {
  columnId: AuditSortKey;
  label: string;
  activeSort: AuditSortKey;
  dir: "asc" | "desc";
  onToggle: (columnId: AuditSortKey) => void;
  className?: string;
};

export function SortableTableHead({
  columnId,
  label,
  activeSort,
  dir,
  onToggle,
  className,
}: Props) {
  const active = activeSort === columnId;
  return (
    <TableHead className={cn("px-4 py-3", className)}>
      <button
        type="button"
        className="inline-flex w-full min-w-0 items-center gap-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => onToggle(columnId)}
        aria-sort={
          active ? (dir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        <span>{label}</span>
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3.5 shrink-0 opacity-90" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5 shrink-0 opacity-90" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-40" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}
