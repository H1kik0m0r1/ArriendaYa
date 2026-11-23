"use client";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";

export default function SettingsPage() {
  const [large, setLarge] = useState(false);

  useEffect(() => {
    setLarge(localStorage.getItem("arriendaya_large_text") === "1");
  }, []);

  const toggle = () => {
    const next = !large;
    setLarge(next);
    localStorage.setItem("arriendaya_large_text", next ? "1" : "0");
    document.documentElement.style.fontSize = next ? "18px" : "16px";
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-primary">Configuración</h1>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 font-medium">Tamaño de letra</p>
        <Button onClick={toggle}>{large ? "Texto normal" : "Agrandar letras"}</Button>
      </div>
    </div>
  );
}
