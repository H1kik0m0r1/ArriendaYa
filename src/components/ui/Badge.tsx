import * as React from "react";
import { cn } from "@/lib/utils";

const colors: Record<string, string> = {
  green: "bg-primary/10 text-primary-dark",
  gray: "bg-gray-100 text-gray-700",
  red: "bg-red-100 text-red-700",
  yellow: "bg-yellow-100 text-yellow-700",
  blue: "bg-blue-100 text-blue-700",
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
