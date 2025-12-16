import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mockR2Upload, isProductionMode } from './devUploadMock';

export interface UploadResponse {
  success: boolean;
  url?: string;
  key?: string;
  filename?: string;
  size?: number;
  type?: string;
  error?: string;
  details?: string;
}

export type FileCategory = 'image' | 'video' | 'document' | 'file';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const getMaxFileSize = (category: FileCategory): number => {
  return category === 'image' ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const validateFileSize = (file: File, category: FileCategory): string | null => {
  const maxSize = getMaxFileSize(category);
  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    return `File too large. Maximum size for ${category}s is ${maxSizeMB}MB. Your file is ${formatFileSize(file.size)}.`;
  }
  return null;
};

export const validateFileType = (file: File, category: FileCategory): string | null => {
  const allowedTypes: { [key: string]: string[] } = {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  };

  if (category !== 'file' && allowedTypes[category]) {
    if (!allowedTypes[category].includes(file.type)) {
      return `Invalid file type. Allowed types: ${allowedTypes[category].join(', ')}`;
    }
  }
  return null;
};

/**
 * Upload file to R2 directly from client
 * Generates presigned URL locally using exposed credentials (SECURITY WARNING APPLIES)
 */
export const uploadToR2 = async (
  file: File,
  category: FileCategory,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> => {
  try {
    // Validate file size
    const sizeError = validateFileSize(file, category);
    if (sizeError) {
      return { success: false, error: sizeError };
    }

    // Validate file type
    const typeError = validateFileType(file, category);
    if (typeError) {
      return { success: false, error: typeError };
    }

    // Get credentials from environment
    const accountId = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID;
    const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
    const bucketName = import.meta.env.VITE_R2_BUCKET_NAME;
    const publicDomain = import.meta.env.VITE_R2_BUCKET_PUBLIC_DOMAIN;

    // Check if we have credentials. If not, fallback to mock if in dev.
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicDomain) {
      const isDev = !isProductionMode();
      if (isDev) {
        console.warn('🧪 Development mode: Missing R2 credentials, using mock upload');
        const mockResult = await mockR2Upload(file, category);
        return {
          success: mockResult.success,
          url: mockResult.publicUrl,
          key: mockResult.key,
          filename: file.name,
          size: file.size,
          type: file.type,
        };
      }

      console.error('❌ Missing R2 environment variables');
      return {
        success: false,
        error: 'Upload configuration missing. Check .env.local for VITE_R2_* variables.'
      };
    }

    // Initialize S3 Client
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    // Generate Key
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = category === 'image' ? 'images' : 'files';
    const subfolder = new Date().toISOString().split('T')[0];
    const key = `${folder}/${subfolder}/${timestamp}-${randomString}-${sanitizedName}`;

    // Create Command
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: file.type,
    });

    // Generate Presigned URL
    console.log('🔐 Generating presigned URL locally...');
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    const publicUrl = `https://${publicDomain}/${key}`;

    console.log('✅ Generated URL, uploading to R2...');

    // Upload using XMLHttpRequest for progress tracking
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          console.log('✅ Upload successful!', publicUrl);
          resolve({
            success: true,
            url: publicUrl,
            key: key,
            filename: file.name,
            size: file.size,
            type: file.type,
          });
        } else {
          console.error('❌ R2 upload failed with status:', xhr.status);
          resolve({
            success: false,
            error: `Upload to R2 failed (Status: ${xhr.status})`,
            details: xhr.responseText,
          });
        }
      });

      xhr.addEventListener('error', (e) => {
        console.error('❌ Network error during upload:', e);
        resolve({
          success: false,
          error: 'Network error during upload.',
        });
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: 'Upload failed',
      details: error.message,
    };
  }
};

export const uploadMultipleToR2 = async (
  files: File[],
  category: FileCategory,
  onProgress?: (fileIndex: number, progress: number) => void
): Promise<UploadResponse[]> => {
  const results: UploadResponse[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await uploadToR2(files[i], category, (progress) => {
      if (onProgress) {
        onProgress(i, progress);
      }
    });
    results.push(result);
  }

  return results;
};

/**
 * Extract the key from an R2 public URL
 * Assumes URL format: https://domain/bucket/key or https://domain/key
 */
export const extractKeyFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    // Remove leading slash from pathname
    const path = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    return path || null;
  } catch {
    return null;
  }
};

/**
 * Delete a file from R2 storage
 */
export const deleteFromR2 = async (url: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const accountId = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = import.meta.env.VITE_R2_ACCESS_KEY_ID;
    const secretAccessKey = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
    const bucketName = import.meta.env.VITE_R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      const isDev = !isProductionMode();
      if (isDev) {
        console.warn('🧪 Development mode: Missing R2 credentials, skipping delete');
        return { success: true }; // Don't fail in dev mode
      }
      return { success: false, error: 'Delete configuration missing' };
    }

    const key = extractKeyFromUrl(url);
    if (!key) {
      return { success: false, error: 'Could not extract key from URL' };
    }

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await client.send(command);
    console.log('✅ File deleted from R2:', key);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error deleting file from R2:', error);
    return { success: false, error: error.message || 'Failed to delete file' };
  }
};
