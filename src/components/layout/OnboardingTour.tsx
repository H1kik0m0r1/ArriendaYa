"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const Joyride = dynamic(() => import("react-joyride").then((m) => m.Joyride), { ssr: false });

export default function OnboardingTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("arriendaya_tour_done")) {
      setRun(true);
    }
  }, []);

  const steps = [
    { target: "body", content: "¡Bienvenido a ArriendaYa! Te mostramos un recorrido rápido.", placement: "center" as const },
    { target: "header", content: "Aquí puedes navegar, iniciar sesión y ver tu perfil.", placement: "bottom" as const },
    { target: "main", content: "Busca propiedades con los filtros de precio, ubicación y tipo.", placement: "top" as const },
  ];

  return (
    <Joyride
      steps={steps}
      run={run}
      onEvent={(data: any) => {
        if (data.status === "finished" || data.status === "skipped") {
          localStorage.setItem("arriendaya_tour_done", "1");
          setRun(false);
        }
      }}
      styles={{ options: { primaryColor: "#4caf50" } } as any}
    />
  );
}
