import * as React from "react";
import { cn } from "@/lib/utils";

const colors: Record<string, string> = {
  green: "bg-primary-light text-primary-dark",
  gray: "bg-surface-secondary text-foreground",
  red: "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-200",
  yellow: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-200",
};

export function Badge({
  className,
  color = "gray",
  children,
}: {
  className?: string;
  color?: keyof typeof colors;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", colors[color], className)}>
      {children}
    </span>
  );
}
