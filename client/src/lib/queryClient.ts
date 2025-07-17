import { QueryClient, DefaultOptions } from "@tanstack/react-query";

/* -------------------------------------------------------------------------- */
/* 1.  Configuración global de TanStack Query                                  */
/* -------------------------------------------------------------------------- */
const defaultQueryOptions: DefaultOptions = {
  queries: {
    retry: 3,
    retryDelay: 1_000,
    staleTime: 5 * 60_000,
    queryFn: ({ queryKey }) => apiGet(queryKey[0] as string), // ✅ AGREGADO
  },
};


export const queryClient = new QueryClient({
  defaultOptions: defaultQueryOptions,
});

/* -------------------------------------------------------------------------- */
/* 2.  Helper HTTP genérico — devuelve JSON tipado                             */
/* -------------------------------------------------------------------------- */
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Realiza la petición y, si la respuesta es JSON, la parsea
 * automáticamente devolviendo `Promise<T>`.
 *
 * Si no hay cuerpo (204) o no es JSON ⇒ devuelve `undefined as T`.
 *
 * Lanza `Error` con el mensaje recibido del backend cuando la
 * respuesta no es OK.
 */
export async function apiRequest<T = unknown>(
  method: HttpMethod,
  url: string,
  data?: unknown,
  options: RequestInit = {},
): Promise<T> {
  /* ------------------------------ Headers --------------------------------- */
  const token = localStorage.getItem("auth_token");
  console.log('🔑 Token being sent:', token ? 'YES' : 'NO')

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(method !== "GET" && { "Content-Type": "application/json" }),
    ...(process.env.NODE_ENV === "development" && { Origin: window.location.origin }),
    ...options.headers,
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;
  console.log('✅ Authorization header added');

  /* ------------------------------ Fetch ----------------------------------- */
  const fetchOptions: RequestInit = {
    ...options,
    method,
    headers,
    credentials: "include",
  };

  if (data && method !== "GET") {
    fetchOptions.body = JSON.stringify(data);
  }

  const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  console.log(`🔗 ${method} ${fullUrl}`);

  const response = await fetch(fullUrl, fetchOptions);

  if (!response.ok) {
    /* Intentamos sacar un mensaje de error amistoso */
    let message = `${response.status} ${response.statusText}`;
    try {
      const errJson = await response.clone().json();
      message = errJson?.message ?? JSON.stringify(errJson);
    } catch {
      /* body no-json → usamos statusText */
    }
    throw new Error(message);
  }

  /* -------------------------- Parse automático ---------------------------- */
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {

    return undefined as T;
  }

  return (await response.json()) as T;
}

/* -------------------------------------------------------------------------- */
/* 3.  Helpers por verbo (si prefieres sintaxis corta)                         */
/* -------------------------------------------------------------------------- */
export const apiGet   = <T = unknown>(url: string, options?: RequestInit) =>
  apiRequest<T>("GET", url, undefined, options);

export const apiPost  = <T = unknown>(url: string, data?: unknown, options?: RequestInit) =>
  apiRequest<T>("POST", url, data, options);

export const apiPut   = <T = unknown>(url: string, data?: unknown, options?: RequestInit) =>
  apiRequest<T>("PUT", url, data, options);

export const apiPatch = <T = unknown>(url: string, data?: unknown, options?: RequestInit) =>
  apiRequest<T>("PATCH", url, data, options);

export const apiDelete = <T = unknown>(url: string, options?: RequestInit) =>
  apiRequest<T>("DELETE", url, undefined, options);
