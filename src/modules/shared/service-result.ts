export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function okResult<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function errResult<T = never>(error: string): ServiceResult<T> {
  return { ok: false, error };
}

export async function apiJsonFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ServiceResult<T>> {
  try {
    const res = await fetch(input, init);
    const json = (await res.json().catch(() => ({}))) as { error?: string } & T;
    if (!res.ok) {
      return errResult(json.error || `Error en la solicitud (${res.status})`);
    }
    return okResult(json);
  } catch (err) {
    return errResult(err instanceof Error ? err.message : "Error de conexión con el servidor");
  }
}
