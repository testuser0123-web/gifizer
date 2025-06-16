'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHistory, 
  faTrash, 
  faCopy, 
  faExternalLink,
  faCheck,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';

interface HistoryItem {
  id: string;
  filename: string;
  originalFilename: string;
  imgurLink: string;
  deleteHash: string;
  size: number;
  timestamp: string;
  settings: {
    size: string;
    quality: string;
    frameRate: number;
    copyright: string;
  };
}

interface HistoryPanelProps {
  onRefresh?: () => void;
}

export function HistoryPanel({ onRefresh }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    try {
      const storedHistory = localStorage.getItem('gifizer-history');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error('履歴の読み込みに失敗:', error);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('クリップボードへのコピーに失敗:', error);
    }
  };

  const deleteItem = async (item: HistoryItem) => {
    if (!confirm('この項目を削除しますか？Imgurからも削除されます。')) {
      return;
    }

    setDeletingId(item.id);

    try {
      // Imgurから削除
      const response = await fetch('/api/upload-imgur', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deleteHash: item.deleteHash
        }),
      });

      if (!response.ok) {
        console.warn('Imgurからの削除に失敗しましたが、ローカル履歴からは削除します');
      }

      // ローカル履歴から削除
      const updatedHistory = history.filter(h => h.id !== item.id);
      setHistory(updatedHistory);
      localStorage.setItem('gifizer-history', JSON.stringify(updatedHistory));
      
      onRefresh?.();
    } catch (error) {
      console.error('削除に失敗:', error);
      alert('削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  };

  const clearAllHistory = async () => {
    if (!confirm('すべての履歴を削除しますか？この操作は取り消せません。')) {
      return;
    }

    try {
      // すべてのアイテムをImgurから削除
      await Promise.all(
        history.map(async (item) => {
          try {
            await fetch('/api/upload-imgur', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                deleteHash: item.deleteHash
              }),
            });
          } catch (error) {
            console.warn(`Item ${item.id} の削除に失敗:`, error);
          }
        })
      );

      // ローカル履歴をクリア
      setHistory([]);
      localStorage.removeItem('gifizer-history');
      onRefresh?.();
    } catch (error) {
      console.error('一括削除に失敗:', error);
      alert('一括削除に失敗しました');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="p-3 sm:p-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left min-h-[44px]"
        >
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faHistory} className="text-primary" />
            <h3 className="font-semibold text-foreground text-sm sm:text-base">変換履歴</h3>
            <span className="text-xs sm:text-sm text-secondary">({history.length}件)</span>
          </div>
          <span className={`transform transition-transform text-sm ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        
        {isExpanded && (
          <div className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
            {/* Clear All Button */}
            <div className="flex justify-end">
              <button
                onClick={clearAllHistory}
                className="btn btn-secondary text-xs sm:text-sm px-3 py-2"
              >
                <FontAwesomeIcon icon={faTrash} />
                すべて削除
              </button>
            </div>

            {/* History Items */}
            <div className="space-y-2 sm:space-y-3 max-h-80 sm:max-h-96 overflow-y-auto">
              {history.map((item) => (
                <div key={item.id} className="border border-border rounded-lg p-2 sm:p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate text-sm sm:text-base">
                        {item.filename}
                      </h4>
                      <p className="text-xs text-secondary truncate">
                        元ファイル: {item.originalFilename}
                      </p>
                      <p className="text-xs text-secondary">
                        {formatDate(item.timestamp)} • {formatFileSize(item.size)}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      {/* Copy Link */}
                      <button
                        onClick={() => copyToClipboard(item.imgurLink, item.id)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-muted hover:bg-muted-dark flex items-center justify-center transition-colors"
                        title="リンクをコピー"
                      >
                        <FontAwesomeIcon 
                          icon={copiedId === item.id ? faCheck : faCopy} 
                          className={`text-xs ${copiedId === item.id ? 'text-success' : 'text-secondary'}`}
                        />
                      </button>
                      
                      {/* Open Link */}
                      <a
                        href={item.imgurLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-muted hover:bg-muted-dark flex items-center justify-center transition-colors"
                        title="新しいタブで開く"
                      >
                        <FontAwesomeIcon icon={faExternalLink} className="text-xs text-secondary" />
                      </a>
                      
                      {/* Delete */}
                      <button
                        onClick={() => deleteItem(item)}
                        disabled={deletingId === item.id}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-error/10 hover:bg-error/20 flex items-center justify-center transition-colors"
                        title="削除"
                      >
                        {deletingId === item.id ? (
                          <FontAwesomeIcon icon={faSpinner} className="text-xs text-error animate-spin" />
                        ) : (
                          <FontAwesomeIcon icon={faTrash} className="text-xs text-error" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Settings Info */}
                  <div className="text-xs text-secondary">
                    <span>サイズ: {item.settings.size}</span>
                    <span className="mx-2">•</span>
                    <span>品質: {item.settings.quality}</span>
                    <span className="mx-2">•</span>
                    <span>{item.settings.frameRate}fps</span>
                    {item.settings.copyright && (
                      <>
                        <span className="mx-2">•</span>
                        <span>© {item.settings.copyright}</span>
                      </>
                    )}
                  </div>
                  
                  {/* Preview Thumbnail */}
                  <div className="mt-2">
                    <Image
                      src={item.imgurLink}
                      alt={item.filename}
                      width={96}
                      height={96}
                      className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded border border-border object-contain"
                      unoptimized
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}