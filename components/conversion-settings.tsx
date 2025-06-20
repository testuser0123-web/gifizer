"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { faCopyright } from "@fortawesome/free-regular-svg-icons";
import {
  estimateGifSize,
  formatEstimatedGifSize,
  type VideoMetadata,
} from "@/lib/video-utils";

export interface ConversionSettings {
  size: number; // Width in pixels (180-720)
  quality: "low" | "medium" | "high";
  frameRate: 10 | 15 | 24;
  copyright: string;
}

interface ConversionSettingsProps {
  settings: ConversionSettings;
  onSettingsChange: (settings: ConversionSettings) => void;
  disabled?: boolean;
  videoMetadata?: VideoMetadata | null;
  metadataError?: string | null;
}

export function ConversionSettingsPanel({
  settings,
  onSettingsChange,
  disabled = false,
  videoMetadata,
  metadataError,
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
            <h3 className="font-semibold text-foreground text-base sm:text-lg">
              変換設定
            </h3>
          </div>
          <span
            className={`transform transition-transform text-sm ${
              isExpanded ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </button>

        {isExpanded && (
          <div className="mt-4 space-y-4 sm:space-y-5 px-2">
            {/* Size Setting */}
            <div className="space-y-3">
              <label className="block text-sm sm:text-base font-medium text-foreground">
                横幅サイズ
              </label>
              <div className="space-y-3">
                <div className="px-1">
                  <input
                    type="range"
                    min="180"
                    max="720"
                    step="5"
                    value={settings.size}
                    onChange={(e) =>
                      updateSetting("size", Number(e.target.value))
                    }
                    disabled={disabled}
                    className="w-full h-2 bg-primary rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed slider"
                  />
                </div>
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="text-secondary">180px</span>
                  <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-lg">
                    <span className="font-semibold text-primary">
                      {settings.size}px
                    </span>
                  </div>
                  <span className="text-secondary">720px</span>
                </div>
              </div>
            </div>

            {/* Quality Setting */}
            <div className="space-y-2">
              <label className="block text-sm sm:text-base font-medium text-foreground">
                品質
              </label>
              <div className="grid grid-cols-1 gap-2 sm:gap-3">
                {(
                  [
                    {
                      key: "low",
                      label: "低 (64色)",
                      desc: "小さいファイルサイズ",
                    },
                    {
                      key: "medium",
                      label: "中 (128色)",
                      desc: "バランス重視",
                    },
                    { key: "high", label: "高 (256色)", desc: "最高品質" },
                  ] as const
                ).map(({ key, label, desc }) => (
                  <button
                    key={key}
                    onClick={() => updateSetting("quality", key)}
                    disabled={disabled}
                    className={`
                      p-4 text-sm sm:text-base rounded-lg border transition-colors text-left min-h-[56px]
                      ${
                        settings.quality === key
                          ? "border-primary bg-primary/10 text-primary shadow-md"
                          : "border-border bg-card text-foreground hover:bg-muted hover:border-primary/30"
                      }
                      ${disabled ? "opacity-50 cursor-not-allowed" : ""}
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
                    onClick={() => updateSetting("frameRate", fps)}
                    disabled={disabled}
                    className={`
                      p-4 text-sm sm:text-base rounded-lg border transition-colors min-h-[48px] font-medium
                      ${
                        settings.frameRate === fps
                          ? "border-primary bg-primary text-white shadow-md"
                          : "border-border bg-card text-foreground hover:bg-muted hover:border-primary/30"
                      }
                      ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                  >
                    {fps} fps
                  </button>
                ))}
              </div>
            </div>

            {/* Copyright Setting */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm sm:text-base font-medium text-foreground">
                <FontAwesomeIcon icon={faCopyright} />
                著作権表示 (オプション)
              </label>
              <input
                type="text"
                value={settings.copyright}
                onChange={(e) => updateSetting("copyright", e.target.value)}
                placeholder="著作権者名を入力"
                disabled={disabled}
                className="input text-sm sm:text-base min-h-[48px]"
              />
              <div className="flex items-start gap-3 text-xs sm:text-sm text-secondary bg-muted/30 p-3 rounded-lg">
                <FontAwesomeIcon
                  icon={faInfoCircle}
                  className="mt-0.5 flex-shrink-0 text-primary"
                />
                <span>
                  入力すると「©名前」形式の透かしがGIFの右下に追加されます。<span className="text-red-600/70">他人の動画には使用しないでください。</span>
                </span>
              </div>
            </div>

            {/* Metadata Loading Box */}
            {!videoMetadata && !metadataError && (
              <div className="p-3 sm:p-4 bg-yellow-50/70 border border-yellow-200/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <FontAwesomeIcon
                    icon={faInfoCircle}
                    className="text-yellow-600 mt-0.5 flex-shrink-0"
                  />
                  <div className="text-sm text-yellow-700 flex-1">
                    <p className="font-semibold mb-1">再生時間を取得中...</p>
                    <p className="text-xs sm:text-sm mb-2">
                      動画の再生時間を読み込んでいます。時間がかかる場合があります。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* GIF Size Estimation */}
            {videoMetadata &&
              (() => {
                const targetHeight = Math.round(
                  settings.size / videoMetadata.aspectRatio
                );
                const estimatedSize = estimateGifSize(videoMetadata, settings);
                const sizeInfo = formatEstimatedGifSize(estimatedSize);

                return (
                  <div
                    className={`p-3 sm:p-4 rounded-lg border ${
                      sizeInfo.warningLevel === "safe"
                        ? "bg-green-50/70 border-green-200/50"
                        : sizeInfo.warningLevel === "warning"
                        ? "bg-yellow-50/70 border-yellow-200/50"
                        : "bg-red-50/70 border-red-200/50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <FontAwesomeIcon
                        icon={faInfoCircle}
                        className={`mt-0.5 flex-shrink-0 ${
                          sizeInfo.warningLevel === "safe"
                            ? "text-green-600"
                            : sizeInfo.warningLevel === "warning"
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      />
                      <div
                        className={`text-sm ${
                          sizeInfo.warningLevel === "safe"
                            ? "text-green-700"
                            : sizeInfo.warningLevel === "warning"
                            ? "text-yellow-700"
                            : "text-red-700"
                        }`}
                      >
                        <p className="font-semibold mb-1">
                          変換後のファイルサイズ予測
                        </p>
                        <ul className="space-y-1 text-xs sm:text-sm">
                          <li>
                            • 出力解像度: {settings.size} × {targetHeight}
                          </li>
                          <li>
                            • フレーム数: 約
                            {Math.round(
                              videoMetadata.duration * settings.frameRate
                            )}
                            フレーム
                          </li>
                          <li>
                            • 予想サイズ:{" "}
                            <span className="font-semibold">
                              {sizeInfo.formatted}
                            </span>
                            （動画によって大きく異なります）
                          </li>
                        </ul>
                        {sizeInfo.message && (
                          <p className="text-xs mt-2 font-medium">
                            ⚠️ {sizeInfo.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* Metadata Error Box */}
            {metadataError && (
              <div className="p-3 sm:p-4 bg-red-50/70 border border-red-200/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <FontAwesomeIcon
                    icon={faInfoCircle}
                    className="text-red-600 mt-0.5 flex-shrink-0"
                  />
                  <div className="text-sm text-red-700">
                    <p className="font-semibold mb-1">動画情報取得エラー</p>
                    <p className="text-xs sm:text-sm">{metadataError}</p>
                    <p className="text-xs text-red-600 mt-2">
                      ※ 動画の変換は通常通り実行できます
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="p-3 sm:p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-2">
                <FontAwesomeIcon
                  icon={faInfoCircle}
                  className="text-primary mt-0.5 flex-shrink-0"
                />
                <div className="text-sm text-primary">
                  <p className="font-semibold mb-1">変換についての注意事項</p>
                  <ul className="space-y-1 text-xs sm:text-sm">
                    <li>• 動画の音声は自動的に除去されます</li>
                    <li>• 長い動画は処理に時間がかかる場合があります</li>
                    <li>
                      • 高品質設定ではファイルサイズが大きくなる場合があります
                    </li>
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
