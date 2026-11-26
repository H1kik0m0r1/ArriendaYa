"use client";
import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, X } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  showPasswordToggle?: boolean;
  clearable?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, success, id, type, showPasswordToggle, clearable, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const [show, setShow] = useState(false);
    const isPassword = type === "password";
    const actualType = isPassword && showPasswordToggle ? (show ? "text" : "password") : type;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
            {props.required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={actualType}
            className={cn(
              "w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
              error && "border-red-500",
              !error && success && "border-green-500",
              (showPasswordToggle || clearable) && "pr-10",
              className
            )}
            {...props}
          />
          {showPasswordToggle && isPassword && (
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
          {clearable && props.value && !showPasswordToggle && (
            <button
              type="button"
              onClick={() => props.onChange?.({ target: { value: "" } } as React.ChangeEvent<HTMLInputElement>)}
              aria-label="Limpiar campo"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
export default Input;
