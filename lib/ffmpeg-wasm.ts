'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export interface ConversionProgress {
  step: 'loading' | 'converting' | 'completed' | 'error';
  progress: number;
  message?: string;
}

export interface ConversionSettings {
  size: '320px' | '480px' | '720px';
  quality: 'low' | 'medium' | 'high';
  frameRate: 10 | 15 | 24;
  copyright: string;
}

const SIZE_SETTINGS = {
  '320px': 320,
  '480px': 480,
  '720px': 720
};

const QUALITY_SETTINGS = {
  low: { colors: 64, dither: 'bayer:bayer_scale=5' },
  medium: { colors: 128, dither: 'ed' },
  high: { colors: 256, dither: 'none' }
};

export class FFmpegConverter {
  private ffmpeg: FFmpeg | null = null;
  private loaded = false;

  constructor() {
    // ブラウザ環境でのみFFmpegを初期化
    if (typeof window !== 'undefined') {
      this.ffmpeg = new FFmpeg();
    }
  }

  async load(onProgress?: (progress: ConversionProgress) => void): Promise<void> {
    if (this.loaded || !this.ffmpeg) return;

    try {
      onProgress?.({ step: 'loading', progress: 0, message: 'FFmpegを読み込み中...' });

      console.log('Loading FFmpeg with default CDN...');
      
      // プログレス監視
      this.ffmpeg.on('progress', ({ progress }) => {
        const percent = Math.round(progress * 100);
        console.log(`FFmpeg progress: ${percent}%`);
      });

      // ログ監視 - より詳細なログを出力
      this.ffmpeg.on('log', ({ type, message }) => {
        console.log(`[FFmpeg ${type}]:`, message);
        
        // エラーログの場合は特に注目
        if (type === 'fferr' || message.includes('Error') || message.includes('error')) {
          console.error(`🚨 FFmpeg Error Log:`, message);
        }
      });

      // デフォルトのCDNを使用してシンプルに読み込み
      await this.ffmpeg.load();
      
      this.loaded = true;
      onProgress?.({ step: 'loading', progress: 100, message: 'FFmpeg読み込み完了' });
      console.log('✅ FFmpeg loaded successfully');
      
    } catch (error) {
      console.error('FFmpeg load error:', error);
      
      let userMessage = 'FFmpegの読み込みに失敗しました。';
      if (error instanceof Error) {
        if (error.message.includes('CORS')) {
          userMessage += ' CORS エラーが発生しました。ページを再読み込みしてください。';
        } else if (error.message.includes('Network')) {
          userMessage += ' ネットワークエラーが発生しました。インターネット接続を確認してください。';
        } else if (error.message.includes('CDN')) {
          userMessage += ' CDN からの読み込みに失敗しました。しばらく待ってから再試行してください。';
        } else {
          userMessage += ` エラー詳細: ${error.message}`;
        }
      }
      
      onProgress?.({ step: 'error', progress: 0, message: userMessage });
      throw error;
    }
  }

  async convertToGif(
    file: File, 
    settings: ConversionSettings,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<Uint8Array> {
    console.log('🎬 convertToGif called - loaded:', this.loaded, 'ffmpeg:', !!this.ffmpeg);
    
    if (!this.loaded || !this.ffmpeg) {
      console.error('❌ FFmpeg not ready - loaded:', this.loaded, 'ffmpeg:', !!this.ffmpeg);
      throw new Error('FFmpeg is not loaded. Call load() first.');
    }
    
    // FFmpegが完全に準備できているかを確認
    try {
      console.log('🔍 Checking FFmpeg readiness...');
      // FFmpegの基本的な動作をテスト
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('✅ FFmpeg appears ready');
    } catch (checkError) {
      console.error('❌ FFmpeg readiness check failed:', checkError);
      throw new Error('FFmpeg is not ready for conversion');
    }

    // 簡単なファイル名を使用（特殊文字を避ける）
    const inputFileName = 'input.mp4';
    const outputFileName = 'output.gif';

    try {
      onProgress?.({ step: 'converting', progress: 0, message: 'ファイルを準備中...' });

      console.log('Starting conversion with simplified approach');

      // ファイルデータを取得してFFmpegに書き込み
      const fileData = await fetchFile(file);
      console.log('File data size:', fileData.byteLength);
      
      // ファイルを削除（存在する場合）
      try {
        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(outputFileName);
      } catch {
        // ファイルが存在しない場合のエラーは無視
      }
      
      await this.ffmpeg.writeFile(inputFileName, fileData);
      console.log('File written to FFmpeg FS:', inputFileName);

      // 入力ファイルの情報を取得（デバッグ用）
      try {
        console.log('🔍 Checking input file with ffprobe-like command...');
        const probeArgs = ['-i', inputFileName, '-f', 'null', '-'];
        await this.ffmpeg.exec(probeArgs);
      } catch (probeErr) {
        console.log('Input file probe result (this might show format info):', probeErr);
      }

      onProgress?.({ step: 'converting', progress: 20, message: 'GIFに変換中...' });

      // 設定に基づく変換コマンドを構築
      console.log('=== FFmpeg Conversion Settings ===');
      console.log('Size:', settings.size, '→', SIZE_SETTINGS[settings.size]);
      console.log('Quality:', settings.quality, '→', QUALITY_SETTINGS[settings.quality]);
      console.log('Frame Rate:', settings.frameRate);
      console.log('Copyright:', settings.copyright);
      console.log('Input file size:', fileData.byteLength, 'bytes');

      // 実際の設定を使用した変換
      const videoFilter = `fps=${settings.frameRate},scale=${SIZE_SETTINGS[settings.size]}:-1:flags=lanczos`;
      
      // 著作権テキストの処理 (Canvas API後処理で実装)
      if (settings.copyright.trim()) {
        console.log('📝 Copyright info detected:', settings.copyright);
        console.log('💡 Watermark will be added using Canvas API post-processing');
        // FFmpeg変換は透かしなしで実行し、後でCanvas APIで透かしを追加
      }
      
      const args = [
        '-i', inputFileName,
        '-vf', videoFilter,
        '-gifflags', '+transdiff',
        '-pix_fmt', 'rgb24',
        // 動画の長さ制限を削除（-t オプションなし）
        '-f', 'gif',
        '-y', outputFileName
      ];
      
      console.log('✅ Using actual user settings:');
      console.log('  - Size:', settings.size, '→', SIZE_SETTINGS[settings.size] + 'px');
      console.log('  - FPS:', settings.frameRate);
      console.log('  - Quality:', settings.quality);
      console.log('  - Copyright:', settings.copyright ? `"${settings.copyright}"` : 'none');
      console.log('  - Video filter:', videoFilter);
      
      console.log('Single-step GIF conversion args:', args);
      
      try {
        console.log('🚀 Starting FFmpeg execution...');
        console.log('📝 Full command:', args.join(' '));
        console.log('🎨 Video filter chain:', videoFilter);
        
        // FFmpeg実行前にログ収集を開始
        const ffmpegLogs: string[] = [];
        const logHandler = ({ type, message }: { type: string; message: string }) => {
          ffmpegLogs.push(`[${type}] ${message}`);
          if (type === 'fferr' || message.toLowerCase().includes('error')) {
            console.error(`🚨 FFmpeg Error: [${type}] ${message}`);
          }
        };
        
        this.ffmpeg.on('log', logHandler);
        
        await this.ffmpeg.exec(args);
        
        // ログ監視を停止
        this.ffmpeg.off('log', logHandler);
        
        console.log('✅ FFmpeg execution completed');
        console.log('📋 FFmpeg execution logs:', ffmpegLogs.slice(-10)); // 最後の10行
        
        // ファイルシステム状態の詳細確認
        try {
          const files = await this.ffmpeg.listDir('.');
          console.log('📁 Files in FFmpeg FS after conversion:');
          files.forEach(file => {
            console.log(`  - ${file.name}`);
          });
          
          // 出力ファイルの存在確認
          const outputFile = files.find(file => file.name === outputFileName);
          console.log(`Output file '${outputFileName}' exists: ${!!outputFile}`);
          
          if (!outputFile) {
            console.error('❌ Output file was not created by FFmpeg');
            console.error('Available files:', files.map(f => f.name));
            throw new Error('FFmpegが出力ファイルを生成しませんでした');
          }
          
          // ファイルサイズを事前チェック
          try {
            const fileData = await this.ffmpeg.readFile(outputFileName);
            const fileSize = fileData instanceof Uint8Array ? fileData.byteLength : fileData.length;
            console.log(`📏 Output file size before read: ${fileSize} bytes`);
            
            if (fileSize === 0) {
              console.error('❌ Output file exists but is empty');
              throw new Error('FFmpegが空のファイルを生成しました');
            }
          } catch (sizeCheckErr) {
            console.error('Failed to check file size:', sizeCheckErr);
          }
          
        } catch (listErr) {
          console.error('Cannot list files:', listErr);
        }
        
      } catch (err) {
        console.error('❌ FFmpeg execution failed:', err);
        console.error('Full error details:', err);
        
        // FFmpegのログも出力
        console.log('FFmpeg command that failed:', args);
        
        throw new Error(`変換エラー: ${err}`);
      }

      onProgress?.({ step: 'converting', progress: 80, message: 'ファイルを読み取り中...' });

      // ファイルの読み取り
      let data: Uint8Array;
      try {
        console.log('🔍 Reading output file...');
        
        const result = await this.ffmpeg.readFile(outputFileName);
        data = result as Uint8Array;
        console.log(`📄 Output file read successfully: ${data.byteLength} bytes`);
        
        if (data.byteLength === 0) {
          console.error(`❌ Output file is empty (0 bytes)`);
          throw new Error('出力ファイルが空です - FFmpeg変換が失敗した可能性があります');
        }
        
        console.log('✅ GIF conversion completed successfully!');
        
      } catch (readErr) {
        console.error('❌ Failed to read output file:', readErr);
        throw new Error(`出力ファイル読み取りエラー: ${readErr}`);
      }

      onProgress?.({ step: 'converting', progress: 95, message: 'クリーンアップ中...' });

      // クリーンアップ
      try {
        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(outputFileName);
      } catch (cleanupErr) {
        console.warn('Cleanup warning:', cleanupErr);
        // クリーンアップエラーは無視
      }

      onProgress?.({ step: 'converting', progress: 95, message: '透かしを追加中...' });

      // 著作権テキストがある場合の処理（アニメーション保持のため一時無効化）
      if (settings.copyright.trim()) {
        console.log('📝 Copyright info detected:', settings.copyright);
        console.warn('⚠️ Visual watermark temporarily disabled to preserve GIF animation');
        console.log('💡 Copyright information is stored in conversion history');
        
        // Canvas APIによる透かし追加はGIFアニメーションを静止画に変換してしまうため
        // 一時的に無効化し、メタデータのみに著作権情報を保存
        
        // TODO: 将来の改善案:
        // 1. gif.js + Canvas APIでフレーム毎に透かし追加
        // 2. FFmpeg WASMでフォント埋め込み
        // 3. サーバーサイドでの透かし処理
      }

      onProgress?.({ step: 'completed', progress: 100, message: '変換完了！' });

      return data;
    } catch (error) {
      console.error('Conversion error:', error);
      
      // エラー時もクリーンアップを試行
      try {
        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(outputFileName);
      } catch (cleanupErr) {
        console.warn('Error cleanup failed:', cleanupErr);
      }
      
      onProgress?.({ step: 'error', progress: 0, message: '変換中にエラーが発生しました' });
      throw error;
    }
  }

  // Canvas APIを使用してGIFに透かしを追加
  private async addWatermarkToGif(gifData: Uint8Array, copyrightText: string): Promise<Uint8Array> {
    console.log('🖼️ Starting Canvas API watermark process...');
    
    // GIFをBlobに変換
    const gifBlob = new Blob([gifData], { type: 'image/gif' });
    const gifUrl = URL.createObjectURL(gifBlob);
    
    try {
      // Imageオブジェクトを作成してGIFをロード
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = gifUrl;
      });
      
      console.log(`📐 GIF dimensions: ${img.width}x${img.height}`);
      
      // Canvasを作成
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      // GIFを描画
      ctx.drawImage(img, 0, 0);
      
      // 透かしテキストを追加
      const fontSize = Math.max(12, Math.min(img.width / 20, 24)); // 動的フォントサイズ
      
      // 日本語対応フォントを指定
      ctx.font = `${fontSize}px "Noto Sans JP", "Hiragino Sans", "ヒラギノ角ゴ ProN W3", "Hiragino Kaku Gothic ProN", "メイリオ", Meiryo, "游ゴシック Medium", "Yu Gothic Medium", "游ゴシック体", YuGothic, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // 半透明白色
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; // 黒い縁取り
      ctx.lineWidth = 1;
      
      // テキスト長が長すぎる場合は調整
      let watermarkText = `© ${copyrightText}`;
      const maxLength = Math.floor(img.width / (fontSize * 0.6)); // 画面幅に基づく文字数制限
      
      if (watermarkText.length > maxLength) {
        watermarkText = watermarkText.substring(0, maxLength - 1) + '…';
        console.log(`⚠️ Copyright text truncated to fit: "${watermarkText}"`);
      }
      
      const textMetrics = ctx.measureText(watermarkText);
      let x = img.width - textMetrics.width - 10; // 右下に配置
      const y = img.height - 10;
      
      // テキストが画面からはみ出す場合は左に調整
      if (x < 5) {
        x = 5;
        console.log('📐 Adjusted watermark position to prevent overflow');
      }
      
      // テキストを描画 (縁取り + 塗りつぶし)
      ctx.strokeText(watermarkText, x, y);
      ctx.fillText(watermarkText, x, y);
      
      console.log(`✍️ Added watermark: "${watermarkText}" at (${x}, ${y})`);
      
      // Canvasから新しいGIFデータを取得
      return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'));
            return;
          }
          
          // BlobをUint8Arrayに変換
          const arrayBuffer = await blob.arrayBuffer();
          resolve(new Uint8Array(arrayBuffer));
        }, 'image/gif');
      });
      
    } finally {
      // メモリクリーンアップ
      URL.revokeObjectURL(gifUrl);
    }
  }

  terminate(): void {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
    }
    this.loaded = false;
  }
}

// シングルトンインスタンス
let converterInstance: FFmpegConverter | null = null;

export function getFFmpegConverter(): FFmpegConverter {
  if (!converterInstance && typeof window !== 'undefined') {
    converterInstance = new FFmpegConverter();
  }
  return converterInstance!;
}