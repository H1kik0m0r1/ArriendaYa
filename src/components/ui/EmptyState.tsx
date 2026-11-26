import * as React from "react";
import { Home } from "lucide-react";

export default function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary">
        {icon || <Home className="h-6 w-6" aria-hidden="true" />}
      </div>
      <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
