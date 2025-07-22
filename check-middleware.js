// check-middleware.js
// Script para verificar la configuración del middleware de parsing

import express from 'express';

// Crear una instancia de Express para testing
const app = express();

console.log('🔍 Verificando configuración de middleware...');

// Middleware de debugging
app.use((req, res, next) => {
    console.log('\n🌐 Incoming Request:');
    console.log('  Method:', req.method);
    console.log('  URL:', req.url);
    console.log('  Headers:', JSON.stringify(req.headers, null, 2));
    console.log('  Content-Type:', req.get('Content-Type'));
    next();
});

// Middleware de logging del cuerpo antes del parsing
app.use((req, res, next) => {
    let rawBody = '';
    
    req.on('data', chunk => {
        rawBody += chunk.toString();
    });
    
    req.on('end', () => {
        console.log('📦 Raw Body (before parsing):', rawBody.substring(0, 500));
        console.log('📏 Raw Body Length:', rawBody.length);
    });
    
    next();
});

// Middleware de parsing (CRÍTICO)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware de debugging después del parsing
app.use((req, res, next) => {
    console.log('\n📋 Parsed Body:');
    console.log('  Body type:', typeof req.body);
    console.log('  Body keys:', Object.keys(req.body || {}));
    console.log('  Body content:', JSON.stringify(req.body, null, 2));
    next();
});

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Endpoint de test
app.post('/test/products', (req, res) => {
    console.log('\n✅ Endpoint reached!');
    console.log('📋 Final req.body:', JSON.stringify(req.body, null, 2));
    console.log('📋 Body keys:', Object.keys(req.body || {}));
    console.log('📋 Has name?', 'name' in (req.body || {}));
    console.log('📋 Name value:', req.body?.name);
    
    if (!req.body || Object.keys(req.body).length === 0) {
        console.log('❌ Body is empty or undefined');
        return res.status(400).json({
            error: 'Request body is empty',
            received: req.body,
            headers: req.headers
        });
    }
    
    if (!req.body.name) {
        console.log('❌ Name field is missing');
        return res.status(400).json({
            error: 'Name field is missing',
            receivedFields: Object.keys(req.body),
            body: req.body
        });
    }
    
    console.log('✅ All validations passed!');
    res.json({
        success: true,
        message: 'Product data received correctly',
        receivedData: req.body
    });
});

// Endpoint para verificar configuración
app.get('/test/config', (req, res) => {
    res.json({
        middleware: 'configured',
        parsers: ['json', 'urlencoded'],
        timestamp: new Date().toISOString()
    });
});

const PORT = 3001;

app.listen(PORT, () => {
    console.log(`\n🚀 Test server running on http://localhost:${PORT}`);
    console.log('\n📝 Para probar:');
    console.log('1. Abre http://localhost:3001/test/config para verificar que funciona');
    console.log('2. Usa el debug-form-submission.html y cambia la URL a http://localhost:3001/test/products');
    console.log('3. Prueba los diferentes métodos de envío');
    console.log('\n🔍 Observa los logs en la consola para diagnosticar el problema');
});

// Manejo de errores
app.use((error, req, res, next) => {
    console.error('💥 Error en middleware:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
    });
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});