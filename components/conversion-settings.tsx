'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { faCopyright } from '@fortawesome/free-regular-svg-icons';

export interface ConversionSettings {
  size: '320px' | '480px' | '720px';
  quality: 'low' | 'medium' | 'high';
  frameRate: 10 | 15 | 24;
  copyright: string;
}

interface ConversionSettingsProps {
  settings: ConversionSettings;
  onSettingsChange: (settings: ConversionSettings) => void;
  disabled?: boolean;
}

export function ConversionSettingsPanel({ 
  settings, 
  onSettingsChange, 
  disabled = false 
}: ConversionSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateSetting = <K extends keyof ConversionSettings>(
    key: K, 
    value: ConversionSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="card">
      <div className="p-4 sm:p-6">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left min-h-[44px]"
          disabled={disabled}
        >
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faCog} className="text-primary" />
            <h3 className="font-semibold text-foreground text-base sm:text-lg">変換設定</h3>
          </div>
          <span className={`transform transition-transform text-sm ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        
        {isExpanded && (
          <div className="mt-4 space-y-4 sm:space-y-5 px-2">
            {/* Size Setting */}
            <div className="space-y-2">
              <label className="block text-sm sm:text-base font-medium text-foreground">
                サイズ
              </label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {(['320px', '480px', '720px'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => updateSetting('size', size)}
                    disabled={disabled}
                    className={`
                      p-4 text-sm sm:text-base rounded-lg border transition-colors min-h-[48px] font-medium
                      ${settings.size === size 
                        ? 'border-primary bg-primary text-white shadow-md' 
                        : 'border-border bg-card text-foreground hover:bg-muted hover:border-primary/30'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Setting */}
            <div className="space-y-2">
              <label className="block text-sm sm:text-base font-medium text-foreground">
                品質
              </label>
              <div className="grid grid-cols-1 gap-2 sm:gap-3">
                {([
                  { key: 'low', label: '低 (64色)', desc: '小さいファイルサイズ' },
                  { key: 'medium', label: '中 (128色)', desc: 'バランス重視' },
                  { key: 'high', label: '高 (256色)', desc: '最高品質' }
                ] as const).map(({ key, label, desc }) => (
                  <button
                    key={key}
                    onClick={() => updateSetting('quality', key)}
                    disabled={disabled}
                    className={`
                      p-4 text-sm sm:text-base rounded-lg border transition-colors text-left min-h-[56px]
                      ${settings.quality === key 
                        ? 'border-primary bg-primary/10 text-primary shadow-md' 
                        : 'border-border bg-card text-foreground hover:bg-muted hover:border-primary/30'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <div className="font-semibold">{label}</div>
                    <div className="text-xs text-secondary mt-1">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Frame Rate Setting */}
            <div className="space-y-2">
              <label className="block text-sm sm:text-base font-medium text-foreground">
                フレームレート
              </label>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {([10, 15, 24] as const).map((fps) => (
                  <button
                    key={fps}
                    onClick={() => updateSetting('frameRate', fps)}
                    disabled={disabled}
                    className={`
                      p-4 text-sm sm:text-base rounded-lg border transition-colors min-h-[48px] font-medium
                      ${settings.frameRate === fps 
                        ? 'border-primary bg-primary text-white shadow-md' 
                        : 'border-border bg-card text-foreground hover:bg-muted hover:border-primary/30'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    {fps} fps
                  </button>
                ))}
              </div>
            </div>

            {/* Copyright Setting */}
            <div className="space-y-2">
              <label className="block text-sm sm:text-base font-medium text-foreground flex items-center gap-2">
                <FontAwesomeIcon icon={faCopyright} />
                著作権表示 (オプション)
              </label>
              <input
                type="text"
                value={settings.copyright}
                onChange={(e) => updateSetting('copyright', e.target.value)}
                placeholder="著作権者名を入力"
                disabled={disabled}
                className="input text-sm sm:text-base min-h-[48px]"
              />
              <div className="flex items-start gap-3 text-xs sm:text-sm text-secondary bg-muted/30 p-3 rounded-lg">
                <FontAwesomeIcon icon={faInfoCircle} className="mt-0.5 flex-shrink-0 text-primary" />
                <span>
                  入力すると「© 名前」形式でGIFの右下に透かしが追加されます。
                  Canvas APIを使用して高品質な透かしを実現します。
                </span>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-3 sm:p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-2">
                <FontAwesomeIcon icon={faInfoCircle} className="text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm text-primary">
                  <p className="font-semibold mb-1">変換についての注意事項</p>
                  <ul className="space-y-1 text-xs sm:text-sm">
                    <li>• 動画の音声は自動的に除去されます</li>
                    <li>• 長い動画は処理に時間がかかる場合があります</li>
                    <li>• 高品質設定ではファイルサイズが大きくなる場合があります</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}