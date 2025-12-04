import React, { useRef, useState } from 'react';
import { uploadToR2, FileCategory, getMaxFileSize } from '../../utils/r2Upload';

interface FileUploadProps {
  label: string;
  accept: string;
  category: FileCategory;
  onUploadComplete?: (url: string) => void;
  currentUrl?: string;
  helpText?: string;
  multiple?: boolean;
  onMultipleUploadComplete?: (urls: string[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  label,
  accept,
  category,
  onUploadComplete,
  currentUrl,
  helpText,
  multiple = false,
  onMultipleUploadComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  const maxSize = getMaxFileSize(category);
  const maxSizeMB = maxSize / (1024 * 1024);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError('');
    setUploading(true);
    setProgress(0);

    try {
      if (multiple) {
        // Upload multiple files
        const urls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setProgress(Math.round(((i + 0.5) / files.length) * 100));

          const result = await uploadToR2(file, category, (fileProgress) => {
            const overallProgress = Math.round(((i + fileProgress / 100) / files.length) * 100);
            setProgress(overallProgress);
          });

          if (result.success && result.url) {
            urls.push(result.url);
          } else {
            setError(result.error || 'Upload failed');
          }
        }

        setUploadedUrls(urls);
        if (onMultipleUploadComplete) {
          onMultipleUploadComplete(urls);
        }
      } else {
        // Upload single file
        const file = files[0];
        const result = await uploadToR2(file, category, setProgress);

        if (result.success && result.url) {
          if (onUploadComplete) {
            onUploadComplete(result.url);
          }
          setUploadedUrls([result.url]);
        } else {
          setError(result.error || 'Upload failed');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Filter files by accept pattern
    const acceptedFiles = files.filter(file => {
      const acceptTypes = accept.split(',').map(t => t.trim());
      return acceptTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type);
        }
        if (type.endsWith('/*')) {
          const prefix = type.split('/')[0];
          return file.type.startsWith(prefix);
        }
        return file.type === type;
      });
    });

    if (acceptedFiles.length === 0) {
      setError('Invalid file type');
      return;
    }

    // Create a fake input event to reuse the upload logic
    const dataTransfer = new DataTransfer();
    acceptedFiles.forEach(file => dataTransfer.items.add(file));

    if (fileInputRef.current) {
      fileInputRef.current.files = dataTransfer.files;
      handleFileSelect({ target: fileInputRef.current } as any);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-900 dark:text-white">
        {label}
      </label>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="relative"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          disabled={uploading}
          multiple={multiple}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full px-4 py-8 border-2 border-dashed border-gray-300 dark:border-zinc-600 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-zinc-800"
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            {uploading ? (
              <>
                <svg className="animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-gray-600 dark:text-zinc-300">Uploading... {progress}%</p>
                <div className="w-full max-w-xs bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                  <div
                    className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Max size: {maxSizeMB}MB {multiple && '(multiple files supported)'}
                </p>
              </>
            )}
          </div>
        </button>
      </div>

      {helpText && (
        <p className="text-xs text-gray-500 dark:text-zinc-400">{helpText}</p>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
          <div className="flex items-start space-x-3">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">Upload Failed</p>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <details className="mt-2">
                <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:underline">
                  Troubleshooting Tips
                </summary>
                <ul className="mt-2 text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                  <li>Check browser console (F12) for detailed errors</li>
                  <li>Verify R2 credentials are configured</li>
                  <li>Ensure VITE_R2_UPLOAD_SECRET is set</li>
                  <li>Check file size (images: 5MB, others: 50MB)</li>
                </ul>
              </details>
            </div>
          </div>
        </div>
      )}

      {(currentUrl || uploadedUrls.length > 0) && (
        <div className="mt-3 space-y-2">
          {category === 'image' && currentUrl && (
            <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700">
              <img
                src={currentUrl}
                alt="Preview"
                className="w-full h-48 object-cover"
                onError={(e) => {
                  console.error('❌ Failed to load image:', currentUrl);
                  console.error('Error event:', e);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute top-2 right-2">
                <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 dark:bg-green-900 text-xs font-medium text-green-800 dark:text-green-100">
                  ✓ Uploaded
                </span>
              </div>
            </div>
          )}

          {category !== 'image' && currentUrl && (
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-green-800 dark:text-green-200">File uploaded successfully</span>
              </div>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-600 dark:text-green-400 hover:underline"
              >
                View
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUpload;

