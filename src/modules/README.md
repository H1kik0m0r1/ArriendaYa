# Arquitectura Modular de ArriendaYa (`src/modules`)

ArriendaYa organiza su lógica de dominio por módulos funcionales bajo `src/modules/`. La interfaz (`src/app/**` y `src/components/**`) delega el acceso a datos, validaciones y casos de uso en estas capas sin duplicar reglas entre vistas ni trasladar controles sensibles al cliente.

## 1. Estructura y responsabilidad por capa

Dentro de cada módulo (`src/modules/<modulo>/`):

- `types.ts`: modelos, estados e interfaces del dominio.
- `schemas.ts`: esquemas Zod compartidos entre formularios cliente (`zodResolver`) y Route Handlers (`src/app/api/**`).
- `repository.ts`: consultas y mutaciones tipadas sobre Supabase / `localdb` (con consultas agrupadas `.in(...)` para evitar patrones N+1).
- `service.ts`: casos de uso, reglas de negocio y manejo uniforme de respuestas mediante `ServiceResult<T>`.
- `components/` (opcional): componentes propios del módulo.

## 2. Módulos implementados y responsabilidades

- `shared/`: utilidades transversales (`ServiceResult<T>`, `apiJsonFetch`, `uploadPrivateFile` hacia `/api/storage/upload`, `signedUrlSchema` y preferencias de interfaz como tamaño de fuente).
- `auth/`: inicio de sesión, registro, recuperación/cambio de contraseña, perfil propio e invitaciones de propietarios (`admin`).
- `properties/`: catálogo público con filtros y paginación, detalle, wizard/edición de propiedades, coordenadas cercanas, favoritos y listas personalizadas (`saved_lists`).
- `rental-requests/`: flujo de solicitudes en dos filtros, revisión documental, notas privadas y biblioteca personal de documentos del inquilino (`personal-docs.ts`).
- `contracts/`: gestión de términos, firma electrónica dual y ciclo de vida (renovación / suspensión).
- `payments/`: registro de cobros y pagos, carga de comprobantes privados, confirmación por el propietario y cálculo de ingresos confirmados.
- `visits/`: agendamiento de visitas en `public.visits`, eventos de calendario (`calendar_events`) y consolidación de agendas para propietario e inquilino.
- `analytics/`: agregación de métricas e indicadores para los paneles de propietario (`/owner/dashboard`, `/owner/stats`) y de inquilino (`/tenant`).
- `messaging/`: creación validada de conversaciones (`/api/conversations`) y envío/lectura de mensajes.
- `notifications/`: listado de notificaciones, marcado de lectura y sincronización de recordatorios de vencimiento.
- `reports/`: consulta y respuesta a reportes.

## 3. Flujo de comunicación (Páginas → Servicios → Repositorios → BD/API)

1. Las **páginas y componentes** gestionan el estado visual y los formularios mediante **React Hook Form** + **`zodResolver`** conectado a `schemas.ts`.
2. Al enviar acciones o cargar vistas complejas, llaman a funciones de **`service.ts`** (o `repository.ts` para lecturas simples).
3. Los **servicios** retornan `ServiceResult<T>` (`{ ok: true, data }` o `{ ok: false, error }`), desacoplando los componentes de detalles HTTP, Supabase o modo demo.
4. La seguridad y las transiciones críticas (`accept_request_and_create_contract`, firma dual, pagos, eliminación de inmuebles, URLs firmadas) continúan verificándose en el **servidor (`src/lib/auth/server-guard.ts` y `src/app/api/**`)** y en **PostgreSQL (RLS + triggers)**.

## 4. Esquemas Zod compartidos y compatibilidad dual (Supabase vs. Demo)

- Los archivos `schemas.ts` de cada módulo son reexportados desde `src/lib/validators/schemas.ts`, evitando divergencias entre la validación de UI y las rutas `/api/**`.
- Los tipos se reexportan desde `src/lib/types.ts` para mantener compatibilidad con toda la aplicación.
- En modo producción (`NEXT_PUBLIC_DEMO_MODE=false`), `service.ts` invoca los endpoints protegidos (`/api/**`) y `repository.ts` consulta Supabase respetando RLS. En modo demo (`NEXT_PUBLIC_DEMO_MODE=true`), los servicios ejecutan el flujo equivalente sobre `localdb.ts`, que replica las principales restricciones de negocio de forma local.

## 5. Cómo crear un módulo nuevo

1. Crea `src/modules/<nuevo-modulo>/` con `types.ts`, `schemas.ts`, `repository.ts` y `service.ts`.
2. Define los tipos en `types.ts` y reexpórtalos en `src/lib/types.ts` si son globales.
3. Define los esquemas Zod en `schemas.ts` y reexpórtalos en `src/lib/validators/schemas.ts` para reutilizarlos en `src/app/api/<nuevo-modulo>/**`.
4. Implementa las consultas puras en `repository.ts` (evitando consultas N+1) y la orquestación dual (`isDemoMode()` vs `/api/**`) en `service.ts` usando `ServiceResult<T>`.
5. Conecta los formularios en `src/app/**` usando `useForm` + `zodResolver` sin incluir llamadas `supabase.from(...)` ni `fetch` directos en las vistas.
