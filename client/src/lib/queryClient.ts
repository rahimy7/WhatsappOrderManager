// client/src/lib/queryClient.ts - Asegurar headers correctos
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: 1000,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Función helper para requests con headers correctos
export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  data?: any,
  options?: RequestInit
): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    // Forzar el Origin header en desarrollo
    ...(process.env.NODE_ENV === 'development' && {
      'Origin': window.location.origin
    })
  };
  
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers: {
      ...defaultHeaders,
      ...options?.headers,
    },
    credentials: 'include', // Importante para CORS
    ...options,
  };

  if (data && method !== 'GET') {
    config.body = JSON.stringify(data);
  }

  // Construir URL completa si es relativa
  const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
  
  console.log(`🔗 API Request: ${method} ${fullUrl}`);
  
  try {
    const response = await fetch(fullUrl, config);
    
    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    console.error('❌ Network Error:', error);
    throw error;
  }
}

// Función específica para requests GET
export async function apiGet(url: string, options?: RequestInit): Promise<Response> {
  return apiRequest('GET', url, undefined, options);
}

// Función específica para requests POST
export async function apiPost(url: string, data?: any, options?: RequestInit): Promise<Response> {
  return apiRequest('POST', url, data, options);
}

// Función específica para requests PUT
export async function apiPut(url: string, data?: any, options?: RequestInit): Promise<Response> {
  return apiRequest('PUT', url, data, options);
}

// Función específica para requests DELETE
export async function apiDelete(url: string, options?: RequestInit): Promise<Response> {
  return apiRequest('DELETE', url, undefined, options);
}