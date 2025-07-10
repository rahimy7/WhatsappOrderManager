// Configuración CORS para Railway
import cors from 'cors';

const setupCorsForRailway = (app: any) => {
  // Crear array de origins filtrado sin undefined
  const origins: (string | RegExp)[] = [
    // URLs de desarrollo local
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'https://whatsapp2-production-e205.up.railway.app',
    // Regex para dominios de Railway
    /^https:\/\/.*\.railway\.app$/,
  ];

  // Agregar URLs de Railway si existen
  if (process.env.RAILWAY_STATIC_URL) {
    origins.push(process.env.RAILWAY_STATIC_URL);
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    origins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }

  const corsOptions = {
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Origin'
    ],
    credentials: true,
    optionsSuccessStatus: 200,
    preflightContinue: false,
  };

  // Aplicar CORS
  app.use(cors(corsOptions));

  // Middleware adicional para Railway
  app.use((req: any, res: any, next: any) => {
    // Log para debugging en Railway
    if (process.env.NODE_ENV === 'production') {
      console.log(`CORS Request: ${req.method} ${req.path} from ${req.headers.origin}`);
    }
    
    next();
  });
};

export default setupCorsForRailway;