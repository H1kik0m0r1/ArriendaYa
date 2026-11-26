"use client";
import { cn } from "@/lib/utils";

export default function MoneyInput({
  label,
  value,
  onChange,
  error,
  placeholder = "0",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const digits = value.replace(/\D/g, "");
  const display = digits ? Number(digits).toLocaleString("es-CO") : "";
  const inputId = label.toLowerCase().replace(/\s+/g, "-");

  const handleChange = (raw: string) => {
    onChange(raw.replace(/\D/g, ""));
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted"
        >
          $
        </span>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={display}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(
            "w-full rounded-lg border border-border bg-input-bg py-2 pl-7 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
            error && "border-red-500"
          )}
        />
      </div>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
