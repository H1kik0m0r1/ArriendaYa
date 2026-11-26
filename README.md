# ArriendaYa

Plataforma web de arriendo de inmuebles (propietarios e inquilinos).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 (paleta verde sólida)
- Supabase (Auth, Postgres, Storage, Realtime)

## Setup

### Modo demo local (sin servidor externo)
Para probar sin Supabase en entorno local, define explícitamente `NEXT_PUBLIC_DEMO_MODE=true` en `.env.local`. No se activa automáticamente en producción.

### 1. Instalar dependencias

```bash
npm install
```

### 2. Ejecutar

```bash
npm run dev
```

Abre http://localhost:3000

En modo demo (`NEXT_PUBLIC_DEMO_MODE=true`), los datos se guardan localmente en el navegador (localStorage).

### Modo Supabase (backend real)
Para usar Supabase, configura `.env.local` tomando `.env.example` como plantilla:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_DEMO_MODE=false
```
Ejecuta las migraciones SQL en orden en el SQL Editor de Supabase:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_security.sql`
3. `supabase/migrations/0003_rls_complete.sql`
4. `supabase/migrations/0004_security_hardening.sql`

Las cuentas de propietario se habilitan invitando su correo en la tabla `owner_invitations` (solo administradores) y los roles privilegiados (`admin`) se asignan únicamente desde SQL/servidor.

### 3. Notas

- Los datos se guardan en el navegador (localStorage). Para reiniciar, borra el almacenamiento del sitio.
- La verificación al publicar un inmueble es simulada.
- Los recordatorios de renovación se generan al cargar el panel.

## Mejoras implementadas (v2)

- **React Query:** cache y sincronización de datos (home usa `useProperties`).
- **Zod:** esquemas de validación en `src/lib/validators/schemas.ts`.
- **Toast notifications:** `useToast()` disponible en toda la app.
- **Error Boundary:** captura errores de render y muestra fallback.
- **Accesibilidad:** estilos `:focus-visible` y roles/aria en componentes base.

## Guía para conectar a un backend real

1. Reemplaza `src/lib/supabase/client.ts` por el cliente de Supabase/Firebase o por fetch a tu API.
2. Mantén la firma de `createClient()` (`.from`, `.auth`, `.storage`) para no tocar componentes, o migra a hooks de React Query que llamen a tu API.
3. Mueve la validación de Zod al servidor (Route Handlers) y reutiliza los mismos esquemas.
4. Implementa autenticación con cookies httpOnly y middleware de protección de rutas.
5. Añade variables de entorno para la URL del API y despliega.

## Guía para mejorar más

- **Tests:** instala Vitest + Playwright y añade tests en `src/__tests__/`.
- **CI/CD:** crea `.github/workflows/ci.yml` con lint, typecheck, tests y build.
- **Observabilidad:** integra Sentry en `next.config` y un provider de analytics.
- **Performance:** usa `next/image`, lazy loading de rutas pesadas y bundle analyzer.

## Estructura

Ver `src/` para componentes y páginas. Las migraciones SQL están en `supabase/`.

## Notas

- Las notificaciones son in-app (v1).
- La "verificación" al publicar un inmueble es simulada (pantalla de carga + mensaje).
- Los recordatorios de renovación se generan al cargar el dashboard del usuario.
