"use client";
import { useEffect, useState } from "react";
import { Contrast, Monitor, Moon, Sun, Type } from "lucide-react";
import {
  getContrastPreference,
  getLargeTextPreference,
  getThemePreference,
  resolveTheme,
  setContrastPreference,
  setLargeTextPreference,
  setThemePreference,
  subscribeAccessibilityPreferences,
  type ContrastPreference,
  type ThemePreference,
} from "@/modules/shared/preferences";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

export default function SettingsPage() {
  const [large, setLarge] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [contrast, setContrast] = useState<ContrastPreference>("normal");

  useEffect(() => {
    const syncState = () => {
      const pref = getThemePreference();
      setLarge(getLargeTextPreference());
      setTheme(pref);
      setResolvedTheme(resolveTheme(pref));
      setContrast(getContrastPreference());
    };
    const timer = setTimeout(syncState, 0);
    const unsub = subscribeAccessibilityPreferences(syncState);
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  const toggleLarge = () => {
    const next = !large;
    setLarge(next);
    setLargeTextPreference(next);
  };

  const changeTheme = (next: ThemePreference) => {
    setTheme(next);
    setResolvedTheme(resolveTheme(next));
    setThemePreference(next);
  };

  const changeContrast = (next: ContrastPreference) => {
    setContrast(next);
    setContrastPreference(next);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Configuración"
        subtitle="Personaliza el tema visual, el contraste y el tamaño de lectura."
      />

      <Card>
        <CardHeader className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-primary-dark">Tema de apariencia</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-xs text-muted">
            Elige entre seguir la configuración de tu sistema operativo o fijar modo claro u oscuro.
            {theme === "system" &&
              ` (Activo por sistema: ${resolvedTheme === "dark" ? "Oscuro" : "Claro"})`}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "system" as const, label: "Sistema", Icon: Monitor },
              { id: "light" as const, label: "Claro", Icon: Sun },
              { id: "dark" as const, label: "Oscuro", Icon: Moon },
            ].map(({ id, label, Icon }) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={theme === id ? "primary" : "secondary"}
                aria-pressed={theme === id}
                onClick={() => changeTheme(id)}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <Contrast className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-primary-dark">Contraste visual</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Modo de alto contraste</p>
            <p className="text-xs text-muted">
              {contrast === "high"
                ? "Alto contraste activo (bordes y textos reforzados)"
                : "Contraste estándar activo"}
            </p>
          </div>
          <Button
            type="button"
            variant={contrast === "high" ? "primary" : "secondary"}
            aria-pressed={contrast === "high"}
            onClick={() => changeContrast(contrast === "high" ? "normal" : "high")}
          >
            {contrast === "high" ? "Contraste estándar" : "Activar alto contraste"}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <Type className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-primary-dark">Tamaño de lectura</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Tamaño de letra</p>
            <p className="text-xs text-muted">
              {large ? "Texto ampliado activo (18px)" : "Tamaño estándar activo (16px)"}
            </p>
          </div>
          <Button type="button" onClick={toggleLarge} aria-pressed={large}>
            {large ? "Texto normal" : "Agrandar letras"}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
