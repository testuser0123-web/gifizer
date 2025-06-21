'use client';

import { useState, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUpload, faFilm, faExclamationTriangle, faLink } from '@fortawesome/free-solid-svg-icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onUrlSelect?: (url: string) => void;
  disabled?: boolean;
}

const ACCEPTED_FORMATS = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function FileUpload({ onFileSelect, onUrlSelect, disabled = false }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'url'>('file');
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

  const validateUrl = (url: string): string | null => {
    if (!url.trim()) return 'URLが入力されていません';
    
    try {
      const urlObj = new URL(url);
      
      // Twitter video URLs validation
      if (urlObj.hostname === 'video.twimg.com') {
        // Check pathname without query parameters
        const pathWithoutQuery = urlObj.pathname;
        if (!pathWithoutQuery.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
          return 'サポートされていない動画形式です';
        }
        return null;
      }
      
      // Direct video file URLs
      const extension = '.' + url.split('.').pop()?.toLowerCase();
      if (ACCEPTED_FORMATS.includes(extension)) {
        return null;
      }
      
      return 'サポートされていないURL形式です。Twitter動画URL（video.twimg.com）または直接動画ファイルのURLを入力してください';
    } catch {
      return '有効なURLを入力してください';
    }
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

  const handleUrlSubmit = useCallback(() => {
    if (!onUrlSelect) return;
    
    setError(null);
    const validationError = validateUrl(url);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    onUrlSelect(url);
  }, [url, onUrlSelect]);

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      {/* Mode Toggle Tabs */}
      <div className="flex mb-4 bg-muted/50 rounded-lg p-1">
        <button
          onClick={() => setInputMode('file')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            inputMode === 'file' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-secondary hover:text-foreground'
          }`}
          disabled={disabled}
        >
          <FontAwesomeIcon icon={faCloudUpload} className="mr-2" />
          ファイルアップロード
        </button>
        <button
          onClick={() => setInputMode('url')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            inputMode === 'url' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-secondary hover:text-foreground'
          }`}
          disabled={disabled}
        >
          <FontAwesomeIcon icon={faLink} className="mr-2" />
          URL入力
        </button>
      </div>

      {inputMode === 'file' ? (
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
      ) : (
        <div className="space-y-4">
          <div className="text-center p-6 sm:p-8">
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <FontAwesomeIcon 
                icon={faLink} 
                className="text-primary text-xl sm:text-2xl md:text-3xl"
              />
            </div>
            <h3 className="text-base sm:text-lg md:text-xl font-semibold text-foreground mb-2">
              Twitter動画URLを入力
            </h3>
            <p className="text-secondary text-sm md:text-base mb-4">
              video.twimg.com の動画URLまたは直接動画ファイルのURLを入力してください
            </p>
            
            <div className="max-w-md mx-auto space-y-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://video.twimg.com/amplify_video/..."
                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={disabled}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleUrlSubmit();
                  }
                }}
              />
              <button
                onClick={handleUrlSubmit}
                disabled={disabled || !url.trim()}
                className="w-full btn btn-primary py-3"
              >
                <FontAwesomeIcon icon={faLink} className="mr-2" />
                URLから動画を読み込み
              </button>
            </div>
            
            <div className="mt-4 space-y-2">
              <div className="text-xs text-secondary">
                対応: Twitter動画URL (video.twimg.com) • 直接動画ファイルURL (.mp4, .mov, .avi等)
              </div>
              <div className="bg-red-50/70 border border-red-200/50 rounded-lg p-3 text-xs">
                <p className="text-red-700 font-medium mb-1">⚠️ 重要な法的注意事項</p>
                <p className="text-red-600 leading-relaxed">
                  利用者は、第三者の著作権、肖像権、その他の知的財産権を侵害しないことに同意するものとします。
                  権利者の許可なく他者の動画を使用することは法的責任を伴う場合があります。
                  利用者による権利侵害に起因する一切の損害について、本サービス運営者は責任を負いません。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-lg flex items-center gap-2">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-error" />
          <span className="text-error text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}