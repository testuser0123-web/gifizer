'use client';

import { useState, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUpload, faFilm, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED_FORMATS = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function FileUpload({ onFileSelect, disabled = false }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!file) return 'ファイルが選択されていません';
    
    if (file.size > MAX_FILE_SIZE) {
      return 'ファイルサイズが100MBを超えています';
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_FORMATS.includes(extension)) {
      return `対応していないファイル形式です。対応形式: ${ACCEPTED_FORMATS.join(', ')}`;
    }

    return null;
  };

  const handleFile = useCallback((file: File) => {
    setError(null);
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    onFileSelect(file);
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [disabled, handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <div
        className={`
          drag-area relative cursor-pointer p-6 sm:p-8 md:p-10 text-center
          ${isDragOver ? 'drag-over' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FORMATS.join(',')}
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <FontAwesomeIcon 
              icon={faCloudUpload} 
              className="text-primary text-xl sm:text-2xl md:text-3xl"
            />
          </div>
          
          <div className="space-y-1 sm:space-y-2">
            <h3 className="text-base sm:text-lg md:text-xl font-semibold text-foreground">
              動画ファイルをドラッグ&ドロップ
            </h3>
            <p className="text-secondary text-sm md:text-base">
              または<span className="text-primary font-medium">クリックしてファイルを選択</span>
            </p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs md:text-sm text-secondary justify-center">
              <FontAwesomeIcon icon={faFilm} />
              <span>対応形式: MP4, AVI, MOV, MKV, WebM</span>
            </div>
            
            <div className="text-xs text-secondary">
              最大ファイルサイズ: 100MB
            </div>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-lg flex items-center gap-2">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-error" />
          <span className="text-error text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}