// fix-product-validation.mjs
// Script para diagnosticar y corregir la validación de productos

import fs from 'fs';
import path from 'path';

console.log('🔧 DIAGNOSTICANDO VALIDACIÓN DE PRODUCTOS...\n');

function createBackup(filePath) {
  const backupPath = filePath + '.product-validation-backup.' + Date.now();
  if (fs.existsSync(filePath)) {
    try {
      fs.copyFileSync(filePath, backupPath);
      console.log(`📦 Backup creado: ${backupPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Error creando backup: ${error.message}`);
      return false;
    }
  }
  return false;
}

async function fixProductValidation() {
  try {
    console.log('🚀 Iniciando diagnóstico de validación de productos...\n');

    // 1. Verificar la ruta POST /api/products en index.ts
    const indexPath = path.join(process.cwd(), 'server/index.ts');
    console.log(`📍 Verificando ruta POST /api/products en: ${indexPath}`);
    
    if (!fs.existsSync(indexPath)) {
      console.log('❌ server/index.ts no encontrado');
      return;
    }

    let indexContent = fs.readFileSync(indexPath, 'utf8');
    console.log('✅ Archivo index.ts encontrado');

    // Buscar la ruta POST /api/products
    const productRouteRegex = /app\.post\(['"`]\/api\/products['"`][^}]*\}/s;
    const productRouteMatch = indexContent.match(productRouteRegex);

    if (!productRouteMatch) {
      console.log('❌ Ruta POST /api/products no encontrada en index.ts');
      return;
    }

    console.log('✅ Ruta POST /api/products encontrada');
    console.log('\n📋 CONTENIDO ACTUAL DE LA RUTA:');
    console.log(productRouteMatch[0].substring(0, 500) + '...');

    // Verificar si hay logging de req.body
    if (!productRouteMatch[0].includes('console.log') || !productRouteMatch[0].includes('req.body')) {
      console.log('\n⚠️ Falta logging de req.body para debugging');
      
      createBackup(indexPath);

      // Agregar logging mejorado a la ruta
      const improvedProductRoute = `app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 POST /api/products called');
    console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
    console.log('📋 Request body keys:', Object.keys(req.body));
    
    const user = (req as any).user;
    console.log('📋 User info:', { id: user.id, storeId: user.storeId });
    
    // Validar que req.body existe y tiene datos
    if (!req.body || Object.keys(req.body).length === 0) {
      console.log('❌ Request body is empty');
      return res.status(400).json({ 
        error: 'Request body is required',
        received: req.body 
      });
    }

    // Validar campo name específicamente
    if (!req.body.name || req.body.name.trim() === '') {
      console.log('❌ Product name is missing or empty');
      console.log('📋 Received name field:', req.body.name);
      return res.status(400).json({ 
        error: 'Product name is required',
        received: {
          name: req.body.name,
          hasName: 'name' in req.body,
          nameType: typeof req.body.name,
          allFields: Object.keys(req.body)
        }
      });
    }

    console.log('✅ Validation passed, creating product...');
    
    const tenantStorage = await getTenantStorageForUser(user);
    const { items, ...rest } = req.body;

    // Preparar datos del producto con valores por defecto
    const productData = {
      name: req.body.name.trim(),
      description: req.body.description || '',
      price: req.body.price || '0.00',
      category: req.body.category || 'general',
      status: req.body.status || 'active',
      imageUrl: req.body.imageUrl || null,
      images: req.body.images || null,
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
      promotionText: req.body.promotionText || null
    };

    console.log('📋 Processed product data:', JSON.stringify(productData, null, 2));

    const product = await tenantStorage.createProduct(productData);
    
    console.log('✅ Product created successfully:', product);
    res.status(201).json(product);
    
  } catch (error) {
    console.error('❌ Error creating product:', error);
    res.status(500).json({ 
      error: 'Failed to create product',
      message: error.message,
      details: error.stack
    });
  }
})`;

      // Reemplazar la ruta existente
      indexContent = indexContent.replace(productRouteRegex, improvedProductRoute);
      
      fs.writeFileSync(indexPath, indexContent);
      console.log('✅ Ruta POST /api/products mejorada con validación y logging');
    } else {
      console.log('✅ La ruta ya tiene logging');
    }

    // 2. Verificar configuración de Express para parsear JSON
    if (!indexContent.includes('express.json()')) {
      console.log('\n⚠️ Falta configuración de express.json() middleware');
      
      // Buscar donde está la configuración de middlewares
      const appDeclarationIndex = indexContent.indexOf('const app = express()');
      if (appDeclarationIndex !== -1) {
        const insertionPoint = indexContent.indexOf('\n', appDeclarationIndex);
        const middlewareConfig = `
// ✅ CORS y parsing middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
`;
        
        indexContent = 
          indexContent.slice(0, insertionPoint) + 
          middlewareConfig + 
          indexContent.slice(insertionPoint);
        
        fs.writeFileSync(indexPath, indexContent);
        console.log('✅ Middleware express.json() agregado');
      }
    } else {
      console.log('✅ Middleware express.json() ya configurado');
    }

    // 3. Crear un endpoint de test para debugging
    if (!indexContent.includes('/api/test-product-data')) {
      console.log('\n➕ Agregando endpoint de test para debugging...');
      
      const testEndpoint = `
// ✅ ENDPOINT DE TEST PARA DEBUGGING
app.post('/api/test-product-data', express.json(), (req, res) => {
  console.log('🧪 TEST ENDPOINT - Raw body:', req.body);
  console.log('🧪 TEST ENDPOINT - Headers:', req.headers);
  console.log('🧪 TEST ENDPOINT - Content-Type:', req.get('Content-Type'));
  
  res.json({
    success: true,
    received: {
      body: req.body,
      bodyType: typeof req.body,
      bodyKeys: Object.keys(req.body || {}),
      hasName: 'name' in (req.body || {}),
      nameValue: req.body?.name,
      nameType: typeof req.body?.name,
      contentType: req.get('Content-Type')
    }
  });
});
`;
      
      // Insertar antes de la configuración del servidor
      const serverStartIndex = indexContent.indexOf('server.listen');
      if (serverStartIndex !== -1) {
        indexContent = 
          indexContent.slice(0, serverStartIndex) + 
          testEndpoint + 
          '\n' + 
          indexContent.slice(serverStartIndex);
        
        fs.writeFileSync(indexPath, indexContent);
        console.log('✅ Endpoint de test agregado: POST /api/test-product-data');
      }
    }

    console.log('\n🎉 CORRECCIÓN DE VALIDACIÓN COMPLETADA!');
    console.log('\n📋 MEJORAS APLICADAS:');
    console.log('✅ Logging detallado de req.body');
    console.log('✅ Validación específica del campo name');
    console.log('✅ Mensajes de error informativos');
    console.log('✅ Middleware express.json() configurado');
    console.log('✅ Endpoint de test para debugging');

    console.log('\n📋 PRÓXIMOS PASOS PARA DEBUGGING:');
    console.log('1. Reinicia el servidor: yarn dev');
    console.log('2. En el frontend, envía datos de test a: POST /api/test-product-data');
    console.log('3. Revisa los logs del servidor para ver qué datos llegan');
    console.log('4. Asegúrate de que el frontend envíe Content-Type: application/json');
    console.log('5. Verifica que el frontend envíe al menos { "name": "Producto Test" }');

    console.log('\n🧪 PARA PROBAR CON CURL:');
    console.log(`curl -X POST http://localhost:5000/api/test-product-data \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Test Product","description":"Test description"}'`);

  } catch (error) {
    console.error('❌ Error corrigiendo validación:', error.message);
  }
}

// Ejecutar la corrección
console.log('🔧 SCRIPT DE CORRECCIÓN DE VALIDACIÓN INICIADO\n');
fixProductValidation();