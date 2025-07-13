import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUser } from '@shared/auth';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token no proporcionado' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

    if (typeof decoded !== 'object' || decoded === null) {
      return res.status(403).json({ error: 'Token inválido' });
    }

    // 🔧 CORRECCIÓN: Verificar storeId basado en el nivel de acceso
    const user = decoded as any;
    
    // Si es super_admin o tiene nivel global, no necesita storeId
    if (user.role === 'super_admin' || user.level === 'global') {
      req.user = decoded as AuthUser;
      return next();
    }
    
    // Para usuarios de tienda y operacionales, verificar que tengan un storeId válido
    if (!user.storeId || user.storeId === null || user.storeId === undefined) {
      return res.status(403).json({ error: 'Token incompleto - falta storeId' });
    }

    req.user = decoded as AuthUser;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};
