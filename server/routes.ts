import { Express, Request, Response, NextFunction } from 'express';
import { IStorage } from './storage.js';
import jwt from 'jsonwebtoken';
import { Server } from 'http';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function generateGoogleMapsLink(latitude: string | number, longitude: string | number, address?: string): string {
  const lat = parseFloat(latitude.toString());
  const lng = parseFloat(longitude.toString());
  
  if (isNaN(lat) || isNaN(lng)) {
    return address || 'Ubicación no disponible';
  }
  
  const baseUrl = 'https://www.google.com/maps/search/';
  
  if (address && address.trim() !== '') {
    return `${baseUrl}${encodeURIComponent(address)}/@${lat},${lng},15z`;
  } else {
    return `${baseUrl}@${lat},${lng},15z`;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}

function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

export async function registerRoutes(app: Express): Promise<any> {
  // Import storage dynamically to avoid dependency issues
  const { DatabaseStorage } = await import('./storage.js');
  const storage = new DatabaseStorage();
  // Multi-tenant WhatsApp message processing function
  async function processWhatsAppMessage(value: any) {
    console.log('🎯 PROCESSWHATSAPPMESSAGE - Iniciando procesamiento');
    console.log('🚀 WEBHOOK RECEIVED - Function called successfully');
    
    // CRITICAL FIX: Use simple processor instead of complex routing
    console.log('🔄 DELEGATING TO SIMPLE PROCESSOR - Bypassing complex routing');
    const { processWhatsAppMessageSimple } = await import('./whatsapp-simple.js');
    await processWhatsAppMessageSimple(value);
    return;
  }

  // Function to process customer messages and responses
  async function processCustomerMessage(customer: any, conversation: any, message: any, from: string, isNewCustomer: boolean = false, storeId?: number, phoneNumberId?: string) {
    try {
      const text = message.text?.body || '';
      console.log('🔀 PROCESSADA CUSTOMERMESSAGE - Mensaje:', text, 'storeId:', storeId);

      // PRIORITY 1: Check if message is a structured order from web catalog
      const isOrder = await isOrderMessage(text);
      
      if (isOrder) {
        console.log('🛍️ ORDER DETECTED - Processing catalog order via simple processor');
        // Let simple processor handle order processing
        return;
      }

      // For non-order messages, process as normal conversation
      console.log('💬 REGULAR MESSAGE - Processing as conversation');
      // Additional conversation processing logic can be added here
      
    } catch (error) {
      console.error('Error in processCustomerMessage:', error);
    }
  }

  // Additional utility functions
  async function isOrderMessage(text: string): Promise<boolean> {
    return text.startsWith('🛍️ *NUEVO PEDIDO*');
  }

  // WhatsApp webhook endpoint
  app.post('/webhook', async (req: Request, res: Response) => {
    try {
      const value = req.body;
      console.log('🎯 WEBHOOK RECEIVED - Processing WhatsApp message');
      
      await processWhatsAppMessage(value);
      
      res.sendStatus(200);
    } catch (error) {
      console.error('Error in webhook processing:', error);
      res.sendStatus(500);
    }
  });

  // WhatsApp webhook verification
  app.get('/webhook', (req: Request, res: Response) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'verifytoken12345';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    }
  });

  // Health endpoint is defined in index.ts to prevent Vite middleware interference

  // Routes registered successfully - server managed by index.ts
  return app as any;
}