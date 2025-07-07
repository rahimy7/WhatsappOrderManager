import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser } from '@shared/auth';
import { apiRequest } from '@/lib/queryClient';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string, companyId?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay una sesión activa al cargar la app
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Decode JWT token locally instead of making API call
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Check if token is expired
        const currentTime = Date.now() / 1000;
        if (payload.exp && payload.exp < currentTime) {
          throw new Error('Token expired');
        }

        // Set user data from token
        setUser({
          id: payload.id,
          username: payload.username,
          role: payload.role,
          storeId: payload.storeId,
          level: payload.level
        });
      } catch (tokenError) {
        console.log('Invalid or expired token');
        localStorage.removeItem('auth_token');
      }
    } catch (error) {
      console.log('No active session found');
      localStorage.removeItem('auth_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string, companyId?: string) => {
    const loginData = companyId 
      ? { username, password, companyId }
      : { username, password };
      
    const response = await apiRequest('POST', '/api/auth/login', loginData);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error de autenticación');
    }

    const { user: userData, token } = await response.json();
    
    localStorage.setItem('auth_token', token);
    setUser(userData);
    
    // Redirección automática después del login exitoso
    setTimeout(() => {
      window.location.href = '/';
    }, 100);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    // Recargar la página para limpiar cualquier estado persistente
    window.location.href = '/login';
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}