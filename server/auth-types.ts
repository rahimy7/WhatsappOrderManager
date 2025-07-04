/**
 * Tipos de autenticación para el sistema multi-tenant
 */

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  name?: string;
  email?: string;
  storeId?: number;
  level: 'global' | 'store' | 'tenant';
  permissions?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  session?: any;
  sessionID?: string;
  files?: any;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      session?: any;
      sessionID?: string;
      files?: any;
    }
  }
}