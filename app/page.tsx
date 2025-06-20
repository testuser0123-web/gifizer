'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { getFFmpegConverter, type ConversionProgress, type ConversionSettings, FFmpegConverter } from '@/lib/ffmpeg-wasm';
import { getVideoMetadata, formatDuration, formatFileSize, type VideoMetadata } from '@/lib/video-utils';
import { Header } from '@/components/header';
import { FileUpload } from '@/components/file-upload';
import { ConversionSettingsPanel } from '@/components/conversion-settings';
import { ProgressIndicator, type ProgressStep } from '@/components/progress-indicator';
import { HistoryPanel } from '@/components/history-panel';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faCopy, faExternalLink, faCheck, faDownload, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [progressStep, setProgressStep] = useState<ProgressStep>('converting');
  const [progress, setProgress] = useState(0);
  const [completedResult, setCompletedResult] = useState<{
    id: string;
    filename: string;
    originalFilename: string;
    imgurLink: string;
    deleteHash: string;
    size: number;
    timestamp: string;
    settings: ConversionSettings;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [localGifResult, setLocalGifResult] = useState<{
    gifData: Uint8Array;
    filename: string;
    originalFilename: string;
    size: number;
    settings: ConversionSettings;
    uploadError: string;
  } | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const converterRef = useRef<FFmpegConverter | null>(null);
  const [settings, setSettings] = useState<ConversionSettings>({
    size: 480,
    quality: 'medium',
    frameRate: 15,
    copyright: ''
  });
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

  useEffect(() => {
    // クライアントサイドでのみFFmpegConverterを初期化
    if (typeof window !== 'undefined') {
      converterRef.current = getFFmpegConverter();
      
      // オプション: FFmpegを事前に読み込み（コメントアウト可能）
      // 初回変換時のエラーを防ぐため
      setTimeout(() => {
        if (!ffmpegLoaded && converterRef.current) {
          console.log('🔄 Pre-loading FFmpeg...');
          loadFFmpeg(true).catch(error => {
            console.log('Pre-load failed, will retry on first use:', error);
          });
        }
      }, 2000); // 2秒後に事前読み込み
    }
  }, [ffmpegLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setVideoMetadata(null);
    setMetadataError(null);
    console.log('Selected file:', file.name, file.size, file.type);
    
    // Extract video metadata
    try {
      const metadata = await getVideoMetadata(file);
      setVideoMetadata(metadata);
      setMetadataError(null);
      console.log('Video metadata:', metadata);
    } catch (error) {
      console.error('Failed to get video metadata:', error);
      setVideoMetadata(null);
      setMetadataError(error instanceof Error ? error.message : 'メタデータの取得に失敗しました');
    }
  };

  const handleUrlSelect = async (url: string) => {
    try {
      console.log('Fetching video from URL:', url);
      setConversionError(null);
      setIsLoadingUrl(true);
      
      // サーバーサイドプロキシ経由で動画をフェッチ
      const response = await fetch('/api/fetch-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `動画の取得に失敗しました (${response.status})`);
      }
      
      const blob = await response.blob();
      const urlObj = new URL(url);
      const filename = urlObj.pathname.split('/').pop() || 'twitter-video.mp4';
      const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
      
      setSelectedFile(file);
      
      // Extract video metadata
      try {
        const metadata = await getVideoMetadata(file);
        setVideoMetadata(metadata);
        console.log('Video metadata:', metadata);
      } catch (metadataError) {
        console.error('Failed to get video metadata:', metadataError);
        setVideoMetadata(null);
      }
      
      setIsLoadingUrl(false);
      console.log('URL video loaded:', file.name, file.size, file.type);
    } catch (error) {
      console.error('URL fetch error:', error);
      setConversionError(error instanceof Error ? error.message : 'URLからの動画取得に失敗しました');
      setIsLoadingUrl(false);
    }
  };

  // サーバーサイド変換のフォールバック関数
  const handleServerSideConversion = async () => {
    if (!selectedFile) {
      throw new Error('ファイルが選択されていません');
    }
    
    setProgressStep('converting');
    setProgress(10);
    
    // FormDataを作成してサーバーに送信
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('settings', JSON.stringify(settings));
    
    setProgress(30);
    
    const response = await fetch('/api/convert', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      let errorMessage = 'サーバーサイド変換に失敗しました';
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } else {
          errorMessage = `サーバー変換エラー (${response.status})`;
        }
      } catch {
        errorMessage = `サーバー変換エラー (${response.status})`;
      }
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    setProgress(70);
    
    // Imgurにアップロード
    setProgressStep('uploading-imgur');
    setProgress(80);
    
    const uploadResponse = await fetch('/api/upload-imgur', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Gif: result.gif,
        filename: selectedFile.name.replace(/\.[^/.]+$/, '') + '.gif'
      }),
    });
    
    if (!uploadResponse.ok) {
      let errorMessage = 'アップロードに失敗しました';
      try {
        const contentType = uploadResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const error = await uploadResponse.json();
          errorMessage = error.error || errorMessage;
        } else {
          errorMessage = `アップロードエラー (${uploadResponse.status})`;
        }
      } catch {
        errorMessage = `アップロードエラー (${uploadResponse.status})`;
      }
      throw new Error(errorMessage);
    }
    
    const uploadResult = await uploadResponse.json();
    setProgress(100);
    
    // 結果をlocalStorageに保存
    const resultData = {
      id: Date.now().toString(),
      filename: selectedFile.name.replace(/\.[^/.]+$/, '') + '.gif',
      originalFilename: selectedFile.name,
      imgurLink: uploadResult.link,
      deleteHash: uploadResult.deleteHash,
      size: result.size,
      timestamp: new Date().toISOString(),
      settings: settings
    };
    
    const existingHistory = JSON.parse(localStorage.getItem('gifizer-history') || '[]');
    existingHistory.unshift(resultData);
    localStorage.setItem('gifizer-history', JSON.stringify(existingHistory));
    
    setCompletedResult(resultData);
    setProgressStep('completed');
    setIsProcessing(false);
    
    // 履歴を更新
    setHistoryRefreshTrigger(prev => prev + 1);
    
    // 完了音を再生
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PyvmQcAjZFOUFTSfHKdyQAgP');
      audio.volume = 0.3;
      await audio.play();
    } catch (e) {
      console.log('音声再生に失敗:', e);
    }
  };

  const loadFFmpeg = async (isPreload = false) => {
    if (ffmpegLoaded || !converterRef.current) {
      console.log('FFmpeg already loaded or converter not ready');
      return;
    }
    
    console.log('🚀 Starting FFmpeg load...' + (isPreload ? ' (preload)' : ''));
    
    // 事前読み込みの場合はUI状態を変更しない
    if (!isPreload) {
      setIsProcessing(true);
      setProgressStep('converting');
      setProgress(0);
      setConversionError(null);
    }
    
    try {
      await converterRef.current.load((progress: ConversionProgress) => {
        console.log('FFmpeg load progress:', progress);
        // 事前読み込みでない場合のみプログレスを表示
        if (!isPreload) {
          setProgress(progress.progress);
        }
      });
      
      console.log('✅ FFmpeg load completed, setting state...');
      setFfmpegLoaded(true);
      
      // 読み込み完了後に少し待機
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ FFmpeg fully ready');
      
    } catch (error) {
      console.error('❌ FFmpeg load error:', error);
      
      // 事前読み込みでない場合のみエラーUIを表示
      if (!isPreload) {
        setProgressStep('error');
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        setConversionError(`FFmpegの読み込みに失敗しました。\n\n詳細: ${errorMessage}\n\n対処法:\n• ページを再読み込みしてください\n• ネットワーク接続を確認してください\n• 広告ブロッカーを無効にしてみてください\n• 別のブラウザで試してみてください`);
        // FFmpeg読み込みエラー時も処理中フラグを維持
        return;
      }
    }
    
    // 事前読み込みでない場合のみUI状態をリセット
    if (!isPreload) {
      setIsProcessing(false);
    }
  };

  const handleStartConversion = async () => {
    if (!selectedFile || !converterRef.current) return;
    
    setIsProcessing(true);
    setProgressStep('converting');
    setProgress(0);
    setConversionError(null);
    
    // FFmpegがまだ読み込まれていない場合は先に読み込む
    if (!ffmpegLoaded) {
      console.log('FFmpeg not loaded yet, loading now...');
      try {
        await loadFFmpeg(false);
        console.log('FFmpeg load status after loading:', ffmpegLoaded);
        
        // 読み込み後に少し待機してFFmpegが完全に初期化されるのを確実にする
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!ffmpegLoaded) {
          throw new Error('FFmpegの読み込みに失敗しました');
        }
      } catch (loadError) {
        console.error('FFmpeg load error:', loadError);
        console.log('Fallback to server-side conversion...');
        
        // サーバーサイド変換にフォールバック
        try {
          await handleServerSideConversion();
          return;
        } catch (serverError) {
          console.error('Server-side conversion also failed:', serverError);
          setProgressStep('error');
          setConversionError('クライアントサイドとサーバーサイド両方の変換に失敗しました。ネットワーク接続を確認してください。');
          return;
        }
      }
    }
    
    try {
      // ファイルサイズチェック
      if (selectedFile.size > 100 * 1024 * 1024) { // 100MB
        throw new Error('ファイルサイズが100MBを超えています');
      }
      
      // Step 1: クライアントサイドでGIF変換
      setProgressStep('converting');
      console.log('Starting GIF conversion...');
      
      let gifData: Uint8Array;
      try {
        gifData = await converterRef.current.convertToGif(
          selectedFile,
          settings,
          (progress: ConversionProgress) => {
            console.log('Conversion progress:', progress);
            setProgress(Math.min(70, Math.round(progress.progress * 0.7))); // 70%を超えないよう制限
          }
        );
        console.log('GIF conversion completed, size:', gifData.length);
      } catch (conversionError) {
        console.error('GIF conversion failed:', conversionError);
        throw new Error(`GIF変換エラー: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
      }
      
      setProgress(70);
      
      // Step 2: ファイルサイズチェックとBase64エンコード
      console.log(`GIF size: ${(gifData.length / 1024 / 1024).toFixed(2)}MB`);
      
      // 効率的なBase64エンコード（メモリ使用量を最適化）
      let base64Gif: string;
      try {
        const chunks = [];
        const chunkSize = 0x8000; // 32KB chunks
        for (let i = 0; i < gifData.length; i += chunkSize) {
          chunks.push(String.fromCharCode(...gifData.slice(i, i + chunkSize)));
        }
        base64Gif = btoa(chunks.join(''));
        console.log(`Base64 encoded size: ${(base64Gif.length / 1024 / 1024).toFixed(2)}MB`);
        console.log(`Original GIF size: ${(gifData.length / 1024 / 1024).toFixed(2)}MB`);
        console.log(`Base64 vs Original ratio: ${(base64Gif.length / gifData.length).toFixed(2)}x`);
      } catch (encodingError) {
        console.error('Base64 encoding failed:', encodingError);
        throw new Error('ファイルが大きすぎてエンコードできませんでした。サイズを小さくしてください。');
      }
      
      // Base64エンコード後のサイズをログに出力（エラーにはしない）
      const base64SizeMB = base64Gif.length / 1024 / 1024;
      console.log(`Base64エンコード後のサイズ: ${base64SizeMB.toFixed(1)}MB`);
      if (base64SizeMB > 10) {
        console.warn(`Base64サイズが10MBを超過 (${base64SizeMB.toFixed(1)}MB) - アップロード時にエラーになる可能性`);
      }
      
      setProgress(75);
      
      // Step 3: Imgurにアップロード（直接クライアントから）
      setProgressStep('uploading-imgur');
      setProgress(80);
      
      // Vercelの4.5MB制限を回避するため、クライアントから直接Imgurにアップロード
      const clientId = process.env.NEXT_PUBLIC_IMGUR_CLIENT_ID || '74ca019c930d8ee';
      console.log('🔑 Using Client ID:', clientId);
      console.log('🔑 Environment check:', {
        hasNextPublic: !!process.env.NEXT_PUBLIC_IMGUR_CLIENT_ID,
        nodeEnv: process.env.NODE_ENV
      });
      
      const formData = new FormData();
      formData.append('image', base64Gif);
      formData.append('type', 'base64');
      formData.append('name', selectedFile.name.replace(/\.[^/.]+$/, '') + '.gif');
      formData.append('title', 'Converted by Gifizer');
      
      console.log('📤 Starting Imgur upload...');
      
      // Retry logic for rate limiting
      let uploadResponse: Response | null = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount <= maxRetries) {
        uploadResponse = await fetch('https://api.imgur.com/3/image', {
          method: 'POST',
          headers: {
            'Authorization': `Client-ID ${clientId}`,
          },
          body: formData,
        });
        
        console.log(`📤 Upload attempt ${retryCount + 1}: status ${uploadResponse.status}`);
        console.log('📤 Upload response headers:', Object.fromEntries(uploadResponse.headers.entries()));
        
        // If successful or non-retryable error, break
        if (uploadResponse.ok || (uploadResponse.status !== 429 && uploadResponse.status < 500)) {
          break;
        }
        
        // If rate limited or server error, retry with exponential backoff
        if (retryCount < maxRetries && (uploadResponse.status === 429 || uploadResponse.status >= 500)) {
          const waitTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.log(`⏳ Rate limited/server error, waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retryCount++;
        } else {
          break;
        }
      }
      
      if (!uploadResponse) {
        throw new Error('アップロードリクエストが失敗しました');
      }
      
      if (!uploadResponse.ok) {
        let errorMessage = 'アップロードに失敗しました';
        
        // Content-Typeを確認してJSONかどうか判断
        const contentType = uploadResponse.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');
        
        try {
          if (isJson) {
            const error = await uploadResponse.json();
            console.error('❌ Imgur JSON error:', error);
            errorMessage = error.data?.error || error.error || errorMessage;
          } else {
            // JSONでない場合はtextとして読み取り
            const errorText = await uploadResponse.text();
            console.error('❌ Imgur error response text:', errorText.substring(0, 500));
            
            // ステータスコードに基づいてエラーメッセージを決定
            if (uploadResponse.status === 413) {
              errorMessage = 'ファイルが大きすぎます。10MB以下にしてください。';
            } else if (uploadResponse.status === 429) {
              errorMessage = 'Imgurのアップロード制限に達しました。しばらく時間をおいてから再試行してください。（1日の制限: 1,250回）';
            } else if (uploadResponse.status === 400) {
              errorMessage = 'リクエストが無効です。Client IDを確認してください。';
            } else if (uploadResponse.status === 403) {
              errorMessage = 'アクセスが拒否されました。Client IDが無効の可能性があります。';
            } else if (uploadResponse.status >= 500) {
              errorMessage = 'サーバーエラーが発生しました。しばらく待ってから再試行してください。';
            } else {
              errorMessage = `アップロードエラー (${uploadResponse.status}): ${errorText.substring(0, 100)}`;
            }
          }
        } catch (readError) {
          console.error('❌ Failed to read error response:', readError);
          // レスポンス読み取りに失敗した場合はステータスコードのみ使用
          if (uploadResponse.status === 413) {
            errorMessage = 'ファイルが大きすぎます。10MB以下にしてください。';
          } else if (uploadResponse.status === 429) {
            errorMessage = 'アップロード制限に達しました。時間をおいて再試行してください。';
          } else {
            errorMessage = `アップロードエラー (${uploadResponse.status})`;
          }
        }
        
        // アップロード失敗時はローカルGIFとして表示
        console.warn('Upload failed, displaying local GIF:', errorMessage);
        
        setLocalGifResult({
          gifData: gifData,
          filename: selectedFile.name.replace(/\.[^/.]+$/, '') + '.gif',
          originalFilename: selectedFile.name,
          size: gifData.length,
          settings: settings,
          uploadError: errorMessage
        });
        
        setProgressStep('completed');
        setIsProcessing(false);
        
        // 完了音を再生（ローカル保存として）
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PyvmQcAjZFOUFTSfHKdyQAgP');
          audio.volume = 0.3;
          await audio.play();
        } catch (e) {
          console.log('音声再生に失敗:', e);
        }
        
        return; // 処理を完了
      }
      
      let imgurData;
      try {
        imgurData = await uploadResponse.json();
      } catch (parseError) {
        console.error('Upload response parse failed:', parseError);
        
        // JSON解析失敗もローカルGIFとして表示
        setLocalGifResult({
          gifData: gifData,
          filename: selectedFile.name.replace(/\.[^/.]+$/, '') + '.gif',
          originalFilename: selectedFile.name,
          size: gifData.length,
          settings: settings,
          uploadError: 'アップロード完了後のレスポンス解析に失敗しました'
        });
        
        setProgressStep('completed');
        setIsProcessing(false);
        return;
      }
      
      if (!imgurData.success) {
        // Imgur APIエラーもローカルGIFとして表示
        setLocalGifResult({
          gifData: gifData,
          filename: selectedFile.name.replace(/\.[^/.]+$/, '') + '.gif',
          originalFilename: selectedFile.name,
          size: gifData.length,
          settings: settings,
          uploadError: 'Imgurアップロードが失敗しました'
        });
        
        setProgressStep('completed');
        setIsProcessing(false);
        return;
      }
      
      setProgress(100);
      
      // 結果をlocalStorageに保存
      const resultData = {
        id: Date.now().toString(),
        filename: selectedFile.name.replace(/\.[^/.]+$/, '') + '.gif',
        originalFilename: selectedFile.name,
        imgurLink: imgurData.data.link,
        deleteHash: imgurData.data.deletehash,
        size: gifData.length,
        timestamp: new Date().toISOString(),
        settings: settings
      };
      
      const existingHistory = JSON.parse(localStorage.getItem('gifizer-history') || '[]');
      existingHistory.unshift(resultData);
      localStorage.setItem('gifizer-history', JSON.stringify(existingHistory));
      
      setCompletedResult(resultData);
      setProgressStep('completed');
      setIsProcessing(false); // 完了時は処理フラグを解除
      
      // 履歴を更新
      setHistoryRefreshTrigger(prev => prev + 1);
      
      // 完了音を再生
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+PyvmQcAjZFOUFTSfHKdyQAgP');
        audio.volume = 0.3;
        await audio.play();
      } catch (e) {
        console.log('音声再生に失敗:', e);
      }
      
    } catch (error) {
      console.error('Conversion error:', error);
      setProgressStep('error');
      setConversionError(error instanceof Error ? error.message : '変換中に不明なエラーが発生しました');
      
      // エラー音を再生
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRhgDAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YfQCAAC4uLgi4uLi4uLi4uLi4uLi4uLi4');
        audio.volume = 0.2;
        await audio.play();
      } catch (e) {
        console.log('エラー音声再生に失敗:', e);
      }
      
      // エラー時はisProcessingは維持する（エラー画面を表示するため）
      // resetボタンでのみ解除される
      return;
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setVideoMetadata(null);
    setMetadataError(null);
    setCompletedResult(null);
    setLocalGifResult(null);
    setProgressStep('converting');
    setProgress(0);
    setConversionError(null);
    setIsProcessing(false); // 処理中フラグもリセット
    setIsLoadingUrl(false); // URL読み込みフラグもリセット
  };

  // サンプル動画でのテスト関数
  const testWithSampleVideo = async () => {
    console.log('Testing conversion with sample video...');
    
    try {
      // サンプル動画を読み込み
      const response = await fetch('/sample.mp4');
      if (!response.ok) {
        throw new Error('Sample video not found');
      }
      
      const videoBuffer = await response.arrayBuffer();
      const videoFile = new File([videoBuffer], 'sample.mp4', { type: 'video/mp4' });
      
      console.log('Sample video loaded:', videoFile.size, 'bytes');
      
      // ファイルを選択状態にしてテスト
      setSelectedFile(videoFile);
      
      // 自動的に変換開始
      setTimeout(() => {
        handleStartConversion();
      }, 1000);
      
    } catch (error) {
      console.error('Test failed:', error);
      setConversionError(error instanceof Error ? error.message : 'Test failed');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('クリップボードへのコピーに失敗:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-col items-center space-y-4 sm:space-y-6">
          {/* Hero Section */}
          <div className="text-center space-y-2 sm:space-y-3 max-w-4xl px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground leading-tight">
              動画を簡単にGIFに変換
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-secondary max-w-2xl mx-auto leading-relaxed">
              様々な形式の動画を無音のGIFに変換し、Imgurに自動アップロード。シンプルで高速、モバイル対応のGIF変換サービスです。
            </p>
          </div>

          {/* Notice Banner */}
          <div className="w-full max-w-4xl px-4 sm:px-6">
            <div className="bg-yellow-50/70 border border-yellow-200/50 rounded-lg p-3 sm:p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <span className="text-yellow-600 text-lg flex-shrink-0 mt-0.5">📢</span>
                <div>
                  <h3 className="font-semibold text-yellow-800 text-sm sm:text-base mb-1">お知らせ</h3>
                  <p className="text-yellow-700 text-xs sm:text-sm leading-relaxed">
                    変換後のサイズが大きすぎるとアップロードできない場合があります。その場合は適宜設定を調整してください。
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          {!selectedFile && !isProcessing && !completedResult && !isLoadingUrl && (
            <div className="w-full max-w-2xl mx-auto px-4">
              <div className="card card-lg">
                <div className="p-6 sm:p-8">
                  <FileUpload 
                    onFileSelect={handleFileSelect}
                    onUrlSelect={handleUrlSelect}
                    disabled={isProcessing || isLoadingUrl}
                  />
                  
                  {/* Development Test Button - 開発環境でのみ表示 */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={testWithSampleVideo}
                        className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                        title="Test conversion with sample video (dev only)"
                      >
                        🧪 Test with Sample Video
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* URL Loading Screen */}
          {isLoadingUrl && (
            <div className="w-full max-w-2xl px-4">
              <div className="card p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <FontAwesomeIcon icon={faSpinner} className="text-primary text-2xl animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">動画を読み込み中...</h3>
                  <p className="text-sm text-secondary">URLから動画をダウンロードしています</p>
                </div>
              </div>
            </div>
          )}

          {/* Selected File Info and Settings */}
          {selectedFile && !isProcessing && !completedResult && (
            <div className="w-full max-w-2xl space-y-4 sm:space-y-5 px-4">
              <div className="card p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-foreground text-sm sm:text-base">選択されたファイル</h4>
                    <p className="text-xs sm:text-sm text-secondary truncate">{selectedFile.name}</p>
                    <div className="text-xs text-secondary space-y-1">
                      <p>{formatFileSize(selectedFile.size)}</p>
                      {videoMetadata && (
                        <>
                          <p>長さ: {formatDuration(videoMetadata.duration)}</p>
                          <p>解像度: {videoMetadata.width} × {videoMetadata.height}</p>
                          {/* <p>アスペクト比: {videoMetadata.aspectRatio.toFixed(2)}</p> */}
                        </>
                      )}
                      {metadataError && (
                        <p className="text-orange-600 text-xs">ℹ️ {metadataError}</p>
                      )}
                      {!videoMetadata && !metadataError && (
                        <p className="text-yellow-600">再生時間取得中...</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setVideoMetadata(null);
                      setMetadataError(null);
                    }}
                    className="btn btn-secondary text-xs sm:text-sm ml-3 px-3 py-2"
                  >
                    クリア
                  </button>
                </div>
              </div>

              {/* Conversion Settings */}
              <ConversionSettingsPanel
                settings={settings}
                onSettingsChange={setSettings}
                disabled={isProcessing}
                videoMetadata={videoMetadata}
                metadataError={metadataError}
              />

              {/* Start Conversion Button */}
              <div className="text-center pt-3 sm:pt-4 px-4">
                <button
                  onClick={handleStartConversion}
                  disabled={isProcessing}
                  className="btn btn-primary text-base sm:text-lg px-8 sm:px-12 py-4 shadow-lg w-full max-w-xs sm:max-w-sm mx-auto"
                >
                  <FontAwesomeIcon icon={faPlay} />
                  {isProcessing ? '変換中...' : 
                   !ffmpegLoaded ? 'FFmpeg読み込み & GIF変換' : 
                   'GIF変換を開始'}
                </button>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {isProcessing && (
            <div className="w-full max-w-2xl px-4">
              <ProgressIndicator
                step={progressStep}
                progress={progress}
                error={conversionError || undefined}
              />
              {progressStep === 'error' && (
                <div className="mt-4 sm:mt-5 text-center px-4">
                  <button
                    onClick={handleReset}
                    className="btn btn-secondary text-base px-6 py-3"
                  >
                    やり直す
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Completed Result - Successful Upload */}
          {completedResult && !isProcessing && (
            <div className="w-full max-w-2xl px-4">
              <div className="card p-4 sm:p-6 text-center space-y-4 sm:space-y-5 shadow-xl">
                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                  <FontAwesomeIcon icon={faCheck} className="text-success text-2xl" />
                </div>
                
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-success mb-2">変換完了！</h3>
                  <p className="text-sm sm:text-base text-secondary">GIFが正常に作成され、Imgurにアップロードされました</p>
                </div>

                {/* GIF Preview */}
                <div className="flex justify-center">
                  <Image
                    src={completedResult.imgurLink}
                    alt={completedResult.filename}
                    width={400}
                    height={300}
                    className="max-w-full max-h-64 rounded-lg border border-border object-contain"
                    unoptimized
                  />
                </div>

                {/* File Info */}
                <div className="bg-muted/50 rounded-lg p-3 sm:p-4 text-left">
                  <h4 className="font-medium text-foreground mb-2 text-sm sm:text-base">ファイル情報</h4>
                  <div className="space-y-1 text-xs sm:text-sm text-secondary">
                    <div className="truncate">ファイル名: {completedResult.filename}</div>
                    <div>サイズ: {(completedResult.size / (1024 * 1024)).toFixed(2)} MB</div>
                    <div>設定: {completedResult.settings.size}, {completedResult.settings.quality}品質, {completedResult.settings.frameRate}fps</div>
                    {completedResult.settings.copyright && (
                      <div className="truncate">著作権: © {completedResult.settings.copyright}</div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                  <button
                    onClick={() => copyToClipboard(completedResult.imgurLink)}
                    className="btn btn-primary text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3"
                  >
                    <FontAwesomeIcon icon={copiedLink ? faCheck : faCopy} />
                    {copiedLink ? 'コピー済み' : 'リンクをコピー'}
                  </button>
                  
                  <a
                    href={completedResult.imgurLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3"
                  >
                    <FontAwesomeIcon icon={faExternalLink} />
                    新しいタブで開く
                  </a>
                  
                  <button
                    onClick={handleReset}
                    className="btn btn-secondary text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3"
                  >
                    新しいファイルを変換
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Local GIF Result - Upload Failed */}
          {localGifResult && !isProcessing && (
            <div className="w-full max-w-2xl px-4">
              <div className="card p-4 sm:p-6 text-center space-y-4 sm:space-y-5 shadow-xl border-yellow-500/20">
                <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-yellow-500 text-2xl">⚠️</span>
                </div>
                
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-yellow-600 mb-2">変換完了（ローカル保存）</h3>
                  <p className="text-sm sm:text-base text-secondary mb-2">GIFの変換は完了しましたが、アップロードに失敗しました</p>
                  <p className="text-xs sm:text-sm text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                    エラー: {localGifResult.uploadError}
                  </p>
                </div>

                {/* Local GIF Preview */}
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(new Blob([localGifResult.gifData], { type: 'image/gif' }))}
                    alt={localGifResult.filename}
                    className="max-w-full max-h-64 rounded-lg border border-border object-contain"
                  />
                </div>

                {/* File Info */}
                <div className="bg-muted/50 rounded-lg p-3 sm:p-4 text-left">
                  <h4 className="font-medium text-foreground mb-2 text-sm sm:text-base">ファイル情報</h4>
                  <div className="space-y-1 text-xs sm:text-sm text-secondary">
                    <div className="truncate">ファイル名: {localGifResult.filename}</div>
                    <div>元ファイル: {localGifResult.originalFilename}</div>
                    <div>サイズ: {(localGifResult.size / (1024 * 1024)).toFixed(2)} MB</div>
                    <div>設定: {localGifResult.settings.size}, {localGifResult.settings.quality}品質, {localGifResult.settings.frameRate}fps</div>
                    {localGifResult.settings.copyright && (
                      <div className="truncate">著作権: © {localGifResult.settings.copyright}</div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                  <button
                    onClick={() => {
                      const blob = new Blob([localGifResult.gifData], { type: 'image/gif' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = localGifResult.filename;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="btn btn-primary text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3"
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    GIFをダウンロード
                  </button>
                  
                  <button
                    onClick={() => {
                      setLocalGifResult(null);
                      handleReset();
                    }}
                    className="btn btn-secondary text-sm sm:text-base px-4 py-2 sm:px-6 sm:py-3"
                  >
                    新しいファイルを変換
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History Panel */}
          <div className="w-full max-w-2xl px-4">
            <HistoryPanel 
              onRefresh={() => {}} 
              refreshTrigger={historyRefreshTrigger}
            />
          </div>

          {/* Features Section */}
          <div className="w-full max-w-5xl pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
              <div className="card p-4 sm:p-6 text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <span className="text-primary text-lg sm:text-xl">🎬</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-sm sm:text-base">多様な形式対応</h3>
                <p className="text-xs sm:text-sm text-secondary">
                  MP4, AVI, MOV, MKV, WebMなど主要な動画形式をサポート
                </p>
              </div>
              
              <div className="card p-4 sm:p-6 text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <span className="text-primary text-lg sm:text-xl">⚡</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-sm sm:text-base">高速変換</h3>
                <p className="text-xs sm:text-sm text-secondary">
                  最適化されたFFmpegエンジンで高速かつ高品質な変換を実現
                </p>
              </div>
              
              <div className="card p-4 sm:p-6 text-center sm:col-span-2 md:col-span-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <span className="text-primary text-lg sm:text-xl">☁️</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-sm sm:text-base">自動アップロード</h3>
                <p className="text-xs sm:text-sm text-secondary">
                  変換完了後、Imgurに自動アップロードして共有リンクを生成
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
