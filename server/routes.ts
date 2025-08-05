import express, { Request, Response } from "express";
import bcrypt from "bcryptjs"; // ✅ Usar bcryptjs para compatibilidad
import jwt from "jsonwebtoken";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { sql, eq } from "drizzle-orm";

// Schema and Types
import {
  insertUserSchema,
  // selectUserSchema, // ❌ No existe, removido
  insertNotificationSchema,
  type User as SelectUser,
  // userRoleEnum, // ❌ No existe, removido
} from "@shared/schema";
import { type AuthUser } from "@shared/auth";

// Middleware
import { authenticateToken, requireSuperAdmin } from "./authMiddleware";

// Storage Layer
import { StorageFactory } from './storage/storage-factory';
import { UnifiedStorage } from './storage/unified-storage';
import { getMasterStorage, getTenantStorage, healthCheck } from './storage/index';
import { db as masterDb } from './db'; // ✅ Usar db como masterDb
import * as schema from '@shared/schema'; // ✅ Importar schema directamente

const storageFactory = StorageFactory.getInstance();

// Helper function corregida para obtener tenant storage
async function getTenantStorageForUser(user: { storeId: number }) {
  if (!user.storeId) {
    throw new Error('User does not have a valid store ID');
  }
  return await storageFactory.getTenantStorage(user.storeId);
}
// Utilities
// import { SupabaseStorageManager } from './supabase-storage-manager'; // Commented out until file is created

// ================================
// STORAGE INITIALIZATION
// ================================
const masterStorage = getMasterStorage();

// ================================
// CONFIGURATION
// ================================
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ================================
// MULTER CONFIGURATION
// ================================
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Obtiene el storage unificado para un usuario específico
 */
async function getUnifiedStorageForUser(user: AuthUser): Promise<UnifiedStorage> {
  if (!user.storeId) {
    throw new Error('User must have a store ID');
  }
  return new UnifiedStorage(user.storeId);
}

/**
 * Obtiene el tenant storage directamente para un usuario
 */
async function getTenantStorageInternal(user: AuthUser) {
  if (!user.storeId) {
    throw new Error('User must have a store ID');
  }
  return await getTenantStorage(user.storeId);
}

/**
 * Valida acceso al tenant storage
 */
async function validateTenantAccess(storeId: number): Promise<void> {
  const store = await masterStorage.getVirtualStore(storeId);
  if (!store) {
    throw new Error('Store not found');
  }
  if (!store.databaseUrl?.includes('schema=')) {
    throw new Error('Store not configured for tenant storage');
  }
}

/**
 * Procesa imágenes de productos
 */
async function processProductImages(
  files: Express.Multer.File[],
  imageUrls: string[],
  storeId: number,
  productId?: number
): Promise<string[]> {
  const processedImages: string[] = [];

  try {
    // Con Supabase Storage (cuando esté configurado)
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Dinamically import SupabaseStorageManager to avoid build issues
      const { SupabaseStorageManager } = await import('./supabase-storage');
      const storageManager = new SupabaseStorageManager(storeId);
      
      // Procesar archivos subidos
      for (const file of files) {
        const fileObject = new File([file.buffer], file.originalname, { type: file.mimetype });
        const imageUrl = await storageManager.uploadFile(fileObject, productId);
        processedImages.push(imageUrl);
      }

      // Procesar URLs de imágenes
      for (const url of imageUrls) {
        const imageUrl = await storageManager.uploadFromUrl(url, productId);
        processedImages.push(imageUrl);
      }
    } 
    // Placeholder para desarrollo
    else {
      console.log('📁 USING PLACEHOLDER STORAGE - Configure Supabase for production');
      
      // Procesar archivos subidos
      for (const file of files) {
        const imageUrl = `/uploads/${file.filename}`;
        processedImages.push(imageUrl);
      }

      // Procesar URLs de imágenes
      for (const url of imageUrls) {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          if (response.ok) {
            processedImages.push(url);
          }
        } catch (error) {
          console.warn(`Error validating image URL: ${url}`, error);
        }
      }
    }

    return processedImages;
  } catch (error) {
    console.error('Error processing images:', error);
    throw error;
  }
}

/**
 * Genera link de Google Maps
 */
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

/**
 * Formatea moneda
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
}

// ================================
// MIDDLEWARE
// ================================

/**
 * Middleware para validar tenant storage
 */
const requireTenantStorage = async (req: any, res: any, next: any) => {
  try {
    const user = req.user;
    
    if (!user.storeId) {
      return res.status(400).json({ error: 'Store ID required for this operation' });
    }
    
    await validateTenantAccess(user.storeId);
    const tenantStorage = await getTenantStorageInternal(user);
    
    req.tenantStorage = tenantStorage;
    next();
  } catch (error) {
    console.error('Tenant storage validation failed:', error);
    res.status(500).json({ error: 'Failed to access store data' });
  }
};

// ================================
// PRODUCT HANDLERS
// ================================

const getProductsHandler = async (req: any, res: any) => {
  try {
    const user = req.user as AuthUser;
    
    if (!user.storeId) {
      return res.status(403).json({
        error: "Store ID es requerido"
      });
    }

    console.log('🛍️ Getting products for store:', user.storeId);

    const tenantStorage = await getTenantStorageForUser(user);
    const products = await tenantStorage.getAllProducts();
    
    console.log(`✅ Retrieved ${products.length} products from tenant schema`);
    res.json(products);
    
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      error: "Error interno del servidor"
    });
  }
};

const getProductByIdHandler = async (req: any, res: any) => {
  try {
    const user = req.user as AuthUser;
    const productId = parseInt(req.params.id);

    console.log('🔍 Getting product', productId, 'for store:', user.storeId);

    const tenantStorage = await getTenantStorageForUser(user);
    const product = await tenantStorage.getProductById(productId);

    if (!product) {
      console.log('❌ Product not found in store:', user.storeId);
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    console.log('✅ Product found in tenant schema');
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      error: "Error interno del servidor"
    });
  }
};

const createProductHandler = async (req: any, res: any) => {
  try {
    console.log('🔍 Headers:', req.headers);
    console.log('🔍 Content-Type:', req.headers['content-type']);
    console.log('🔍 Raw body:', req.body);
    const user = req.user as AuthUser;
    
    if (!user.storeId) {
      return res.status(403).json({
        error: "Store ID es requerido"
      });
    }

    console.log('➕ Creating product for store:', user.storeId);
    console.log('📋 Request body received:', JSON.stringify(req.body, null, 2));

    // ✅ VALIDACIÓN EXPLÍCITA DEL NOMBRE
    if (!req.body || !req.body.name || req.body.name.trim() === '') {
      console.log('❌ Product name validation failed:', {
        hasBody: !!req.body,
        name: req.body?.name,
        nameType: typeof req.body?.name
      });
      return res.status(400).json({
        error: "El nombre del producto es requerido"
      });
    }

    const tenantStorage = await getTenantStorageForUser(user);
    
    // ✅ CONSTRUCCIÓN EXPLÍCITA DE PRODUCTDATA
    const productData = {
      name: req.body.name.trim(),  // ← Asegurar que el name está presente
      description: req.body.description || '',
      price: req.body.price || '0.00',
      category: req.body.category || 'general',
      status: req.body.status || 'active',
      imageUrl: req.body.imageUrl || null,
      images: req.body.images || [],
      sku: req.body.sku || null,
      brand: req.body.brand || null,
      model: req.body.model || null,
      specifications: req.body.specifications || null,
      features: req.body.features || null,
      warranty: req.body.warranty || null,
      availability: req.body.availability || 'in_stock',
      stockQuantity: parseInt(req.body.stockQuantity) || 0,
      minQuantity: parseInt(req.body.minQuantity) || 1,
      maxQuantity: req.body.maxQuantity ? parseInt(req.body.maxQuantity) : null,
      weight: req.body.weight || null,
      dimensions: req.body.dimensions || null,
      tags: req.body.tags || null,
      salePrice: req.body.salePrice || null,
      isPromoted: Boolean(req.body.isPromoted),
      promotionText: req.body.promotionText || null,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true
    };

    console.log('📋 Final productData to send:', JSON.stringify(productData, null, 2));

    // Si hay archivos subidos, procesarlos
    if (req.files && req.files.length > 0) {
      const processedImages = await processProductImages(
        req.files,
        req.body.imageUrls || [],
        user.storeId,
        undefined
      );
      productData.images = processedImages;
    }

    const product = await tenantStorage.createProduct(productData);
    
    console.log('✅ Product created in tenant schema:', product.id);
    res.status(201).json(product);
    
  } catch (error) {
    console.error('Error creating product:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return res.status(400).json({
          error: "Ya existe un producto con este SKU"
        });
      }
      
      if (error.message.includes('validation') || error.message.includes('required')) {
        return res.status(400).json({
          error: error.message
        });
      }
    }

    res.status(500).json({
      error: "Error interno del servidor",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

const updateProductHandler = async (req: any, res: any) => {
  try {
    const user = req.user as AuthUser;
    const productId = parseInt(req.params.id);

    if (!user.storeId) {
      return res.status(403).json({
        error: "Store ID es requerido"
      });
    }

    console.log('✏️ Updating product', productId, 'for store:', user.storeId);

    const tenantStorage = await getTenantStorageForUser(user);
    
    // Verificar que el producto existe
    const existingProduct = await tenantStorage.getProductById(productId);
    if (!existingProduct) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // Procesar datos de actualización
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };

    // Si hay archivos nuevos, procesarlos
    if (req.files && req.files.length > 0) {
      const processedImages = await processProductImages(
        req.files,
        req.body.imageUrls || [],
        user.storeId,
        productId
      );
      updateData.images = processedImages;
    }

    const product = await tenantStorage.updateProduct(productId, updateData);
    
    console.log('✅ Product updated in tenant schema');
    res.json(product);
    
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      error: "Error interno del servidor"
    });
  }
};

const deleteProductHandler = async (req: any, res: any) => {
  try {
    const user = req.user as AuthUser;
    const productId = parseInt(req.params.id);

    console.log('🗑️ Deleting product', productId, 'from store:', user.storeId);

    const tenantStorage = await getTenantStorageForUser(user);
    
    // Verificar que el producto existe
    const product = await tenantStorage.getProductById(productId);
    if (!product) {
      console.log('❌ Product not found in store:', user.storeId);
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    await tenantStorage.deleteProduct(productId);

    console.log('✅ Product deleted from tenant schema');
    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting product:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('constraint') || error.message.includes('foreign key')) {
        return res.status(400).json({ 
          error: "No se puede eliminar: el producto está siendo usado en órdenes existentes" 
        });
      }
    }
    
    res.status(500).json({
      error: "Error interno del servidor"
    });
  }
};

// ================================
// CATEGORY HANDLERS
// ================================

const getCategoriesHandler = async (req: any, res: any) => {
  try {
    const user = req.user as AuthUser;
    
    if (!user.storeId) {
      return res.status(403).json({
        error: "Store ID es requerido"
      });
    }
    
    console.log('📂 Getting categories for store:', user.storeId);
    
    const tenantStorage = await getTenantStorageForUser(user);
    const categories = await tenantStorage.getAllCategories();
    
    console.log(`✅ Retrieved ${categories.length} categories from tenant schema`);
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      error: "Error interno del servidor"
    });
  }
};

const createCategoryHandler = async (req: any, res: any) => {
  try {
    const user = req.user as AuthUser;
    
    if (!user.storeId) {
      return res.status(403).json({
        error: "Store ID es requerido"
      });
    }
    
    console.log('📁 Creating category for store:', user.storeId);
    
    const tenantStorage = await getTenantStorageForUser(user);
    
    const categoryData = { 
      ...req.body,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      sortOrder: req.body.sortOrder || 0
    };
    
    const category = await tenantStorage.createCategory(categoryData);

    console.log('✅ Category created in tenant schema:', category.name);
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return res.status(400).json({
          error: "Ya existe una categoría con este nombre"
        });
      }
    }
    
    res.status(500).json({
      error: "Error interno del servidor"
    });
  }
};

const updateCategoryHandler = async (req: any, res: any) => {
  try {
    const user = req.user as AuthUser;
    const categoryId = parseInt(req.params.id);
    
    if (!user.storeId) {
      return res.status(403).json({
        error: "Store ID es requerido"
      });
    }
    
    console.log('✏️ Updating category', categoryId, 'for store:', user.storeId);
    
    const tenantStorage = await getTenantStorageForUser(user);
    
    // Verificar que la categoría existe
    const existingCategory = await tenantStorage.getCategoryById(categoryId);
    if (!existingCategory) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }
    
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    const category = await tenantStorage.updateCategory(categoryId, updateData);
    
    console.log('✅ Category updated in tenant schema');
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      error: "Error interno del servidor"
    });
  }
};

const deleteCategoryHandler = async (req: any, res: any) => {
  try {
    const user = req.user as AuthUser;
    const categoryId = parseInt(req.params.id);
    
    if (!user.storeId) {
      return res.status(403).json({
        error: "Store ID es requerido"
      });
    }
    
    console.log('🗑️ Deleting category', categoryId, 'from store:', user.storeId);
    
    const tenantStorage = await getTenantStorageForUser(user);
    
    // Verificar que la categoría existe
    const category = await tenantStorage.getCategoryById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }
    
    await tenantStorage.deleteCategory(categoryId);
    
    console.log('✅ Category deleted from tenant schema');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('constraint') || error.message.includes('foreign key')) {
        return res.status(400).json({ 
          error: "No se puede eliminar: la categoría está siendo usada por productos" 
        });
      }
    }
    
    res.status(500).json({
      error: "Error interno del servidor"
    });
  }
};

// ================================
// IMAGE HANDLERS
// ================================

const validateImageUrlHandler = async (req: any, res: any) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: 'URL de imagen requerida' });
    }

    try {
      new URL(imageUrl);
    } catch {
      return res.status(400).json({ error: 'Formato de URL inválido' });
    }

    res.json({ 
      success: true, 
      imageUrl,
      message: 'URL válida' 
    });

  } catch (error) {
    console.error('Error validating image URL:', error);
    res.status(500).json({ 
      error: 'Error validando URL',
      message: (error as Error).message 
    });
  }
};

const uploadImageHandler = async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = req.user as AuthUser;
    console.log('📁 Processing uploaded file:', req.file.originalname);
    
    const imageUrl = `/uploads/${req.file.filename}`;
    
    res.json({ 
      success: true, 
      imageUrl,
      originalName: req.file.originalname,
      message: 'Archivo subido exitosamente'
    });

  } catch (error) {
    console.error('❌ Error uploading image:', error);
    res.status(500).json({ 
      error: 'Failed to upload image',
      message: (error as Error).message 
    });
  }
};

// ================================
// USER MANAGEMENT FUNCTIONS
// ================================

export function setupUserManagementRoutes(app: any) {
  // Crear usuario global (super_admin, system_admin)
  app.post('/api/super-admin/global-users', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { name, username, email, password, role } = req.body;

      if (!['super_admin', 'system_admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role for global user' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await masterStorage.createGlobalUser({
        name,
        username,
        email,
        password: hashedPassword,
        role,
        status: 'active',
        isActive: true
      });

      res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        message: 'Global user created successfully'
      });

    } catch (error) {
      console.error('Error creating global user:', error);
      if (error instanceof Error && error.message.includes('already exists')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to create global user' });
    }
  });

  // Listar usuarios globales
  app.get('/api/super-admin/global-users', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const users = await masterStorage.listGlobalUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching global users:', error);
      res.status(500).json({ error: 'Failed to fetch global users' });
    }
  });

  // Crear usuario de tienda
  app.post('/api/super-admin/users', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { name, email, role, storeId, username, password } = req.body;

      // Validar que la tienda existe
      const store = await masterStorage.getVirtualStore(storeId);
      if (!store) {
        return res.status(400).json({ error: 'Store not found' });
      }

      const finalUsername = username || `${name.toLowerCase().replace(/\s+/g, '')}_${Date.now()}`;
      const tempPassword = password || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const newUser = await masterStorage.createStoreUser({
        name,
        username: finalUsername,
        email,
        password: hashedPassword,
        role,
        storeId,
        isActive: true
      });

      res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        storeId: newUser.storeId,
        isActive: newUser.isActive,
        tempPassword: tempPassword,
        storeName: store.name
      });

    } catch (error) {
      console.error('Error creating store user:', error);
      if (error instanceof Error && error.message.includes('already exists')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to create store user' });
    }
  });

  // Estadísticas de usuarios
  app.get('/api/super-admin/user-metrics', authenticateToken, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await masterStorage.getUserStats();
      
      res.json({
        totalUsers: stats.globalUsers + stats.storeUsers,
        activeUsers: stats.activeStoreUsers,
        storeOwners: stats.usersByRole.store_owner || 0,
        superAdmins: stats.globalUsers,
        suspendedUsers: stats.storeUsers - stats.activeStoreUsers,
        newUsersThisMonth: 0,
        globalUsers: stats.globalUsers,
        storeUsers: stats.storeUsers,
        usersByRole: stats.usersByRole
      });
    } catch (error) {
      console.error('Error fetching user metrics:', error);
      res.status(500).json({ error: 'Failed to fetch user metrics' });
    }
  });

  
}

// ================================
// WEBHOOK PROCESSORS
// ================================

async function processWhatsAppMessage(value: any) {
  console.log('🎯 PROCESSWHATSAPPMESSAGE - Iniciando procesamiento');
  console.log('🚀 WEBHOOK RECEIVED - Function called successfully');
  
  try {
    // ✅ IMPORT DIRECTO con nombre correcto
    const whatsappModule = await import('./whatsapp-simple.js');
    
    // Verificar qué función usar basado en lo que está disponible
    if (whatsappModule.processWhatsAppMessage) {
      await whatsappModule.processWhatsAppMessage(value);
    } else if (whatsappModule.default) {
      await whatsappModule.default(value);
    } else {
      console.error('❌ No se encontró función de procesamiento de WhatsApp');
      throw new Error('WhatsApp processing function not found');
    }
    
    console.log('✅ WhatsApp message processed successfully');
    
  } catch (error) {
    console.error('❌ Error processing WhatsApp message:', error);
    throw error;
  }
}

// ================================
// MAIN ROUTES REGISTRATION
// ================================

export async function registerRoutes(app: express.Application) {
  const router = express.Router();

  // ================================
  // AUTHENTICATION ENDPOINTS
  // ================================

  router.post("/login", async (req: any, res: any) => {
    try {
      const { username, password, storeId } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      // Usar master storage para autenticación
      const user = await masterStorage.authenticateUser(username, password, storeId);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role, storeId: user.storeId },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ token, user });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Failed to authenticate" });
    }
  });

  // ================================
  // WEBHOOK ENDPOINTS
  // ================================

  router.post('/webhook', async (req: Request, res: Response) => {
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

  router.get('/webhook', (req: Request, res: Response) => {
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

  // ================================
  // PRODUCT ROUTES
  // ================================

  router.get('/products', authenticateToken, getProductsHandler);
  router.get('/products/:id', authenticateToken, getProductByIdHandler);
router.post('/products', authenticateToken, createProductHandler);
      
    

  router.put('/products/:id', authenticateToken, updateProductHandler);
  router.delete('/products/:id', authenticateToken, deleteProductHandler);

  // ================================
  // CATEGORY ROUTES
  // ================================

  router.get('/categories', authenticateToken, getCategoriesHandler);
  router.post('/categories', authenticateToken, createCategoryHandler);
  router.put('/categories/:id', authenticateToken, updateCategoryHandler);
  router.delete('/categories/:id', authenticateToken, deleteCategoryHandler);

  // ================================
  // CUSTOMER ROUTES
  // ================================

  router.get('/customers', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const tenantStorage = await getTenantStorageForUser(user);
      const customers = await tenantStorage.getAllCustomers();
      res.json(customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  router.post('/customers', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const customerData = { ...req.body, storeId: user.storeId };
      
      const tenantStorage = await getTenantStorageForUser(user);
      const customer = await tenantStorage.createCustomer(customerData);
      res.status(201).json(customer);
    } catch (error) {
      console.error('Error creating customer:', error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  router.put('/customers/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const customer = await tenantStorage.updateCustomer(id, req.body);
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      res.json(customer);
    } catch (error) {
      console.error('Error updating customer:', error);
      res.status(500).json({ error: 'Failed to update customer' });
    }
  });

  router.delete('/customers/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      await tenantStorage.deleteCustomer(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting customer:', error);
      res.status(500).json({ error: 'Failed to delete customer' });
    }
  });

  // ================================
  // EMPLOYEE ROUTES
  // ================================

  router.get('/employees', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const tenantStorage = await getTenantStorageForUser(user);
      const employees = await tenantStorage.getAllEmployeeProfiles();
      res.json(employees);
    } catch (error) {
      console.error('Error fetching employees:', error);
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  router.post('/employees', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const employeeData = { ...req.body, storeId: user.storeId };
      
      const tenantStorage = await getTenantStorageForUser(user);
      const employee = await tenantStorage.createEmployeeProfile(employeeData);
      res.status(201).json(employee);
    } catch (error) {
      console.error('Error creating employee:', error);
      res.status(500).json({ error: "Failed to create employee" });
    }
  });

  router.put('/employees/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const employee = await tenantStorage.updateEmployeeProfile(id, req.body);
      if (!employee) {
        return res.status(404).json({ error: 'Employee not found' });
      }
      
      res.json(employee);
    } catch (error) {
      console.error('Error updating employee:', error);
      res.status(500).json({ error: 'Failed to update employee' });
    }
  });

  router.delete('/employees/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      await tenantStorage.deleteEmployeeProfile(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting employee:', error);
      res.status(500).json({ error: 'Failed to delete employee' });
    }
  });

  // ================================
    // ================================
  // CONVERSATION ROUTES - CORREGIDOS ✅
  // ================================

  router.get('/conversations', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      console.log('📞 [GET /conversations] User store:', user.storeId);
      
      const tenantStorage = await getTenantStorageForUser(user);
      const conversations = await tenantStorage.getAllConversations();
      
      console.log('✅ [GET /conversations] Found:', conversations.length, 'conversations');
      res.json(conversations);
    } catch (error) {
      console.error('❌ [GET /conversations] Error:', error);
      res.status(500).json({ 
        error: "Failed to fetch conversations",
        details: error.message 
      });
    }
  });

  router.get('/conversations/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      console.log('📞 [GET /conversations/:id] ID:', id, 'User store:', user.storeId);
      
      const tenantStorage = await getTenantStorageForUser(user);
      const conversation = await tenantStorage.getConversationById(id);
      
      if (!conversation) {
        console.log('⚠️ [GET /conversations/:id] Not found:', id);
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      // También obtener los mensajes
      const messages = await tenantStorage.getMessagesByConversation(id);
      
      const result = {
        ...conversation,
        messages: messages || []
      };
      
      console.log('✅ [GET /conversations/:id] Success:', id, 'with', messages?.length || 0, 'messages');
      res.json(result);
    } catch (error) {
      console.error('❌ [GET /conversations/:id] Error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch conversation',
        details: error.message 
      });
    }
  });

  router.post('/conversations', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      console.log('📞 [POST /conversations] Creating:', req.body);
      
      const conversationData = { 
        ...req.body, 
        storeId: user.storeId,
        createdAt: new Date(),
        lastMessageAt: new Date()
      };
      
      const tenantStorage = await getTenantStorageForUser(user);
      const conversation = await tenantStorage.createConversation(conversationData);
      
      console.log('✅ [POST /conversations] Created:', conversation.id);
      res.status(201).json(conversation);
    } catch (error) {
      console.error('❌ [POST /conversations] Error:', error);
      res.status(500).json({ 
        error: "Failed to create conversation",
        details: error.message 
      });
    }
  });

  router.put('/conversations/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      console.log('📞 [PUT /conversations/:id] Updating:', id, req.body);
      
      const tenantStorage = await getTenantStorageForUser(user);
      const conversation = await tenantStorage.updateConversation(id, {
        ...req.body,
        updatedAt: new Date()
      });
      
      if (!conversation) {
        console.log('⚠️ [PUT /conversations/:id] Not found:', id);
        return res.status(404).json({ error: 'Conversation not found' });
      }
      
      console.log('✅ [PUT /conversations/:id] Updated:', id);
      res.json(conversation);
    } catch (error) {
      console.error('❌ [PUT /conversations/:id] Error:', error);
      res.status(500).json({ 
        error: "Failed to update conversation",
        details: error.message 
      });
    }
  });

  router.get('/conversations/:id/messages', authenticateToken, async (req: any, res: any) => {
    try {
      const conversationId = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      console.log('💬 [GET /conversations/:id/messages] Conversation:', conversationId);
      
      const tenantStorage = await getTenantStorageForUser(user);
      const messages = await tenantStorage.getMessagesByConversation(conversationId);
      
      console.log('✅ [GET /conversations/:id/messages] Found:', messages.length, 'messages');
      res.json(messages);
    } catch (error) {
      console.error('❌ [GET /conversations/:id/messages] Error:', error);
      res.status(500).json({ 
        error: "Failed to fetch messages",
        details: error.message 
      });
    }
  });

  router.post('/conversations/:id/messages', authenticateToken, async (req: any, res: any) => {
    try {
      const conversationId = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      console.log('💬 [POST /conversations/:id/messages] Creating message for conversation:', conversationId);
      
      const messageData = {
        ...req.body,
        conversationId: conversationId,
        senderType: req.body.senderType || 'agent',
        senderId: user.id,
        createdAt: new Date(),
        sentAt: new Date()
      };
      
      const tenantStorage = await getTenantStorageForUser(user);
      const message = await tenantStorage.createMessage(messageData);
      
      console.log('✅ [POST /conversations/:id/messages] Created message:', message.id);
      res.status(201).json(message);
    } catch (error) {
      console.error('❌ [POST /conversations/:id/messages] Error:', error);
      res.status(500).json({ 
        error: "Failed to create message",
        details: error.message 
      });
    }
  });

// ORDER ROUTES
  // ================================

// server/routes.ts - Reemplazar la sección ORDER ROUTES (líneas ~42-80)

  // ================================
  // ORDER ROUTES - MEJORADOS
  // ================================

  router.get('/orders', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const tenantStorage = await getTenantStorageForUser(user);
      
      console.log('📦 Fetching orders for store:', user.storeId);
      
      // Obtener órdenes básicas
      const orders = await tenantStorage.getAllOrders();
      
      // Enriquecer con información adicional
      const enrichedOrders = await Promise.all(orders.map(async (order: any) => {
        try {
          // Obtener información del cliente
          let customer = null;
          if (order.customerId) {
            customer = await tenantStorage.getCustomerById(order.customerId);
          }
          
          // Obtener información del usuario asignado
          let assignedUser = null;
          if (order.assignedUserId) {
            try {
              assignedUser = await tenantStorage.getUserById(order.assignedUserId);
            } catch (err) {
              console.warn(`⚠️ User ${order.assignedUserId} not found for order ${order.id}`);
            }
          }
          
          // Obtener items de la orden (si existe la tabla order_items)
          let items = [];
          let totalItems = 0;
          try {
            // Intentar obtener items - algunos sistemas pueden no tener esta tabla
            if (tenantStorage.getOrderItems) {
              items = await tenantStorage.getOrderItems(order.id);
              totalItems = items.length;
            }
          } catch (err) {
            // Si no existe order_items, continuar sin items
            console.log(`ℹ️ No items found for order ${order.id} (expected if no order_items table)`);
          }
          
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            assignedUserId: order.assignedUserId,
            status: order.status,
            priority: order.priority || 'normal',
            totalAmount: order.totalAmount,
            deliveryCost: order.deliveryCost || '0.00',
            deliveryAddress: order.deliveryAddress,
            contactNumber: order.contactNumber,
            estimatedDelivery: order.estimatedDelivery,
            estimatedDeliveryTime: order.estimatedDeliveryTime,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            description: order.description,
            notes: order.notes,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            lastStatusUpdate: order.lastStatusUpdate,
            customerLastInteraction: order.customerLastInteraction,
            modificationCount: order.modificationCount || 0,
            storeId: order.storeId,
            
            // Información expandida del cliente
            customer: customer ? {
              id: customer.id,
              name: customer.name || 'Cliente',
              phone: customer.phone || order.contactNumber,
              email: customer.email,
              address: customer.address || order.deliveryAddress
            } : {
              id: order.customerId,
              name: 'Cliente no encontrado',
              phone: order.contactNumber,
              email: null,
              address: order.deliveryAddress
            },
            
            // Usuario asignado
            assignedUser: assignedUser ? {
              id: assignedUser.id,
              name: assignedUser.name,
              role: assignedUser.role
            } : null,
            
            // Items de la orden
            items: items.map((item: any) => ({
              id: item.id,
              orderId: item.orderId,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              installationCost: item.installationCost || '0.00',
              partsCost: item.partsCost || '0.00',
              laborHours: item.laborHours || '0',
              laborRate: item.laborRate || '0.00',
              deliveryCost: item.deliveryCost || '0.00',
              deliveryDistance: item.deliveryDistance || '0',
              notes: item.notes,
              product: item.product || {
                id: item.productId,
                name: 'Producto',
                description: '',
                category: '',
                price: item.unitPrice
              }
            })),
            totalItems
          };
        } catch (error) {
          console.error(`❌ Error enriching order ${order.id}:`, error);
          // En caso de error, devolver orden básica con estructura mínima
          return {
            ...order,
            customer: {
              id: order.customerId,
              name: 'Cliente',
              phone: order.contactNumber,
              email: null,
              address: order.deliveryAddress
            },
            assignedUser: null,
            items: [],
            totalItems: 0,
            priority: order.priority || 'normal'
          };
        }
      }));
      
      // Aplicar filtros de query parameters
      let filteredOrders = enrichedOrders;
      const { status, limit, offset, priority, customerId } = req.query;
      
      if (status && status !== 'all') {
        filteredOrders = filteredOrders.filter((order: any) => order.status === status);
      }
      
      if (priority && priority !== 'all') {
        filteredOrders = filteredOrders.filter((order: any) => order.priority === priority);
      }
      
      if (customerId) {
        filteredOrders = filteredOrders.filter((order: any) => order.customerId === parseInt(customerId));
      }
      
      if (offset) {
        const offsetNum = parseInt(offset as string);
        filteredOrders = filteredOrders.slice(offsetNum);
      }
      
      if (limit) {
        const limitNum = parseInt(limit as string);
        filteredOrders = filteredOrders.slice(0, limitNum);
      }
      
      console.log(`✅ Returning ${filteredOrders.length} enriched orders`);
      res.json(filteredOrders);
      
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  router.get('/orders/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid order ID' });
      }
      
      const tenantStorage = await getTenantStorageForUser(user);
      const order = await tenantStorage.getOrderById(id);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Enriquecer la orden individual con información completa
      let customer = null;
      if (order.customerId) {
        customer = await tenantStorage.getCustomerById(order.customerId);
      }
      
      let assignedUser = null;
      if (order.assignedUserId) {
        try {
          assignedUser = await tenantStorage.getUserById(order.assignedUserId);
        } catch (err) {
          console.warn(`⚠️ User ${order.assignedUserId} not found`);
        }
      }
      
      // Obtener items si existe el método
      let items = [];
      try {
        if (tenantStorage.getOrderItems) {
          items = await tenantStorage.getOrderItems(order.id);
        }
      } catch (err) {
        console.log(`ℹ️ No items found for order ${order.id}`);
      }
      
      const enrichedOrder = {
        ...order,
        customer: customer ? {
          id: customer.id,
          name: customer.name || 'Cliente',
          phone: customer.phone || order.contactNumber,
          email: customer.email,
          address: customer.address || order.deliveryAddress
        } : {
          id: order.customerId,
          name: 'Cliente no encontrado',
          phone: order.contactNumber,
          email: null,
          address: order.deliveryAddress
        },
        assignedUser: assignedUser ? {
          id: assignedUser.id,
          name: assignedUser.name,
          role: assignedUser.role
        } : null,
        items: items.map((item: any) => ({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          installationCost: item.installationCost || '0.00',
          partsCost: item.partsCost || '0.00',
          laborHours: item.laborHours || '0',
          laborRate: item.laborRate || '0.00',
          deliveryCost: item.deliveryCost || '0.00',
          deliveryDistance: item.deliveryDistance || '0',
          notes: item.notes,
          product: item.product || {
            id: item.productId,
            name: 'Producto',
            description: '',
            category: '',
            price: item.unitPrice
          }
        })),
        totalItems: items.length,
        priority: order.priority || 'normal'
      };
      
      res.json(enrichedOrder);
    } catch (error) {
      console.error('❌ Error fetching order:', error);
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  });

  router.post('/orders', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const orderData = { ...req.body, storeId: user.storeId };
      
      const tenantStorage = await getTenantStorageForUser(user);
      
      // Crear la orden
      const order = await tenantStorage.createOrder(orderData);
      
      // Si hay items, crearlos también
      if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
        try {
          for (const item of req.body.items) {
            if (tenantStorage.createOrderItem) {
              await tenantStorage.createOrderItem({
                orderId: order.id,
                ...item
              });
            }
          }
        } catch (itemError) {
          console.warn('⚠️ Could not create order items:', itemError);
        }
      }
      
      res.status(201).json(order);
    } catch (error) {
      console.error('❌ Error creating order:', error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  router.put('/orders/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid order ID' });
      }
      
      const tenantStorage = await getTenantStorageForUser(user);
      const order = await tenantStorage.updateOrder(id, req.body);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json(order);
    } catch (error) {
      console.error('❌ Error updating order:', error);
      res.status(500).json({ error: 'Failed to update order' });
    }
  });

  router.patch('/orders/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const user = req.user as AuthUser;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const tenantStorage = await getTenantStorageForUser(user);
    const order = await tenantStorage.updateOrder(id, req.body);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('❌ Error updating order (PATCH):', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});


  router.put('/orders/:id/status', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const user = req.user as AuthUser;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid order ID' });
      }
      
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      
      const tenantStorage = await getTenantStorageForUser(user);
      
      const updateData = { 
        status,
        lastStatusUpdate: new Date().toISOString()
      };
      
      const order = await tenantStorage.updateOrder(id, updateData);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json(order);
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  router.delete('/orders/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid order ID' });
      }
      
      const tenantStorage = await getTenantStorageForUser(user);
      
      // Verificar que la orden existe
      const order = await tenantStorage.getOrderById(id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Eliminar items si existen
      try {
        if (tenantStorage.deleteOrderItems) {
          await tenantStorage.deleteOrderItems(id);
        }
      } catch (itemError) {
        console.warn('⚠️ Could not delete order items:', itemError);
      }
      
      // Eliminar la orden
      await tenantStorage.deleteOrder(id);
      
      res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
      console.error('❌ Error deleting order:', error);
      res.status(500).json({ error: 'Failed to delete order' });
    }
  });

  router.put('/orders/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const order = await tenantStorage.updateOrder(id, req.body);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json(order);
    } catch (error) {
      console.error('Error updating order:', error);
      res.status(500).json({ error: 'Failed to update order' });
    }
  });
 // ✅ NUEVO: Endpoint de auto-asignación de órdenes
  router.post('/orders/:id/auto-assign', authenticateToken, async (req: any, res: any) => {
    try {
      const orderId = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      if (isNaN(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID' });
      }
      
      const tenantStorage = await getTenantStorageForUser(user);
      
      // Verificar que la orden existe
      const order = await tenantStorage.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Si ya está asignada, no hacer nada
      if (order.assignedUserId) {
        return res.status(400).json({ 
          error: 'Order is already assigned',
          assignedUser: order.assignedUserId
        });
      }
      
      try {
        // Obtener todos los usuarios disponibles
        const users = await tenantStorage.getAllUsers();
        
        // Filtrar usuarios que pueden ser asignados (técnicos, especialistas, etc.)
        const availableUsers = users.filter((u: any) => 
          ['technician', 'specialist', 'field_worker', 'admin'].includes(u.role?.toLowerCase() || '')
        );
        
        if (availableUsers.length === 0) {
          return res.status(404).json({ 
            error: 'No available users for assignment',
            message: 'No users with appropriate roles found'
          });
        }
        
        // Algoritmo simple de asignación (se puede mejorar con reglas más complejas)
        let selectedUser = null;
        
        // 1. Buscar usuarios con menos órdenes asignadas
        const userWorkloads = await Promise.all(
          availableUsers.map(async (u: any) => {
            const userOrders = await tenantStorage.getAllOrders();
            const assignedCount = userOrders.filter((o: any) => 
              o.assignedUserId === u.id && 
              ['assigned', 'in_progress', 'preparing'].includes(o.status)
            ).length;
            
            return {
              user: u,
              currentWorkload: assignedCount
            };
          })
        );
        
        // Ordenar por carga de trabajo (menor a mayor)
        userWorkloads.sort((a, b) => a.currentWorkload - b.currentWorkload);
        
        // 2. Aplicar reglas adicionales si existen
        // Por ahora, seleccionar el usuario con menor carga de trabajo
        selectedUser = userWorkloads[0].user;
        
        // 3. Asignar la orden
        const updateData = {
          assignedUserId: selectedUser.id,
          status: order.status === 'pending' ? 'assigned' : order.status,
          lastStatusUpdate: new Date().toISOString()
        };
        
        const updatedOrder = await tenantStorage.updateOrder(orderId, updateData);
        
        // 4. Log de la asignación
        console.log(`✅ Order ${orderId} auto-assigned to user ${selectedUser.id} (${selectedUser.name})`);
        
        res.json({
          success: true,
          message: `Order assigned to ${selectedUser.name}`,
          assignedUser: {
            id: selectedUser.id,
            name: selectedUser.name,
            role: selectedUser.role
          },
          order: updatedOrder,
          algorithm: {
            method: 'workload_balancing',
            selectedFrom: availableUsers.length,
            userWorkload: userWorkloads.find(w => w.user.id === selectedUser.id)?.currentWorkload || 0
          }
        });
        
      } catch (assignmentError) {
        console.error('❌ Error in assignment algorithm:', assignmentError);
        return res.status(500).json({ 
          error: 'Assignment algorithm failed',
          message: 'Could not determine best user for assignment'
        });
      }
      
    } catch (error) {
      console.error('❌ Error in auto-assignment:', error);
      res.status(500).json({ error: 'Failed to auto-assign order' });
    }
  });

  // ✅ NUEVO: Endpoint para obtener estadísticas de asignación
  router.get('/orders/assignment/stats', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const tenantStorage = await getTenantStorageForUser(user);
      
      const [orders, users] = await Promise.all([
        tenantStorage.getAllOrders(),
        tenantStorage.getAllUsers()
      ]);
      
      const availableUsers = users.filter((u: any) => 
        ['technician', 'specialist', 'field_worker', 'admin'].includes(u.role?.toLowerCase() || '')
      );
      
      const assignedOrders = orders.filter((o: any) => o.assignedUserId);
      const unassignedOrders = orders.filter((o: any) => !o.assignedUserId);
      
      // Estadísticas por usuario
      const userStats = availableUsers.map((u: any) => {
        const userOrders = orders.filter((o: any) => o.assignedUserId === u.id);
        const activeOrders = userOrders.filter((o: any) => 
          ['assigned', 'in_progress', 'preparing'].includes(o.status)
        );
        
        return {
          userId: u.id,
          userName: u.name,
          userRole: u.role,
          totalOrders: userOrders.length,
          activeOrders: activeOrders.length,
          completedOrders: userOrders.filter((o: any) => o.status === 'completed').length
        };
      });
      
      res.json({
        summary: {
          totalOrders: orders.length,
          assignedOrders: assignedOrders.length,
          unassignedOrders: unassignedOrders.length,
          availableUsers: availableUsers.length,
          assignmentRate: orders.length > 0 ? (assignedOrders.length / orders.length * 100).toFixed(1) : 0
        },
        userStats,
        unassignedOrders: unassignedOrders.map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          priority: o.priority || 'normal',
          createdAt: o.createdAt,
          customerName: o.customer?.name || 'Unknown'
        }))
      });
      
    } catch (error) {
      console.error('❌ Error fetching assignment stats:', error);
      res.status(500).json({ error: 'Failed to fetch assignment statistics' });
    }
  });
      


  // ================================
  // REGISTRATION FLOW ROUTES
  // ================================

  router.get('/registration-flows', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const tenantStorage = await getTenantStorageForUser(user);
      const flows = await tenantStorage.getAllRegistrationFlows();
      res.json(flows);
    } catch (error) {
      console.error("Error getting registration flows:", error);
      res.status(500).json({ error: "Failed to fetch registration flows" });
    }
  });

  router.get('/registration-flows/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const flow = await tenantStorage.getRegistrationFlowById(id);
      
      if (!flow) {
        return res.status(404).json({ error: 'Registration flow not found' });
      }
      
      res.json(flow);
    } catch (error) {
      console.error("Error getting registration flow:", error);
      res.status(500).json({ error: "Failed to fetch registration flow" });
    }
  });

  router.post('/registration-flows', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const flowData = { ...req.body, storeId: user.storeId };
      
      const tenantStorage = await getTenantStorageForUser(user);
      const flow = await tenantStorage.createRegistrationFlow(flowData);
      res.status(201).json(flow);
    } catch (error) {
      console.error("Error creating registration flow:", error);
      res.status(500).json({ error: "Failed to create registration flow" });
    }
  });

  router.put('/registration-flows/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const flow = await tenantStorage.updateRegistrationFlow(id, req.body);
      
      if (!flow) {
        return res.status(404).json({ error: 'Registration flow not found' });
      }
      
      res.json(flow);
    } catch (error) {
      console.error("Error updating registration flow:", error);
      res.status(500).json({ error: "Failed to update registration flow" });
    }
  });

  router.delete('/registration-flows/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      await tenantStorage.deleteRegistrationFlow(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting registration flow:", error);
      res.status(500).json({ error: "Failed to delete registration flow" });
    }
  });

  // ================================
  // USER MANAGEMENT ROUTES (TENANT LEVEL)
  // ================================

  router.get('/users', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const tenantStorage = await getTenantStorageForUser(user);
      const users = await tenantStorage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  router.post('/users', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const userData = { ...req.body, storeId: user.storeId };
      
      // Para crear usuarios de tienda, usar master storage
      const newUser = await masterStorage.createStoreUser(userData);
      res.status(201).json(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  router.get('/users/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const targetUser = await tenantStorage.getUserById(id);
      
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(targetUser);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  router.put('/users/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const updatedUser = await tenantStorage.updateUser(id, req.body);
      
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  router.patch('/users/:id/status', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = z.object({ status: z.string() }).parse(req.body);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const updatedUser = await tenantStorage.updateUser(id, { status });
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid status data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  // ================================
  // NOTIFICATION ROUTES
  // ================================

  router.get("/notifications/count/:userId", authenticateToken, async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const counts = await tenantStorage.getNotificationCounts(parseInt(userId));
      
      res.json(counts);
    } catch (error) {
      console.error("Error fetching notification counts:", error);
      res.status(500).json({ error: "Failed to fetch notification counts" });
    }
  });

router.get("/notifications/:userId", authenticateToken, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const user = req.user as AuthUser;
    
    const tenantStorage = await getTenantStorageForUser(user);
    
    // Usar getUserNotifications en lugar de getNotifications
    const allNotifications = await tenantStorage.getUserNotifications(parseInt(userId));
    
    // Aplicar paginación manualmente
    const startIndex = parseInt(offset as string);
    const endIndex = startIndex + parseInt(limit as string);
    const notifications = allNotifications.slice(startIndex, endIndex);
    
    res.json({
      notifications,
      pagination: {
        total: allNotifications.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: endIndex < allNotifications.length
      }
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

  router.post("/notifications", authenticateToken, async (req: any, res: any) => {
    try {
      const notificationData = insertNotificationSchema.parse(req.body);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const notification = await tenantStorage.createNotification(notificationData);
      
      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid notification data", details: error.errors });
      }
      console.error("Error creating notification:", error);
      res.status(500).json({ error: "Failed to create notification" });
    }
  });

  router.put("/notifications/:id/read", authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const notification = await tenantStorage.markNotificationAsRead(id);
      
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  router.put("/notifications/read-all", authenticateToken, async (req: any, res: any) => {
    try {
      const userId = req.body.userId;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      
      const user = req.user as AuthUser;
      const tenantStorage = await getTenantStorageForUser(user);
      await tenantStorage.markAllNotificationsAsRead(parseInt(userId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark notifications as read" });
    }
  });

  // ================================
  // WHATSAPP CONFIGURATION ROUTES
  // ================================

  router.get("/whatsapp-config", authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      
      // WhatsApp config se almacena en master storage (configuración global por tienda)
      const config = await masterStorage.getWhatsAppConfig(user.storeId);
      
      res.json(config);
    } catch (error) {
      console.error("Error fetching WhatsApp config:", error);
      res.status(500).json({ error: "Failed to fetch WhatsApp config" });
    }
  });

  router.put("/whatsapp-config", authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const configData = { ...req.body, storeId: user.storeId };
      
      // WhatsApp config se almacena en master storage
      const config = await masterStorage.updateWhatsAppConfig(user.storeId, configData);
      
      res.json(config);
    } catch (error) {
      console.error("Error updating WhatsApp config:", error);
      res.status(500).json({ error: "Failed to update WhatsApp config" });
    }
  });

  // ================================
  // WHATSAPP LOG ROUTES
  // ================================

  router.get("/whatsapp-logs", authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const { phoneNumberId, limit = 50, offset = 0 } = req.query;
      
      // WhatsApp logs en master storage (centralizados)
      const logs = await masterStorage.getWhatsAppLogs(
        user.storeId,
        phoneNumberId as string,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching WhatsApp logs:", error);
      res.status(500).json({ error: "Failed to fetch WhatsApp logs" });
    }
  });

  router.post("/whatsapp-logs", authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const logData = { ...req.body, storeId: user.storeId };
      
      // WhatsApp logs en master storage
      const log = await masterStorage.addWhatsAppLog(logData);
      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating WhatsApp log:", error);
      res.status(500).json({ error: "Failed to create WhatsApp log" });
    }
  });

  // ================================
  // AUTO-RESPONSE ROUTES
  // ================================

  router.get('/auto-responses', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const tenantStorage = await getTenantStorageForUser(user);
      const autoResponses = await tenantStorage.getAllAutoResponses();
      res.json(autoResponses);
    } catch (error) {
      console.error('Error fetching auto-responses:', error);
      res.status(500).json({ error: 'Failed to fetch auto-responses' });
    }
  });

  router.get('/auto-responses/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const autoResponse = await tenantStorage.getAutoResponseById(id);
      
      if (!autoResponse) {
        return res.status(404).json({ error: 'Auto-response not found' });
      }
      
      res.json(autoResponse);
    } catch (error) {
      console.error('Error fetching auto-response:', error);
      res.status(500).json({ error: 'Failed to fetch auto-response' });
    }
  });

  router.post('/auto-responses', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const autoResponseData = { ...req.body, storeId: user.storeId };
      
      const tenantStorage = await getTenantStorageForUser(user);
      const autoResponse = await tenantStorage.createAutoResponse(autoResponseData);
      res.status(201).json(autoResponse);
    } catch (error) {
      console.error('Error creating auto-response:', error);
      res.status(500).json({ error: 'Failed to create auto-response' });
    }
  });

  router.put('/auto-responses/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const autoResponse = await tenantStorage.updateAutoResponse(id, req.body);
      
      if (!autoResponse) {
        return res.status(404).json({ error: 'Auto-response not found' });
      }
      
      res.json(autoResponse);
    } catch (error) {
      console.error('Error updating auto-response:', error);
      res.status(500).json({ error: 'Failed to update auto-response' });
    }
  });

  router.delete('/auto-responses/:id', authenticateToken, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.user as AuthUser;
      
      const tenantStorage = await getTenantStorageForUser(user);
      await tenantStorage.deleteAutoResponse(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting auto-response:', error);
      res.status(500).json({ error: 'Failed to delete auto-response' });
    }
  });

  // ================================
  // IMAGE HANDLING ROUTES
  // ================================

  router.post('/validate-image-url', authenticateToken, validateImageUrlHandler);
  
  router.post('/upload-image', authenticateToken, (req: any, res: any, next: any) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) return res.status(400).json({ error: err.message });
      uploadImageHandler(req, res);
    });
  });

  router.post('/process-image-url', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const { imageUrl } = req.body;
      
      const processedUrls = await processProductImages([], [imageUrl], user.storeId!);
      
      res.json({
        success: true,
        imageUrl: processedUrls[0] || imageUrl,
        originalUrl: imageUrl,
        message: 'URL procesada exitosamente'
      });
    } catch (error) {
      console.error('Error processing image URL:', error);
      res.status(500).json({ 
        error: 'Failed to process image URL',
        message: (error as Error).message 
      });
    }
  });

  // ================================
  // STORE/SCHEMA STATUS ROUTES
  // ================================

  router.get('/store/schema-status', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      
      const store = await masterStorage.getVirtualStore(user.storeId);
      
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
      
      const schemaMatch = store.databaseUrl?.match(/schema=([^&]+)/);
      const hasSchema = !!schemaMatch;
      const schemaName = schemaMatch ? schemaMatch[1] : null;
      
      let tenantConnectionValid = false;
      try {
        const tenantStorage = await getTenantStorageForUser(user);
        await tenantStorage.getAllProducts();
        tenantConnectionValid = true;
      } catch (error) {
        console.error('Tenant connection test failed:', error);
      }
      
      res.json({
        storeId: user.storeId,
        storeName: store.name,
        hasSchema,
        schemaName,
        tenantConnectionValid,
        status: hasSchema && tenantConnectionValid ? 'ready' : 'needs_migration',
        databaseUrl: store.databaseUrl
      });
    } catch (error) {
      console.error('Error checking schema status:', error);
      res.status(500).json({ error: 'Failed to check schema status' });
    }
  });

  // ================================
// STORE-SPECIFIC USER ROUTES
// ================================

// POST - Crear usuario para una tienda específica
router.post('/stores/:storeId/users', authenticateToken, async (req: any, res: any) => {
  try {
    const storeId = parseInt(req.params.storeId);
    const user = req.user as AuthUser;
    
    // Verificar permisos: solo super_admin o admin de la misma tienda
    if (user.role !== 'super_admin' && user.storeId !== storeId) {
      return res.status(403).json({ error: 'Not authorized to create users for this store' });
    }
    
    // Verificar que la tienda existe
    const store = await masterStorage.getVirtualStore(storeId);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    const userData = { 
      ...req.body, 
      storeId: storeId,
      level: 'store' // Asegurarmos que es un usuario de tienda
    };
    
    // Validar datos requeridos
    if (!userData.username || !userData.password || !userData.role) {
      return res.status(400).json({ 
        error: 'Missing required fields: username, password, role' 
      });
    }
    
    // Hash de la contraseña si no viene hasheada
    if (userData.password && !userData.password.startsWith('$2')) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }
    
    // Crear usuario usando master storage
    const newUser = await masterStorage.createStoreUser(userData);
    
    // Remover contraseña de la respuesta
    const { password, ...safeUser } = newUser;
    
    console.log(`✅ User created for store ${storeId}: ${newUser.username}`);
    res.status(201).json(safeUser);
    
  } catch (error) {
    console.error("Error creating user for store:", error);
    
    if (error instanceof Error && error.message?.includes('already exists')) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    res.status(500).json({ error: "Failed to create user" });
  }
});

// GET - Listar usuarios de una tienda específica
router.get('/stores/:storeId/users', authenticateToken, async (req: any, res: any) => {
  try {
    const storeId = parseInt(req.params.storeId);
    const user = req.user as AuthUser;
    
    // Verificar permisos
    if (user.role !== 'super_admin' && user.storeId !== storeId) {
      return res.status(403).json({ error: 'Not authorized to view users for this store' });
    }
    
    // Obtener usuarios de la tienda usando master storage
    const users = await masterStorage.getStoreUsers(storeId);
    
    // Remover contraseñas de la respuesta
    const safeUsers = users.map(user => {
      const { password, ...safeUser } = user;
      return safeUser;
    });
    
    res.json(safeUsers);
    
  } catch (error) {
    console.error("Error fetching store users:", error);
    res.status(500).json({ error: "Failed to fetch store users" });
  }
});

// PUT - Actualizar usuario de una tienda específica
router.put('/stores/:storeId/users/:userId', authenticateToken, async (req: any, res: any) => {
  try {
    const storeId = parseInt(req.params.storeId);
    const userId = parseInt(req.params.userId);
    const user = req.user as AuthUser;
    
    // Verificar permisos
    if (user.role !== 'super_admin' && user.storeId !== storeId) {
      return res.status(403).json({ error: 'Not authorized to update users for this store' });
    }
    
    const updateData = req.body;
    
    // Hash contraseña si se está actualizando
    if (updateData.password && !updateData.password.startsWith('$2')) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    // Actualizar usuario usando master storage
    const updatedUser = await masterStorage.updateStoreUser(userId, updateData, storeId);
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remover contraseña de la respuesta
    const { password, ...safeUser } = updatedUser;
    
    res.json(safeUser);
    
  } catch (error) {
    console.error("Error updating store user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE - Eliminar usuario de una tienda específica
router.delete('/stores/:storeId/users/:userId', authenticateToken, async (req: any, res: any) => {
  try {
    const storeId = parseInt(req.params.storeId);
    const userId = parseInt(req.params.userId);
    const user = req.user as AuthUser;
    
    // Verificar permisos
    if (user.role !== 'super_admin' && user.storeId !== storeId) {
      return res.status(403).json({ error: 'Not authorized to delete users for this store' });
    }
    
    // No permitir que se elimine a sí mismo
    if (user.id === userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const success = await masterStorage.deleteStoreUser(userId, storeId);
    
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, message: 'User deleted successfully' });
    
  } catch (error) {
    console.error("Error deleting store user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

  // ================================
  // REPORTS/ANALYTICS ROUTES
  // ================================

  router.get('/reports', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const { type, startDate, endDate } = req.query;
      
      const tenantStorage = await getTenantStorageForUser(user);
      const reports = await tenantStorage.getReports({
        type: type as string,
        startDate: startDate as string,
        endDate: endDate as string
      });
      
      res.json(reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  });

  router.get('/reports/dashboard', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      const tenantStorage = await getTenantStorageForUser(user);
      
      const dashboardData = await tenantStorage.getDashboardMetrics();
      res.json(dashboardData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  // ================================
  // TESTING ROUTES
  // ================================

  router.post('/test/simulate-webhook/:storeId', async (req: any, res: any) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const { phoneNumber = '18494553242', messageText = 'Hola' } = req.body;
      
      console.log(`🎭 SIMULATING MESSAGE WEBHOOK - Store: ${storeId}, Phone: ${phoneNumber}, Message: "${messageText}"`);
      
      const whatsappConfig = await masterStorage.getWhatsAppConfig(storeId);
      
      if (!whatsappConfig) {
        return res.json({
          success: false,
          error: "No WhatsApp config found - Cannot simulate webhook"
        });
      }
      
      const simulatedWebhook = {
        object: "whatsapp_business_account",
        entry: [{
          id: "TEST_BUSINESS_ACCOUNT_ID",
          changes: [{
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: whatsappConfig.phoneNumberId,
                phone_number_id: whatsappConfig.phoneNumberId
              },
              messages: [{
                from: phoneNumber,
                id: `test_${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                text: {
                  body: messageText
                },
                type: "text"
              }]
            },
            field: "messages"
          }]
        }]
      };
      
      console.log(`📤 PROCESSING SIMULATED WEBHOOK...`);
      
      await processWhatsAppMessage(simulatedWebhook);
      
      console.log(`✅ WEBHOOK SIMULATION COMPLETED`);
      
      res.json({
        success: true,
        message: "Webhook simulado exitosamente",
        details: {
          storeId,
          phoneNumber,
          messageText,
          phoneNumberId: whatsappConfig.phoneNumberId
        }
      });
      
    } catch (error) {
      console.error('❌ ERROR SIMULATING WEBHOOK:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ================================
  // HEALTH CHECK ROUTES
  // ================================

  router.get('/health', async (req: any, res: any) => {
    try {
      const healthStatus = await healthCheck();
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        storage: healthStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  router.get('/health/storage', authenticateToken, async (req: any, res: any) => {
    try {
      const user = req.user as AuthUser;
      
      // Test master storage
      const masterHealth = await masterStorage.testConnection();
      
      // Test tenant storage if user has storeId
      let tenantHealth = null;
      if (user.storeId) {
        try {
          const tenantStorage = await getTenantStorageForUser(user);
          tenantHealth = await tenantStorage.testConnection();
        } catch (error) {
          tenantHealth = { 
            connected: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      }
      
      res.json({
        master: masterHealth,
        tenant: tenantHealth,
        storeId: user.storeId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Storage health check failed:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // ================================
  // SUPER ADMIN ROUTES (GLOBAL OPERATIONS)
  // ================================

  router.get('/super-admin/stores', authenticateToken, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const stores = await masterStorage.getAllVirtualStores();
      res.json(stores);
    } catch (error) {
      console.error('Error fetching stores:', error);
      res.status(500).json({ error: 'Failed to fetch stores' });
    }
  });

  router.post('/super-admin/stores', authenticateToken, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const storeData = req.body;
      const store = await masterStorage.createVirtualStore(storeData);
      res.status(201).json(store);
    } catch (error) {
      console.error('Error creating store:', error);
      res.status(500).json({ error: 'Failed to create store' });
    }
  });

  router.put('/super-admin/stores/:id', authenticateToken, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      const store = await masterStorage.updateVirtualStore(id, updateData);
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
      
      res.json(store);
    } catch (error) {
      console.error('Error updating store:', error);
      res.status(500).json({ error: 'Failed to update store' });
    }
  });

  router.delete('/super-admin/stores/:id', authenticateToken, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      
      await masterStorage.deleteVirtualStore(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting store:', error);
      res.status(500).json({ error: 'Failed to delete store' });
    }
  });

  // Migración de esquemas
  router.post('/super-admin/stores/:id/migrate-schema', authenticateToken, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { migrateStoreToSeparateSchema } = await import('./schema-migration');
      const storeId = parseInt(req.params.id);
      const result = await migrateStoreToSeparateSchema(storeId);
      res.json(result);
    } catch (error) {
      console.error('Error during schema migration:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Métricas del sistema
  router.get('/super-admin/metrics', authenticateToken, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const stores = await masterDb.select().from(schema.virtualStores);
      const users = await masterDb.select().from(schema.systemUsers);
      
      const totalStores = stores.length;
      const activeStores = stores.filter(store => store.isActive).length;
      const totalUsers = users.length;
      
      const [totalOrdersResult] = await masterDb
        .select({ count: sql<number>`count(*)` })
        .from(schema.orders);
      
      const [todayOrdersResult] = await masterDb
        .select({ count: sql<number>`count(*)` })
        .from(schema.orders)
        .where(sql`DATE(${schema.orders.createdAt}) = DATE(${new Date().toISOString()})`);
      
      const [totalMessagesResult] = await masterDb
        .select({ count: sql<number>`count(*)` })
        .from(schema.messages);
      
      const [revenueResult] = await masterDb
        .select({ total: sql<number>`COALESCE(SUM(CAST(${schema.orders.totalAmount} AS DECIMAL)), 0)` })
        .from(schema.orders)
        .where(eq(schema.orders.status, 'completed'));
      
      const metrics = {
        totalStores,
        activeStores,
        totalUsers,
        totalOrders: totalOrdersResult?.count || 0,
        ordersToday: todayOrdersResult?.count || 0,
        totalRevenue: Number(revenueResult?.total || 0).toFixed(2),
        totalMessages: totalMessagesResult?.count || 0,
        storageUsed: "N/A",
        systemStatus: "healthy" as const
      };

      res.json(metrics);
    } catch (error) {
      console.error('Error fetching super admin metrics:', error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });

  // Capacidad del sistema
  router.get('/super-admin/capacity', authenticateToken, requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { calculateStoreCapacity, validateCapacityForNewStores } = await import('./schema-migration');
      const capacity = calculateStoreCapacity();
      const newStoresParam = req.query.newStores;
      const newStores = newStoresParam ? parseInt(newStoresParam as string) : 0;
      const validation = validateCapacityForNewStores(newStores);
      
      res.json({
        capacity,
        validation: newStores > 0 ? validation : null
      });
    } catch (error) {
      console.error('Error calculating capacity:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ================================
  // STATIC FILE SERVING
  // ================================

  router.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // ================================
  // ERROR HANDLING MIDDLEWARE
  // ================================

  router.use((error: any, req: any, res: any, next: any) => {
    console.error('Route error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    
    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
      return res.status(400).json({
        error: 'Duplicate entry',
        message: error.message
      });
    }
    
    if (error.message?.includes('foreign key') || error.message?.includes('constraint')) {
      return res.status(400).json({
        error: 'Constraint violation',
        message: 'Cannot complete operation due to existing dependencies'
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  });

  // ================================
  // MOUNT ROUTER ON APP
  // ================================

  app.use("/api", router);
  
  console.log("✅ Routes registered successfully with migrated storage");
}

// ================================
// ADDITIONAL ROUTE REGISTRATION FUNCTIONS
// ================================

export async function registerUserManagementRoutes(app: express.Application) {
  // Setup user management routes
  setupUserManagementRoutes(app);
  console.log("✅ User management routes registered");
}

export async function registerGlobalRoutes(app: express.Application) {
  // Global/system routes that don't require tenant context
  
  app.get("/api/super-admin/subscriptions", authenticateToken, requireSuperAdmin, (req, res) => {
    res.json([]);
  });

  app.get("/api/super-admin/subscription-metrics", authenticateToken, requireSuperAdmin, (req, res) => {
    res.json({
      total: 0,
      active: 0,
      expired: 0
    });
  });

  // Debug endpoints
  app.get('/api/debug/supabase', async (req, res) => {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      const result = {
        status: 'debug',
        timestamp: new Date().toISOString(),
        config: {
          hasUrl: !!supabaseUrl,
          hasServiceKey: !!serviceKey,
          urlPreview: supabaseUrl ? supabaseUrl.substring(0, 50) + '...' : null
        },
        message: 'Supabase configuration debug'
      };

      res.json(result);
    } catch (error) {
      console.error('Supabase debug error:', error);
      res.json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  console.log("✅ Global routes registered");
}

// ================================
// EXPORT DEFAULT
// ================================

export default registerRoutes;