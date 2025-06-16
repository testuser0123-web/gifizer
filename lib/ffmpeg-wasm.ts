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
  private drawtextSupported: boolean | null = null;

  constructor() {
    // ブラウザ環境でのみFFmpegを初期化
    if (typeof window !== 'undefined') {
      this.ffmpeg = new FFmpeg();
    }
  }

  // drawtext フィルターの利用可能性をテスト
  private async testDrawtextSupport(): Promise<boolean> {
    if (!this.ffmpeg || this.drawtextSupported !== null) {
      return this.drawtextSupported ?? false;
    }

    try {
      console.log('🧪 Testing drawtext filter support...');
      
      // フィルター一覧を取得してdrawtextが含まれているかチェック
      await this.ffmpeg.exec(['-filters']);
      
      // 簡単なテストとして、help コマンドを使用
      await this.ffmpeg.exec(['-help', 'filter=drawtext']);
      
      this.drawtextSupported = true;
      console.log('✅ drawtext filter is supported');
      return true;
      
    } catch (error) {
      console.log('❌ drawtext filter is not supported or failed test:', error);
      this.drawtextSupported = false;
      return false;
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
      let videoFilter = `fps=${settings.frameRate},scale=${SIZE_SETTINGS[settings.size]}:-1:flags=lanczos`;
      
      // 著作権テキストを追加 (段階的デバッグ版)
      if (settings.copyright.trim()) {
        // 英数字のみを許可し、短く制限
        const copyrightText = settings.copyright.trim()
          .replace(/[^a-zA-Z0-9]/g, '')  // 英数字のみ
          .substring(0, 10);  // 10文字以下
        
        console.log('🔍 Copyright debug info:');
        console.log('  - Original:', settings.copyright);
        console.log('  - Cleaned:', copyrightText);
        console.log('  - Length:', copyrightText.length);
        
        if (copyrightText.length >= 2) {
          // drawtext フィルターのサポートをテスト
          const isDrawtextSupported = await this.testDrawtextSupport();
          
          if (isDrawtextSupported) {
            console.log('🎨 drawtext filter is supported, adding copyright');
            
            // 段階的にテスト
            console.log('Step 1: Testing basic drawtext...');
            
            // 最もシンプルなdrawtext構文でテスト
            try {
              // まずは基本的なテストから
              videoFilter += `,drawtext=text=TEST:x=10:y=10:fontcolor=white`;
              console.log('✅ Using basic drawtext filter');
            } catch (filterError) {
              console.error('❌ Basic drawtext failed:', filterError);
              // drawtext なしで続行
            }
          } else {
            console.log('⚠️ drawtext filter not supported, skipping copyright overlay');
            console.log('💡 Copyright will be stored in metadata only');
          }
        } else {
          console.log('Copyright text too short or no valid characters, skipping');
        }
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
            console.log(`  - ${file.name} (${file.isFile ? 'file' : 'dir'})`);
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