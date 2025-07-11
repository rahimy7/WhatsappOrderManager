import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUser } from './auth-types';

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

    // 🧠 Permitir sin storeId si es nivel global
    if (!('storeId' in decoded) && (decoded as any).level !== 'global') {
      return res.status(403).json({ error: 'Token incompleto - falta storeId' });
    }

    req.user = decoded as AuthUser;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
};
