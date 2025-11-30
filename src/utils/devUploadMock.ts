// Development mode mock for R2 uploads
// This simulates the upload functionality when the backend isn't running

export interface MockUploadResponse {
  success: boolean;
  uploadUrl?: string;
  publicUrl?: string;
  key?: string;
  error?: string;
  details?: string;
}

export const mockR2Upload = async (
  file: File,
  category: string
): Promise<MockUploadResponse> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Create a local blob URL for preview
  const blobUrl = URL.createObjectURL(file);
  
  // Generate mock URLs that look like real R2 URLs
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const mockKey = `${category}s/${new Date().toISOString().split('T')[0]}/${timestamp}-${randomString}-${sanitizedName}`;
  
  console.log('🧪 DEV MODE: Using mock upload');
  console.log('📁 Mock file URL (blob):', blobUrl);
  console.warn('⚠️ This is a development mock. Files are not actually uploaded to R2.');
  console.warn('⚠️ To test real uploads, run: npm run dev:with-functions');

  return {
    success: true,
    uploadUrl: blobUrl, // Not used in mock
    publicUrl: blobUrl, // Use blob URL for preview in development
    key: mockKey,
  };
};

export const isProductionMode = (): boolean => {
  return import.meta.env.PROD || window.location.hostname !== 'localhost';
};

