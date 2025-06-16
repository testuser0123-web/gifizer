import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

interface ConversionSettings {
  size: '320px' | '480px' | '720px';
  quality: 'low' | 'medium' | 'high';
  frameRate: 10 | 15 | 24;
  copyright: string;
}

// FFmpegのパスを設定 (Vercelなどではカスタムバイナリが必要)
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
  console.log('Using custom FFmpeg path:', process.env.FFMPEG_PATH);
} else {
  console.log('Using system FFmpeg');
}

const QUALITY_SETTINGS = {
  low: { colors: 64, dither: 'bayer:bayer_scale=5' },
  medium: { colors: 128, dither: 'ed' },
  high: { colors: 256, dither: 'none' }
};

const SIZE_SETTINGS = {
  '320px': 320,
  '480px': 480,
  '720px': 720
};

export async function POST(request: NextRequest) {
  console.log('Convert API called');
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const settingsJson = formData.get('settings') as string;
    
    console.log('File:', file?.name, file?.size);
    console.log('Settings:', settingsJson);
    
    if (!file) {
      console.error('No file provided');
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
    }

    const settings: ConversionSettings = JSON.parse(settingsJson);
    console.log('Parsed settings:', settings);
    
    // 一時ディレクトリの作成
    const tmpDir = path.join(process.cwd(), 'tmp');
    console.log('Temp directory:', tmpDir);
    
    if (!existsSync(tmpDir)) {
      console.log('Creating temp directory');
      await mkdir(tmpDir, { recursive: true });
    }

    // ファイルの保存
    const buffer = Buffer.from(await file.arrayBuffer());
    const inputPath = path.join(tmpDir, `input_${Date.now()}_${file.name}`);
    const outputPath = path.join(tmpDir, `output_${Date.now()}.gif`);
    
    console.log('Input path:', inputPath);
    console.log('Output path:', outputPath);
    
    await writeFile(inputPath, buffer);
    console.log('File written successfully');

    // FFmpegの利用可能性をテスト
    try {
      await new Promise<void>((resolve, reject) => {
        const testProcess = ffmpeg()
          .input(inputPath)
          .format('null')
          .duration(0.1)
          .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('end', () => {
            console.log('FFmpeg test successful');
            resolve();
          })
          .on('error', (err: Error) => {
            console.error('FFmpeg test failed:', err.message);
            reject(err);
          });
        
        // Linuxの場合は /dev/null、Windowsの場合は nul
        const nullOutput = process.platform === 'win32' ? 'nul' : '/dev/null';
        testProcess.output(nullOutput).run();
      });
    } catch (testError) {
      console.error('FFmpeg is not available:', testError);
      
      // 開発環境でのデモ用: 環境変数でダミーモードを有効にできる
      if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
        console.log('Demo mode: returning dummy GIF data');
        
        // 一時ファイルを削除
        await Promise.all([
          unlink(inputPath).catch(() => {}),
        ]);
        
        // ダミーのGIFデータ（1x1ピクセルの透明GIF）
        const dummyGifBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        
        return NextResponse.json({
          success: true,
          gif: dummyGifBase64,
          size: 43,
          mimeType: 'image/gif',
          demo: true
        });
      }
      
      // エラーメッセージをより分かりやすく
      const errorMessage = testError instanceof Error ? testError.message : 'Unknown error';
      if (errorMessage.includes('ENOENT') || errorMessage.includes('command not found')) {
        throw new Error('FFmpegがインストールされていません。サーバー管理者にお問い合わせください。');
      } else {
        throw new Error(`FFmpegエラー: ${errorMessage}`);
      }
    }

    // パレットファイルを生成
    const paletteFile = path.join(tmpDir, `palette_${Date.now()}.png`);

    try {
      // Step 1: パレット生成
      let paletteFilter = `fps=${settings.frameRate},scale=${SIZE_SETTINGS[settings.size]}:-1:flags=lanczos`;
      if (settings.copyright.trim()) {
        const copyrightText = settings.copyright.trim().replace(/'/g, "\\'");
        paletteFilter += `,drawtext=text='© ${copyrightText}':fontcolor=white:fontsize=16:x=10:y=h-30:alpha=0.8`;
      }
      paletteFilter += `,palettegen=max_colors=${QUALITY_SETTINGS[settings.quality].colors}:reserve_transparent=0`;

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .videoFilters(paletteFilter)
          .save(paletteFile)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err));
      });

      // Step 2: GIF生成
      let gifFilter = `fps=${settings.frameRate},scale=${SIZE_SETTINGS[settings.size]}:-1:flags=lanczos`;
      if (settings.copyright.trim()) {
        const copyrightText = settings.copyright.trim().replace(/'/g, "\\'");
        gifFilter += `,drawtext=text='© ${copyrightText}':fontcolor=white:fontsize=16:x=10:y=h-30:alpha=0.8`;
      }

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(inputPath)
          .input(paletteFile)
          .complexFilter([
            `[0:v]${gifFilter}[x]`,
            `[x][1:v]paletteuse=dither=${QUALITY_SETTINGS[settings.quality].dither}`
          ])
          .format('gif')
          .on('progress', (progress) => {
            console.log(`Processing: ${progress.percent}% done`);
          })
          .on('end', () => {
            console.log('FFmpeg processing finished');
            resolve();
          })
          .on('error', (err: Error) => {
            console.error('FFmpeg error:', err);
            reject(err);
          })
          .save(outputPath);
      });

      // 変換されたGIFファイルを読み取り
      const gifBuffer = await import('fs').then(fs => 
        fs.promises.readFile(outputPath)
      );

      // 一時ファイルの削除
      await Promise.all([
        unlink(inputPath).catch(() => {}),
        unlink(outputPath).catch(() => {}),
        unlink(paletteFile).catch(() => {})
      ]);

      // Base64エンコードして返す
      const base64Gif = gifBuffer.toString('base64');
      
      return NextResponse.json({
        success: true,
        gif: base64Gif,
        size: gifBuffer.length,
        mimeType: 'image/gif'
      });

    } catch (conversionError) {
      // エラー時の一時ファイル削除
      await Promise.all([
        unlink(inputPath).catch(() => {}),
        unlink(outputPath).catch(() => {})
      ]);
      
      throw conversionError;
    }

  } catch (error) {
    console.error('Conversion error:', error);
    return NextResponse.json(
      { 
        error: '変換中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}