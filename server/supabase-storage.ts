// supabase-storage.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente con service role para operaciones del servidor
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Cliente para el frontend
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export class SupabaseStorageManager {
  private bucket = 'products'; // Nombre del bucket para productos
  
  constructor(private storeId: number) {}

// supabase-storage.ts
async uploadFile(file: File, productId?: number): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${this.storeId}/${productId ?? 'temp'}/${Date.now()}.${fileExt}`;

  /** 👇 fallback elegante si File.type está vacío */
  const safeType =
    file.type && file.type.trim() !== ''
      ? file.type
      : this.getMimeFromExt(fileExt) ?? 'application/octet-stream';

  const { data, error } = await supabaseAdmin.storage
    .from(this.bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: safeType                 // ← obligatorio
    });

  if (error) throw new Error(`Error uploading file: ${error.message}`);

  return this.getPublicUrl(data.path);
}

/** Nuevo helper */
private getMimeFromExt(ext: string | undefined) {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp'
  };
  return ext ? map[ext.toLowerCase()] : undefined;
}

  /**
   * Sube imagen desde URL
   */
  async uploadFromUrl(imageUrl: string, productId?: number): Promise<string> {
    try {
      // Descargar la imagen
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('No se pudo descargar la imagen desde la URL');
      }

      const blob = await response.blob();
      
      // Validar tipo de archivo
      if (!blob.type.startsWith('image/')) {
        throw new Error('La URL no apunta a una imagen válida');
      }

      // Validar tamaño (5MB máximo)
      if (blob.size > 5 * 1024 * 1024) {
        throw new Error('La imagen es muy grande (máximo 5MB)');
      }

      // Crear archivo desde blob
      const fileExt = this.getFileExtensionFromContentType(blob.type);
      const fileName = `${this.storeId}/${productId || 'temp'}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabaseAdmin.storage
        .from(this.bucket)
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: blob.type
        });

      if (error) {
        throw new Error(`Error uploading from URL: ${error.message}`);
      }

      return this.getPublicUrl(data.path);
    } catch (error) {
      throw new Error(`Error procesando URL: ${(error as Error).message}`);
    }
  }

  /**
   * Obtiene URL pública del archivo
   */
  getPublicUrl(path: string): string {
    const { data } = supabaseAdmin.storage
      .from(this.bucket)
      .getPublicUrl(path);
    
    return data.publicUrl;
  }

  /**
   * Elimina archivo de Supabase Storage
   */
  async deleteFile(url: string): Promise<boolean> {
    try {
      // Extraer path desde la URL
      const path = this.extractPathFromUrl(url);
      
      const { error } = await supabaseAdmin.storage
        .from(this.bucket)
        .remove([path]);

      return !error;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  async uploadFromBuffer(
  buffer: Buffer, 
  originalName: string, 
  mimeType: string, 
  productId?: number
): Promise<string> {
  try {
    // Validar tipo de archivo
    if (!mimeType.startsWith('image/')) {
      throw new Error('El archivo no es una imagen válida');
    }

    // Validar tamaño (5MB máximo)
    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error('La imagen es muy grande (máximo 5MB)');
    }

    const fileExt = originalName.split('.').pop() || this.getFileExtensionFromContentType(mimeType);
    const fileName = `${this.storeId}/${productId || 'temp'}/${Date.now()}.${fileExt}`;

    console.log('🔄 Uploading to Supabase:', {
      fileName,
      size: buffer.length,
      type: mimeType
    });

    const { data, error } = await supabaseAdmin.storage
      .from(this.bucket)
      .upload(fileName, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: mimeType
      });

    if (error) {
      console.error('❌ Supabase upload error:', error);
      throw new Error(`Error uploading to Supabase: ${error.message}`);
    }

    const publicUrl = this.getPublicUrl(data.path);
    console.log('✅ Upload successful:', publicUrl);
    
    return publicUrl;

  } catch (error) {
    console.error('❌ Error in uploadFromBuffer:', error);
    throw new Error(`Error subiendo archivo: ${(error as Error).message}`);
  }
}

  /**
   * Elimina múltiples archivos
   */
  async deleteFiles(urls: string[]): Promise<void> {
    const paths = urls.map(url => this.extractPathFromUrl(url));
    
    const { error } = await supabaseAdmin.storage
      .from(this.bucket)
      .remove(paths);

    if (error) {
      throw new Error(`Error deleting files: ${error.message}`);
    }
  }

  /**
   * Mueve archivos temporales a la carpeta del producto
   */
  async moveTemporaryFiles(tempUrls: string[], productId: number): Promise<string[]> {
    const newUrls: string[] = [];

    for (const url of tempUrls) {
      try {
        const oldPath = this.extractPathFromUrl(url);
        const fileExt = oldPath.split('.').pop();
        const newPath = `${this.storeId}/${productId}/${Date.now()}.${fileExt}`;

        // Mover archivo
        const { data, error } = await supabaseAdmin.storage
          .from(this.bucket)
          .move(oldPath, newPath);

        if (error) {
          console.error('Error moving file:', error);
          // Si no se puede mover, mantener la URL original
          newUrls.push(url);
        } else {
          newUrls.push(this.getPublicUrl(newPath));
        }
      } catch (error) {
        console.error('Error processing file move:', error);
        newUrls.push(url);
      }
    }

    return newUrls;
  }

  private extractPathFromUrl(url: string): string {
    // Extraer el path desde la URL de Supabase
    const urlParts = url.split('/storage/v1/object/public/');
    if (urlParts.length > 1) {
      return urlParts[1].replace(`${this.bucket}/`, '');
    }
    throw new Error('Invalid Supabase storage URL');
  }

  private getFileExtensionFromContentType(contentType: string): string {
    const map: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    return map[contentType] || 'jpg';
  }
}

// Configuración del bucket
export async function initializeStorageBucket() {
  try {
    // Crear bucket si no existe
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === 'products');

    if (!bucketExists) {
      const { error } = await supabaseAdmin.storage.createBucket('products', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      });

      if (error) {
        console.error('Error creating bucket:', error);
      } else {
        console.log('Products bucket created successfully');
      }
    }

    // Configurar políticas RLS
    await setupStoragePolicies();
  } catch (error) {
    console.error('Error initializing storage bucket:', error);
  }
}

async function setupStoragePolicies() {
  // Políticas para permitir acceso público de lectura
  // y escritura autenticada por storeId
  
  const policies = [
    {
      name: 'Public read access',
      sql: `
        CREATE POLICY "Public read access" ON storage.objects
        FOR SELECT USING (bucket_id = 'products');
      `
    },
    {
      name: 'Store upload access',
      sql: `
        CREATE POLICY "Store upload access" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'products');
      `
    },
    {
      name: 'Store delete access',
      sql: `
        CREATE POLICY "Store delete access" ON storage.objects
        FOR DELETE USING (bucket_id = 'products');
      `
    }
  ];

  // Aplicar políticas (esto normalmente se hace via SQL en Supabase Dashboard)
  console.log('Storage policies to apply:', policies);
}