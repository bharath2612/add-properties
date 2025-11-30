// R2 Upload Utility using Presigned URLs
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
 * Upload file to R2 using presigned URL
 * 1. Request presigned URL from backend
 * 2. Upload directly to R2 using presigned URL
 * 3. Return public URL
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

    // Check if we're in development mode
    const isDev = !isProductionMode();
    const uploadSecret = import.meta.env.VITE_R2_UPLOAD_SECRET || '';
    
    // In development mode without API server, use mock upload
    if (isDev && !uploadSecret) {
      console.warn('🧪 Development mode: Using mock upload (files not saved to R2)');
      console.warn('💡 To test real uploads, add VITE_R2_UPLOAD_SECRET to .env.local and run: npm run dev:with-functions');
      
      // Simulate progress
      if (onProgress) {
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          onProgress(i);
        }
      }
      
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

    if (!uploadSecret) {
      console.error('❌ VITE_R2_UPLOAD_SECRET not set in environment variables');
      return { 
        success: false, 
        error: 'Upload not configured. Missing VITE_R2_UPLOAD_SECRET environment variable.' 
      };
    }

    console.log('🔐 Upload secret found, proceeding with upload...');

    // Step 1: Get presigned URL from backend
    console.log('📤 Requesting presigned URL for:', file.name, `(${formatFileSize(file.size)})`);
    
    const presignResponse = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Secret': uploadSecret,
      },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        category: category,
        fileSize: file.size,
      }),
    });

    console.log('📥 Presign response status:', presignResponse.status);

    if (!presignResponse.ok) {
      let errorMessage = 'Failed to get upload URL';
      let errorDetails = '';
      
      try {
        const error = await presignResponse.json();
        errorMessage = error.error || errorMessage;
        errorDetails = error.details || '';
        console.error('❌ Presign error:', error);
      } catch (e) {
        const errorText = await presignResponse.text();
        console.error('❌ Presign error (raw):', errorText);
        errorDetails = errorText;
      }

      // If we get 500/502/503 in development, suggest using mock mode
      if (isDev && (presignResponse.status >= 500 && presignResponse.status < 600)) {
        console.warn('💡 Backend API not available. Falling back to mock mode...');
        console.warn('💡 To use real uploads in dev, run: npm run dev:with-functions');
        
        // Simulate progress
        if (onProgress) {
          for (let i = 0; i <= 100; i += 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            onProgress(i);
          }
        }
        
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

      return {
        success: false,
        error: `${errorMessage} (Status: ${presignResponse.status})`,
        details: errorDetails,
      };
    }

    const { uploadUrl, publicUrl, key } = await presignResponse.json();
    console.log('✅ Got presigned URL, uploading to R2...');

    // Step 2: Upload directly to R2 using presigned URL
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
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
          console.error('Response:', xhr.responseText);
          resolve({
            success: false,
            error: `Upload to R2 failed (Status: ${xhr.status})`,
            details: xhr.responseText || xhr.statusText,
          });
        }
      });

      xhr.addEventListener('error', (e) => {
        console.error('❌ Network error during upload:', e);
        resolve({
          success: false,
          error: 'Network error during upload. Check your internet connection.',
        });
      });

      xhr.addEventListener('abort', () => {
        console.warn('⚠️ Upload cancelled by user');
        resolve({
          success: false,
          error: 'Upload cancelled',
        });
      });

      // Upload file to presigned URL
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

  } catch (error: any) {
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

