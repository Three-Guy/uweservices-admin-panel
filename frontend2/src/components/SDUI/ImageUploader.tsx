// src/components/SDUI/ImageUploader.tsx
import React, { useCallback, useState } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';

interface ImageUploaderProps {
  currentImage?: string | null;
  onImageSelect: (file: File) => void;
  onImageRemove?: () => void;
  accept?: string;
  maxSize?: number; // in MB
  aspectRatio?: string;
  className?: string;
  disabled?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  currentImage,
  onImageSelect,
  onImageRemove,
  accept = 'image/jpeg,image/png,image/gif,image/webp',
  maxSize = 5,
  aspectRatio = '16/9',
  className = '',
  disabled = false,
}) => {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): boolean => {
    setError(null);

    // Check file type
    const validTypes = accept.split(',').map(t => t.trim());
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload JPG, PNG, GIF, or WebP.');
      return false;
    }

    // Check file size
    const maxBytes = maxSize * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File too large. Maximum size is ${maxSize}MB.`);
      return false;
    }

    return true;
  };

  const handleFile = (file: File) => {
    if (!validateFile(file)) return;

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Pass file to parent
    onImageSelect(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [disabled]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    onImageRemove?.();
  };

  // Update preview when currentImage changes
  React.useEffect(() => {
    if (currentImage) {
      setPreview(currentImage);
    }
  }, [currentImage]);

  return (
    <div className={`relative ${className}`}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl overflow-hidden transition-all
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}
        `}
        style={{ aspectRatio }}
      >
        {preview ? (
          <div className="relative w-full h-full">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3">
              <label className="flex items-center justify-center gap-2 text-white text-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                Change Image
                <input
                  type="file"
                  accept={accept}
                  onChange={handleFileInput}
                  className="hidden"
                  disabled={disabled}
                />
              </label>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-full p-6 cursor-pointer">
            <div className="flex flex-col items-center justify-center">
              <div className="p-4 bg-gray-200 rounded-full mb-4">
                <ImageIcon className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 text-center mb-2">
                <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-400">
                PNG, JPG, GIF or WebP (max. {maxSize}MB)
              </p>
            </div>
            <input
              type="file"
              accept={accept}
              onChange={handleFileInput}
              className="hidden"
              disabled={disabled}
            />
          </label>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <X className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
};

export default ImageUploader;
