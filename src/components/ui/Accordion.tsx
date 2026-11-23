"use client";
import { useState } from "react";

export default function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
      {items.map((it, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between px-4 py-3 text-left font-medium"
          >
            {it.q}
            <span className="text-muted">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && <div className="px-4 pb-3 text-sm text-muted">{it.a}</div>}
        </div>
      ))}
    </div>
  );
}
