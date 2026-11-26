"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { EventData, Step } from "react-joyride";

const Joyride = dynamic(() => import("react-joyride").then((m) => m.Joyride), { ssr: false });

export default function OnboardingTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("arriendaya_tour_done")) {
      const timer = setTimeout(() => {
        setRun(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  const steps: Step[] = [
    { target: "body", content: "¡Bienvenido a ArriendaYa! Te mostramos un recorrido rápido.", placement: "center" },
    { target: "header", content: "Aquí puedes navegar, iniciar sesión y ver tu perfil.", placement: "bottom" },
    { target: "main", content: "Busca propiedades con los filtros de precio, ubicación y tipo.", placement: "top" },
  ];

  return (
    <Joyride
      steps={steps}
      run={run}
      onEvent={(data: EventData) => {
        if (data.status === "finished" || data.status === "skipped" || data.action === "close") {
          localStorage.setItem("arriendaya_tour_done", "1");
          setRun(false);
        }
      }}
      options={{
        primaryColor: "#2E7D57",
        overlayColor: "rgba(0, 0, 0, 0.55)",
      }}
      styles={{
        tooltip: {
          backgroundColor: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        },
        arrow: {
          backgroundColor: "var(--card)",
        },
        buttonPrimary: {
          backgroundColor: "var(--primary-btn)",
          color: "#ffffff",
          borderRadius: 8,
        },
        buttonBack: {
          color: "var(--muted)",
        },
        buttonSkip: {
          color: "var(--muted)",
        },
        buttonClose: {
          color: "var(--muted)",
        },
      }}
    />
  );
}
