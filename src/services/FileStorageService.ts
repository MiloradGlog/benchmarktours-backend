import { Storage, Bucket } from '@google-cloud/storage';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

export interface UploadOptions {
  folder: string;
  filename?: string;
  resize?: {
    width?: number;
    height?: number;
    quality?: number;
  };
}

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
}

export class FileStorageService {
  private storage: Storage;
  private bucket: Bucket;

  constructor() {
    // Parse the inline service account key from environment
    const serviceAccountKey = process.env.GOOGLE_STORAGE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.GOOGLE_STORAGE_SERVICE_ACCOUNT_KEY)
      : null;

    if (!serviceAccountKey) {
      throw new Error('GOOGLE_STORAGE_SERVICE_ACCOUNT_KEY environment variable is not set');
    }

    // Initialize storage with the parsed credentials
    this.storage = new Storage({
      projectId: serviceAccountKey.project_id,
      credentials: serviceAccountKey,
    });

    // Use GOOGLE_INPUT_STORAGE_BUCKET if available, otherwise fallback
    const bucketName = process.env.GOOGLE_INPUT_STORAGE_BUCKET || 'benchmarktours-media';
    this.bucket = this.storage.bucket(bucketName);

    console.log(`FileStorageService initialized with bucket: ${bucketName}`);
  }

  async uploadFile(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    const timestamp = Date.now();
    const uuid = randomUUID();
    const filename = options.filename || `${timestamp}_${uuid}`;
    const filepath = `${options.folder}/${filename}`;

    let processedBuffer = buffer;

    // Process image if resize options are provided
    if (options.resize && this.isImageFile(filename)) {
      processedBuffer = await this.processImage(buffer, options.resize);
    }

    // Create file reference
    const file = this.bucket.file(filepath);

    // Upload the file
    await file.save(processedBuffer, {
      metadata: {
        contentType: this.getContentType(filename),
        cacheControl: 'public, max-age=31536000', // 1 year cache
      },
      // Don't set public: true for uniform bucket-level access
    });

    // Don't call makePublic() - bucket should have uniform access configured

    // Return the file path instead of signed URL
    // Signed URLs will be generated on-demand when data is fetched
    return {
      url: filepath, // Store file path, not signed URL
      filename: filepath,
      size: processedBuffer.length,
    };
  }

  async deleteFile(filepath: string): Promise<void> {
    try {
      const file = this.bucket.file(filepath);
      await file.delete();
      console.log(`Deleted file from GCP: ${filepath}`);
    } catch (error: any) {
      // If file doesn't exist, don't throw error
      if (error.code === 404) {
        console.log(`File not found in GCP (already deleted?): ${filepath}`);
      } else {
        console.error(`Error deleting file from GCP: ${filepath}`, error);
        // Don't throw - we don't want to fail the database operation
      }
    }
  }

  async deleteFileByUrl(url: string): Promise<void> {
    if (!url) return;
    
    const filepath = this.extractFilePathFromUrl(url);
    if (filepath) {
      await this.deleteFile(filepath);
    }
  }

  extractFilePathFromUrl(url: string): string | null {
    if (!url) return null;

    // First check if this is a signed URL
    // Signed URLs have query parameters like ?X-Goog-Algorithm=...
    const urlObj = new URL(url);
    const pathWithoutQuery = urlObj.pathname;

    // Extract file path from signed URL
    // Format: /bucket-name/path/to/file or /v0/b/bucket-name/o/path%2Fto%2Ffile
    if (pathWithoutQuery.startsWith(`/${this.bucket.name}/`)) {
      return pathWithoutQuery.substring(this.bucket.name.length + 2);
    }

    // Handle URL-encoded paths in signed URLs
    if (pathWithoutQuery.includes('/v0/b/')) {
      const matches = pathWithoutQuery.match(/\/v0\/b\/[^/]+\/o\/(.+)/);
      if (matches && matches[1]) {
        return decodeURIComponent(matches[1]);
      }
    }

    // Extract file path from public URL
    // Format: https://storage.googleapis.com/bucket-name/path/to/file
    const pattern = new RegExp(`https://storage\\.googleapis\\.com/${this.bucket.name}/(.+)`);
    const match = url.match(pattern);

    if (match && match[1]) {
      // Remove query parameters if present
      return match[1].split('?')[0];
    }

    // Try alternate URL format
    // Format: https://bucket-name.storage.googleapis.com/path/to/file
    const altPattern = new RegExp(`https://${this.bucket.name}\\.storage\\.googleapis\\.com/(.+)`);
    const altMatch = url.match(altPattern);

    if (altMatch && altMatch[1]) {
      return altMatch[1].split('?')[0];
    }

    console.warn(`Could not extract file path from URL: ${url}`);
    return null;
  }

  async generateSignedUrl(filepath: string, expiresIn: number = 3600): Promise<string> {
    const file = this.bucket.file(filepath);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });
    return url;
  }

  /**
   * Converts a file path or existing signed URL to a fresh signed URL
   * Handles backward compatibility with existing signed URLs in database
   * @param pathOrUrl - File path (e.g., "companies/company_1.jpg") or existing URL
   * @param expiresIn - Expiration time in seconds (default: 7 days)
   */
  async getSignedUrlFromPathOrUrl(pathOrUrl: string | null | undefined, expiresIn: number = 7 * 24 * 60 * 60): Promise<string | null> {
    if (!pathOrUrl) return null;

    // If it's already a URL (starts with http), check if it's expired
    if (pathOrUrl.startsWith('http')) {
      try {
        const url = new URL(pathOrUrl);
        
        // Check if it's a signed URL with expiration
        const expiresParam = url.searchParams.get('Expires') || url.searchParams.get('X-Goog-Expires');
        
        if (expiresParam) {
          // It's a signed URL - extract the path and generate a fresh one
          const filepath = this.extractFilePathFromUrl(pathOrUrl);
          if (filepath) {
            return await this.generateSignedUrl(filepath, expiresIn);
          }
        }
        
        // If no expiration param, it might be a public URL - return as is
        return pathOrUrl;
      } catch (error) {
        console.error('Error parsing URL:', error);
        return null;
      }
    }

    // It's a file path - generate signed URL
    try {
      return await this.generateSignedUrl(pathOrUrl, expiresIn);
    } catch (error) {
      console.error(`Error generating signed URL for path: ${pathOrUrl}`, error);
      return null;
    }
  }

  /**
   * Transform an object by converting all file path fields to signed URLs
   * @param obj - Object containing potential file path fields
   * @param fields - Array of field names that contain file paths (e.g., ['image_url', 'logo_url'])
   */
  async transformUrlFields<T extends Record<string, any>>(obj: T, fields: string[]): Promise<T> {
    if (!obj) return obj;

    const transformed = { ...obj };
    
    for (const field of fields) {
      if (transformed[field]) {
        transformed[field] = await this.getSignedUrlFromPathOrUrl(transformed[field]);
      }
    }

    return transformed;
  }

  /**
   * Transform an array of objects by converting file path fields to signed URLs
   * @param array - Array of objects
   * @param fields - Array of field names that contain file paths
   */
  async transformUrlFieldsInArray<T extends Record<string, any>>(array: T[], fields: string[]): Promise<T[]> {
    if (!array || array.length === 0) return array;

    return Promise.all(
      array.map(item => this.transformUrlFields(item, fields))
    );
  }

  private async processImage(buffer: Buffer, options: { width?: number; height?: number; quality?: number }): Promise<Buffer> {
    let image = sharp(buffer);

    if (options.width || options.height) {
      image = image.resize(options.width, options.height, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    if (options.quality) {
      image = image.jpeg({ quality: options.quality });
    }

    return await image.toBuffer();
  }

  private isImageFile(filename: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  private getContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/m4a',
      'aac': 'audio/aac',
    };

    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  // Utility methods for different upload types
  async uploadCompanyImage(companyId: number, buffer: Buffer, originalName: string): Promise<UploadResult> {
    const ext = originalName.split('.').pop();
    const filename = `company_${companyId}_${Date.now()}.${ext}`;
    
    return this.uploadFile(buffer, {
      folder: 'companies',
      filename,
      resize: {
        width: 800,
        height: 600,
        quality: 85,
      },
    });
  }

  async uploadTourLogo(tourId: number, buffer: Buffer, originalName: string): Promise<UploadResult> {
    const ext = originalName.split('.').pop();
    const filename = `tour_${tourId}_${Date.now()}.${ext}`;

    return this.uploadFile(buffer, {
      folder: 'tours',
      filename,
      resize: {
        width: 800,
        height: 600,
        quality: 85,
      },
    });
  }

  async uploadActivityImage(activityId: number, buffer: Buffer, originalName: string): Promise<UploadResult> {
    const ext = originalName.split('.').pop();
    const filename = `activity_${activityId}_${Date.now()}.${ext}`;
    
    return this.uploadFile(buffer, {
      folder: 'activities',
      filename,
      resize: {
        width: 800,
        height: 600,
        quality: 85,
      },
    });
  }

  async uploadDiscussionImage(messageId: number, buffer: Buffer, originalName: string): Promise<UploadResult> {
    const ext = originalName.split('.').pop();
    const filename = `discussion_image_${messageId}_${Date.now()}.${ext}`;
    
    return this.uploadFile(buffer, {
      folder: 'discussions',
      filename,
      resize: {
        width: 1200,
        height: 900,
        quality: 80,
      },
    });
  }

  async uploadDiscussionVoice(messageId: number, buffer: Buffer, originalName: string): Promise<UploadResult> {
    const ext = originalName.split('.').pop();
    const filename = `discussion_voice_${messageId}_${Date.now()}.${ext}`;
    
    return this.uploadFile(buffer, {
      folder: 'discussions',
      filename,
    });
  }


  async uploadNoteAudio(noteId: number, buffer: Buffer, originalName: string): Promise<UploadResult> {
    const ext = originalName.split('.').pop();
    const filename = `note_audio_${noteId}_${Date.now()}.${ext}`;
    
    return this.uploadFile(buffer, {
      folder: 'notes',
      filename,
    });
  }
}

export const fileStorageService = new FileStorageService();