"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";

export default function Wizard({ steps, onFinish }: { steps: { title: string; content: React.ReactNode }[]; onFinish: () => void }) {
  const [current, setCurrent] = useState(0);
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className={`flex-1 rounded-full h-2 ${i <= current ? "bg-primary" : "bg-gray-200"}`} />
        ))}
      </div>
      <p className="mb-2 text-sm text-muted">Paso {current + 1} de {steps.length}: {steps[current].title}</p>
      <div className="mb-4">{steps[current].content}</div>
      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>Anterior</Button>
        {current < steps.length - 1 ? (
          <Button onClick={() => setCurrent((c) => Math.min(steps.length - 1, c + 1))}>Siguiente</Button>
        ) : (
          <Button onClick={onFinish}>Finalizar</Button>
        )}
      </div>
    </div>
  );
}
