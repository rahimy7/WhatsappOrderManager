import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { registerRoutes } from "./routes";
import { registerUserManagementRoutes } from "./user-management-routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedAutoResponses } from "./seed-auto-responses";
import { seedAssignmentRules } from "./seed-assignment-rules";
import { getStoreInfo, getTenantDb, masterDb, tenantMiddleware } from "./multi-tenant-db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest, AuthUser } from './auth-types';
import { WebSocketServer } from 'ws';
import { authenticateToken } from './authMiddleware.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const app = express();
const server = createServer(app);

// Get the __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRITICAL: Parse JSON bodies globally
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CRITICAL: Create a high-priority router for API endpoints
const apiRouter = express.Router();

// Health endpoint - MUST be before any middleware
apiRouter.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || process.env.RAILWAY_PORT || 5000
  });
});

// Login endpoint
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { authenticateUser } = await import('./multi-tenant-auth.js');
    const { username, password, companyId, storeId } = req.body;
    
    // Convert companyId to storeId for compatibility
    const targetStoreId = storeId || companyId;
    
    const user = await authenticateUser(username, password, targetStoreId);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas' 
      });
    }

    // Validate store access if storeId is provided
    if (targetStoreId && user.level !== 'global') {
      if (!user.storeId || user.storeId !== parseInt(targetStoreId)) {
        return res.status(403).json({
          success: false,
          code: 'STORE_ACCESS_DENIED',
          message: 'No tienes acceso a esta tienda'
        });
      }
    }

    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        storeId: user.storeId,
        level: user.level
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '24h' }
    );

    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        storeId: user.storeId,
        level: user.level
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Auth verification endpoint
apiRouter.get('/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    
    res.setHeader('Content-Type', 'application/json');
    res.json({
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      storeId: decoded.storeId,
      level: decoded.level
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// CRITICAL: Mount API router with highest priority
app.use('/api', apiRouter);

// Start the application
(async () => {
  try {
    // Register other routes
    await registerRoutes(app);
    await registerUserManagementRoutes(app);

    // Seed default data if needed
    try {
      console.log('Starting seed process...');
      // await seedAutoResponses();
      // await seedAssignmentRules();
      console.log('Seed process completed.');
    } catch (error) {
      console.error('Error during seeding:', error);
      // Continue without seeding if there's an error
    }

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // Setup Vite or serve static files
    if (process.env.NODE_ENV === 'development') {
      await setupVite(app, server);
    } else {
      // In production, serve static files
      const staticPath = path.join(__dirname, 'public');
      app.use(express.static(staticPath));
      
      // Handle client-side routing
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ error: 'API endpoint not found' });
        }
        res.sendFile(path.join(staticPath, 'index.html'));
      });
    }

    // WebSocket Server
    const wss = new WebSocketServer({ server });
    wss.on('connection', (socket, req) => {
      try {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const token = url.searchParams.get('token');

        console.log('🔌 Nueva conexión WebSocket con token:', token);

        // Validate JWT token if needed
        if (token) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
          console.log('✅ Token válido:', decoded);

          // Send welcome message
          socket.send(JSON.stringify({ type: 'connected', message: 'WebSocket conectado exitosamente' }));
        } else {
          console.log('❌ Token no proporcionado');
          socket.close();
        }

        // Handle incoming messages
        socket.on('message', (data) => {
          console.log('📩 Mensaje recibido del cliente:', data.toString());
        });

        // Handle connection close
        socket.on('close', () => {
          console.log('🔌 Conexión WebSocket cerrada');
        });

      } catch (error: any) {
        console.error('❌ Error en conexión WebSocket:', error.message);
        socket.close();
      }
    });

    // IMPORTANT: Use PORT from environment variable for Railway
    const PORT = parseInt(process.env.PORT || process.env.RAILWAY_PORT || '5000', 10);
    const HOST = '0.0.0.0'; // Listen on all interfaces

    server.listen(PORT, HOST, () => {
      log(`🚀 Server running on ${HOST}:${PORT}`);
      log(`📱 Health check available at http://${HOST}:${PORT}/api/health`);
      log(`🔌 WebSocket server ready`);
      log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error('Error starting application:', error);
    process.exit(1);
  }
})();