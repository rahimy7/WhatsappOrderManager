// supabase-storage.ts - VERSIÓN CORREGIDA PARA IMÁGENES
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
  private bucket = 'products';
  
  constructor(private storeId: number) {}

  /**
   * ✅ CORREGIDO: Subida de archivo con Content-Type correcto
   */
  async uploadFile(file: File, productId?: number): Promise<string> {
    try {
      console.log('🔄 Starting file upload...', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      // Validar que es una imagen
      if (!this.isValidImageFile(file)) {
        throw new Error('El archivo no es una imagen válida');
      }

      // Validar tamaño (5MB máximo)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('La imagen es muy grande (máximo 5MB)');
      }

      // ✅ CORRECCIÓN CRÍTICA: Obtener extensión y Content-Type correctos
      const fileExtension = this.getFileExtension(file.name);
      const contentType = this.getCorrectContentType(file, fileExtension);
      
      console.log('📋 File details:', {
        extension: fileExtension,
        detectedContentType: contentType,
        originalType: file.type
      });

      // Generar nombre único con timestamp
      const fileName = `${this.storeId}/${productId || 'temp'}/${Date.now()}_${this.sanitizeFileName(file.name)}`;

      console.log('📁 Uploading to path:', fileName);

      // ✅ CORRECCIÓN: Convertir File a Buffer manteniendo la calidad
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // ✅ CORRECCIÓN: Upload con Content-Type específico y configuración optimizada
      const { data, error } = await supabaseAdmin.storage
        .from(this.bucket)
        .upload(fileName, buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: contentType, // ← CRÍTICO: Content-Type correcto
          duplex: 'half' // Mejora compatibilidad
        });

      if (error) {
        console.error('❌ Supabase upload error:', error);
        throw new Error(`Error uploading to Supabase: ${error.message}`);
      }

      const publicUrl = this.getPublicUrl(data.path);
      
      console.log('✅ Upload successful:', {
        path: data.path,
        publicUrl: publicUrl
      });
      
      return publicUrl;

    } catch (error) {
      console.error('❌ Error in uploadFile:', error);
      throw new Error(`Error subiendo archivo: ${(error as Error).message}`);
    }
  }

  /**
   * ✅ CORREGIDO: Upload desde buffer con Content-Type correcto
   */
  async uploadFromBuffer(
    buffer: Buffer, 
    originalName: string, 
    mimeType: string, 
    productId?: number
  ): Promise<string> {
    try {
      console.log('🔄 Starting buffer upload...', {
        name: originalName,
        size: buffer.length,
        type: mimeType
      });

      // Validar tipo de archivo
      if (!mimeType.startsWith('image/')) {
        throw new Error('El archivo no es una imagen válida');
      }

      // Validar tamaño (5MB máximo)
      if (buffer.length > 5 * 1024 * 1024) {
        throw new Error('La imagen es muy grande (máximo 5MB)');
      }

      const fileExtension = this.getFileExtension(originalName);
      const contentType = this.normalizeContentType(mimeType, fileExtension);
      
      console.log('📋 Buffer details:', {
        extension: fileExtension,
        contentType: contentType,
        originalMime: mimeType
      });

      const fileName = `${this.storeId}/${productId || 'temp'}/${Date.now()}_${this.sanitizeFileName(originalName)}`;

      // ✅ CORRECCIÓN: Upload optimizado para buffers
      const { data, error } = await supabaseAdmin.storage
        .from(this.bucket)
        .upload(fileName, buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: contentType // ← CRÍTICO: Content-Type normalizado
        });

      if (error) {
        console.error('❌ Supabase buffer upload error:', error);
        throw new Error(`Error uploading buffer to Supabase: ${error.message}`);
      }

      const publicUrl = this.getPublicUrl(data.path);
      console.log('✅ Buffer upload successful:', publicUrl);
      
      return publicUrl;

    } catch (error) {
      console.error('❌ Error in uploadFromBuffer:', error);
      throw new Error(`Error subiendo archivo: ${(error as Error).message}`);
    }
  }

  /**
   * ✅ CORREGIDO: Upload desde URL con validación de Content-Type
   */
  async uploadFromUrl(imageUrl: string, productId?: number): Promise<string> {
    try {
      console.log('🔄 Starting URL upload:', imageUrl);

      // Descargar la imagen
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`No se pudo descargar la imagen: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const blob = await response.blob();
      
      console.log('📋 Downloaded image:', {
        size: blob.size,
        type: blob.type,
        responseContentType: contentType
      });
      
      // Validar que es una imagen
      if (!contentType.startsWith('image/') && !blob.type.startsWith('image/')) {
        throw new Error('La URL no apunta a una imagen válida');
      }

      // Validar tamaño
      if (blob.size > 5 * 1024 * 1024) {
        throw new Error('La imagen es muy grande (máximo 5MB)');
      }

      // ✅ CORRECCIÓN: Obtener extensión desde URL o Content-Type
      const urlExtension = this.getExtensionFromUrl(imageUrl);
      const mimeExtension = this.getFileExtensionFromContentType(blob.type || contentType);
      const fileExtension = urlExtension || mimeExtension || 'jpg';
      
      const finalContentType = this.normalizeContentType(blob.type || contentType, fileExtension);

      console.log('📋 Processing URL image:', {
        urlExtension,
        mimeExtension,
        finalExtension: fileExtension,
        finalContentType
      });

      const fileName = `${this.storeId}/${productId || 'temp'}/${Date.now()}_from_url.${fileExtension}`;

      // ✅ CORRECCIÓN: Upload con Content-Type correcto desde blob
      const { data, error } = await supabaseAdmin.storage
        .from(this.bucket)
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: finalContentType // ← CRÍTICO: Content-Type normalizado
        });

      if (error) {
        console.error('❌ Supabase URL upload error:', error);
        throw new Error(`Error uploading from URL: ${error.message}`);
      }

      const publicUrl = this.getPublicUrl(data.path);
      console.log('✅ URL upload successful:', publicUrl);
      
      return publicUrl;

    } catch (error) {
      console.error('❌ Error in uploadFromUrl:', error);
      throw new Error(`Error procesando URL: ${(error as Error).message}`);
    }
  }

  /**
   * ✅ NUEVO: Obtener URL pública con transformaciones de imagen
   */
  getPublicUrl(path: string, options?: { 
    width?: number; 
    height?: number; 
    quality?: number;
    format?: 'webp' | 'jpg' | 'png';
  }): string {
    const { data } = supabaseAdmin.storage
      .from(this.bucket)
      .getPublicUrl(path, {
        transform: options ? {
          width: options.width,
          height: options.height,
          quality: options.quality || 80,
          format: options.format
        } : undefined
      });
    
    return data.publicUrl;
  }

  /**
   * ✅ NUEVO: Validar si el archivo es una imagen válida
   */
  private isValidImageFile(file: File): boolean {
    // Verificar por MIME type
    if (file.type && file.type.startsWith('image/')) {
      return true;
    }

    // Verificar por extensión si MIME type no está disponible
    const extension = this.getFileExtension(file.name);
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    
    return validExtensions.includes(extension.toLowerCase());
  }

  /**
   * ✅ NUEVO: Obtener Content-Type correcto basado en archivo y extensión
   */
  private getCorrectContentType(file: File, extension: string): string {
    // Si el archivo tiene un tipo válido, usarlo
    if (file.type && file.type.startsWith('image/')) {
      return file.type;
    }

    // Si no, inferir desde la extensión
    return this.getContentTypeFromExtension(extension);
  }

  /**
   * ✅ NUEVO: Normalizar Content-Type para consistencia
   */
  private normalizeContentType(mimeType: string, extension: string): string {
    // Mapear tipos comunes para consistencia
    const mimeMap: { [key: string]: string } = {
      'image/jpg': 'image/jpeg',
      'image/jpe': 'image/jpeg',
    };

    let normalizedType = mimeMap[mimeType.toLowerCase()] || mimeType;

    // Si el MIME type no es de imagen, inferir desde extensión
    if (!normalizedType.startsWith('image/')) {
      normalizedType = this.getContentTypeFromExtension(extension);
    }

    return normalizedType;
  }

  /**
   * ✅ NUEVO: Obtener Content-Type desde extensión
   */
  private getContentTypeFromExtension(extension: string): string {
    const extMap: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'svg': 'image/svg+xml'
    };

    return extMap[extension.toLowerCase()] || 'image/jpeg';
  }

  /**
   * ✅ NUEVO: Extraer extensión desde nombre de archivo
   */
  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop()! : 'jpg';
  }

  /**
   * ✅ NUEVO: Extraer extensión desde URL
   */
  private getExtensionFromUrl(url: string): string | null {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('.');
      return parts.length > 1 ? parts.pop()! : null;
    } catch {
      return null;
    }
  }

  /**
   * ✅ NUEVO: Limpiar nombre de archivo para uso seguro
   */
  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  /**
   * ✅ MEJORADO: Obtener extensión desde Content-Type
   */
  private getFileExtensionFromContentType(contentType: string): string {
    const map: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg'
    };
    return map[contentType.toLowerCase()] || 'jpg';
  }

  /**
   * Eliminar archivo de Supabase Storage
   */
  async deleteFile(url: string): Promise<boolean> {
    try {
      const path = this.extractPathFromUrl(url);
      
      const { error } = await supabaseAdmin.storage
        .from(this.bucket)
        .remove([path]);

      if (error) {
        console.error('Error deleting file:', error);
        return false;
      }

      console.log('✅ File deleted successfully:', path);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Mover archivos temporales a carpeta del producto
   */
  async moveTemporaryFiles(tempUrls: string[], productId: number): Promise<string[]> {
    const newUrls: string[] = [];

    for (const url of tempUrls) {
      try {
        const oldPath = this.extractPathFromUrl(url);
        const fileExtension = oldPath.split('.').pop() || 'jpg';
        const newPath = `${this.storeId}/${productId}/${Date.now()}.${fileExtension}`;

        const { data, error } = await supabaseAdmin.storage
          .from(this.bucket)
          .move(oldPath, newPath);

        if (error) {
          console.error('Error moving file:', error);
          newUrls.push(url); // Mantener URL original si falla
        } else {
          newUrls.push(this.getPublicUrl(newPath));
          console.log(`✅ File moved: ${oldPath} → ${newPath}`);
        }
      } catch (error) {
        console.error('Error processing file move:', error);
        newUrls.push(url);
      }
    }

    return newUrls;
  }

  /**
   * Extraer path desde URL de Supabase
   */
  private extractPathFromUrl(url: string): string {
    const urlParts = url.split('/storage/v1/object/public/');
    if (urlParts.length > 1) {
      return urlParts[1].replace(`${this.bucket}/`, '');
    }
    throw new Error('Invalid Supabase storage URL');
  }
}

/**
 * ✅ NUEVO: Inicializar bucket con configuración optimizada
 */
export async function initializeStorageBucket() {
  try {
    console.log('🔄 Initializing storage bucket...');

    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === 'products');

    if (!bucketExists) {
      console.log('📁 Creating products bucket...');
      
      const { error } = await supabaseAdmin.storage.createBucket('products', {
        public: true,
        allowedMimeTypes: [
          'image/jpeg', 
          'image/jpg', 
          'image/png', 
          'image/gif', 
          'image/webp',
          'image/bmp'
        ],
        fileSizeLimit: 5242880 // 5MB
      });

      if (error) {
        console.error('❌ Error creating bucket:', error);
        throw error;
      } else {
        console.log('✅ Products bucket created successfully');
      }
    } else {
      console.log('✅ Products bucket already exists');
    }

    console.log('✅ Storage bucket initialization complete');

  } catch (error) {
    console.error('❌ Error initializing storage bucket:', error);
    throw error;
  }
}