"use client";
import { useState } from "react";
import Input from "@/components/ui/Input";

export default function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [display, setDisplay] = useState(value ? Number(value).toLocaleString("es-CO") : "");
  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    onChange(digits);
    setDisplay(digits ? Number(digits).toLocaleString("es-CO") : "");
  };
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
      <Input label={label} value={display} onChange={(e) => handleChange(e.target.value)} className="pl-7" />
    </div>
  );
}
