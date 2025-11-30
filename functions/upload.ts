// Cloudflare Pages Function for R2 Presigned URL Generation
// Route: /api/upload
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface Env {
  CLOUDFLARE_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  R2_BUCKET_PUBLIC_DOMAIN: string;
  UPLOAD_SECRET: string;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

const getFolderByCategory = (category: string): string => {
  const folderMap: { [key: string]: string } = {
    'image': 'images',
    'video': 'videos',
    'document': 'documents',
    'file': 'files',
  };
  return folderMap[category] || 'files';
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const env = context.env;

    // Verify upload secret
    const authHeader = context.request.headers.get('X-Upload-Secret');
    if (!authHeader || authHeader !== env.UPLOAD_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Parse request body
    const body = await context.request.json();
    const { fileName, fileType, category, fileSize } = body;

    if (!fileName || !fileType || !category) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Validate file size
    const maxSize = category === 'image' ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (fileSize && fileSize > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return new Response(
        JSON.stringify({ 
          error: `File too large. Maximum size for ${category}s is ${maxSizeMB}MB` 
        }), 
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Validate file type
    let allowedTypes: string[] = [];
    if (category === 'image') {
      allowedTypes = ALLOWED_IMAGE_TYPES;
    } else if (category === 'video') {
      allowedTypes = ALLOWED_VIDEO_TYPES;
    } else if (category === 'document') {
      allowedTypes = ALLOWED_DOC_TYPES;
    }

    if (allowedTypes.length > 0 && !allowedTypes.includes(fileType)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid file type. Allowed types for ${category}: ${allowedTypes.join(', ')}` 
        }), 
        {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Create S3 client
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });

    // Generate unique key
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = getFolderByCategory(category);
    const subfolder = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `${folder}/${subfolder}/${timestamp}-${randomString}-${sanitizedName}`;

    // Create presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 }); // 5 minutes
    const publicUrl = `https://${env.R2_BUCKET_PUBLIC_DOMAIN}/${key}`;

    return new Response(
      JSON.stringify({
        success: true,
        uploadUrl,
        publicUrl,
        key,
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (error: any) {
    console.error('Presigned URL generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate upload URL', 
        details: error.message 
      }), 
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};

// Handle CORS preflight
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Secret',
      'Access-Control-Max-Age': '86400',
    },
  });
};

