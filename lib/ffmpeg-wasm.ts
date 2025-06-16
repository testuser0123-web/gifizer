"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

export interface ConversionProgress {
  step: "loading" | "converting" | "completed" | "error";
  progress: number;
  message?: string;
}

export interface ConversionSettings {
  size: number; // Width in pixels (180-720)
  quality: "low" | "medium" | "high";
  frameRate: 10 | 15 | 24;
  copyright: string;
}

const QUALITY_SETTINGS = {
  low: { colors: 64, dither: "bayer:bayer_scale=5" },
  medium: { colors: 128, dither: "ed" },
  high: { colors: 256, dither: "none" },
};

// FFmpegの仮想ファイルシステムに書き込むフォントのパスを定義
// publicディレクトリに NotoSansJP.ttf を配置している前提
const VIRTUAL_FONT_PATH = "/tmp/NotoSansJP.ttf";

export class FFmpegConverter {
  private ffmpeg: FFmpeg | null = null;
  private loaded = false;
  private fontLoaded = false; // フォントが仮想FSにロードされたか追跡

  constructor() {
    if (typeof window !== "undefined") {
      this.ffmpeg = new FFmpeg();
    }
  }

  async load(
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<void> {
    if (this.loaded || !this.ffmpeg) return;

    try {
      onProgress?.({
        step: "loading",
        progress: 0,
        message: "FFmpegを読み込み中...",
      });

      console.log("Loading FFmpeg with default CDN...");

      // FFmpeg進行状況の監視を設定（ロード時は使用しない）
      this.ffmpeg.on("progress", ({ progress }) => {
        const percent = Math.round(progress * 100);
        console.log(`FFmpeg progress: ${percent}%`);
      });

      this.ffmpeg.on("log", ({ type, message }) => {
        console.log(`[FFmpeg ${type}]:`, message);

        if (
          type === "fferr" ||
          message.includes("Error") ||
          message.includes("error")
        ) {
          console.error(`🚨 FFmpeg Error Log:`, message);
        }
      });

      await this.ffmpeg.load();
      this.loaded = true;

      // FFmpegロード後、フォントファイルを仮想ファイルシステムにロード
      await this.loadFontToFFmpegFS();

      onProgress?.({
        step: "loading",
        progress: 100,
        message: "FFmpegおよびリソース読み込み完了",
      });
      console.log("✅ FFmpeg and resources loaded successfully");
    } catch (error) {
      console.error("FFmpeg load error:", error);

      let userMessage = "FFmpegの読み込みに失敗しました。";
      if (error instanceof Error) {
        if (error.message.includes("CORS")) {
          userMessage +=
            " CORS エラーが発生しました。ページを再読み込みしてください。";
        } else if (error.message.includes("Network")) {
          userMessage +=
            " ネットワークエラーが発生しました。インターネット接続を確認してください。";
        } else if (error.message.includes("CDN")) {
          userMessage +=
            " CDN からの読み込みに失敗しました。しばらく待ってから再試行してください。";
        } else if (error.message.includes("font")) {
          // フォントエラーの場合のメッセージを追加
          userMessage +=
            " フォントファイルの読み込みに失敗しました。パスを確認してください。";
        } else {
          userMessage += ` エラー詳細: ${error.message}`;
        }
      }

      onProgress?.({ step: "error", progress: 0, message: userMessage });
      throw error;
    }
  }

  private async loadFontToFFmpegFS(): Promise<void> {
    if (this.fontLoaded || !this.ffmpeg) return;

    try {
      console.log(`Loading font file from public directory: /NotoSansJP.ttf`);
      // publicディレクトリからのパスを指定
      const fontData = await fetchFile("/NotoSansJP.ttf");

      console.log(
        `Writing font file to FFmpeg virtual FS: ${VIRTUAL_FONT_PATH}`
      );
      await this.ffmpeg.writeFile(VIRTUAL_FONT_PATH, fontData);
      this.fontLoaded = true;
      console.log(
        `✅ Font loaded and written to FFmpeg FS at ${VIRTUAL_FONT_PATH}`
      );
    } catch (error) {
      console.error(
        `❌ Failed to load or write font file "${VIRTUAL_FONT_PATH}" to FFmpeg FS:`,
        error
      );
      this.fontLoaded = false;
      throw new Error(
        `Failed to load font for FFmpeg: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async convertToGif(
    file: File,
    settings: ConversionSettings,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<Uint8Array> {
    console.log(
      "🎬 convertToGif called - loaded:",
      this.loaded,
      "ffmpeg:",
      !!this.ffmpeg
    );

    if (!this.loaded || !this.ffmpeg || !this.fontLoaded) {
      // フォントがロードされているかもチェック
      console.error(
        "❌ FFmpeg or font not ready - loaded:",
        this.loaded,
        "ffmpeg:",
        !!this.ffmpeg,
        "fontLoaded:",
        this.fontLoaded
      );
      throw new Error("FFmpeg or font is not loaded. Call load() first.");
    }

    // FFmpegが完全に準備できているかを確認
    try {
      console.log("🔍 Checking FFmpeg readiness...");
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log("✅ FFmpeg appears ready");
    } catch (checkError) {
      console.error("❌ FFmpeg readiness check failed:", checkError);
      throw new Error("FFmpeg is not ready for conversion");
    }

    const inputFileName = "input.mp4";
    const outputFileName = "output.gif";

    try {
      onProgress?.({
        step: "converting",
        progress: 0,
        message: "ファイルを準備中...",
      });

      console.log("Starting conversion with simplified approach");

      const fileData = await fetchFile(file);
      console.log("File data size:", fileData.byteLength);

      try {
        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(outputFileName);
      } catch {
        // ファイルが存在しない場合のエラーは無視
      }

      await this.ffmpeg.writeFile(inputFileName, fileData);
      console.log("File written to FFmpeg FS:", inputFileName);

      try {
        console.log("🔍 Checking input file with ffprobe-like command...");
        const probeArgs = ["-i", inputFileName, "-f", "null", "-"];
        await this.ffmpeg.exec(probeArgs);
      } catch (probeErr) {
        console.log(
          "Input file probe result (this might show format info):",
          probeErr
        );
      }

      onProgress?.({
        step: "converting",
        progress: 20,
        message: "GIFに変換中...",
      });

      console.log("=== FFmpeg Conversion Settings ===");
      console.log("Size:", settings.size, "px");
      console.log(
        "Quality:",
        settings.quality,
        "→",
        QUALITY_SETTINGS[settings.quality]
      );
      console.log("Frame Rate:", settings.frameRate);
      console.log("Copyright:", settings.copyright);
      console.log("Input file size:", fileData.byteLength, "bytes");

      let videoFilter = `fps=${settings.frameRate},scale=${settings.size}:-1:flags=lanczos`;

      if (settings.copyright.trim()) {
        console.log("📝 Copyright info detected:", settings.copyright);

        const copyrightText = settings.copyright.trim().substring(0, 15); // 長さ制限
        const fontSize = Math.max(
          12,
          Math.min(settings.size / 25, 20)
        );

        // フォントパスをFFmpeg仮想ファイルシステム上のパスに更新
        // /public/NotoSansJP.ttf ではなく VIRTUAL_FONT_PATH を使う
        const textWatermark = `drawtext=text='© ${copyrightText}':fontcolor=white:fontsize=${fontSize}:x=w-tw-10:y=h-th-10:box=1:boxcolor=black@0.5:boxborderw=5:fontfile=${VIRTUAL_FONT_PATH}`;
        videoFilter += `,${textWatermark}`;
        console.log("🎨 Adding text-based copyright watermark");
        console.log("  - Text:", `© ${copyrightText}`);
        console.log("  - Font size:", fontSize);
        console.log("  - Font file:", VIRTUAL_FONT_PATH); // 使用するフォントパスをログ出力
      }

      const args = [
        "-i",
        inputFileName,
        "-vf",
        videoFilter,
        "-gifflags",
        "+transdiff",
        "-pix_fmt",
        "rgb24",
      ];

      if (settings.copyright.trim()) {
        const copyrightComment = `Copyright: ${settings.copyright.trim()}`;
        args.push("-metadata", `comment=${copyrightComment}`);
        console.log("📝 Adding copyright to GIF metadata:", copyrightComment);
      }

      args.push("-f", "gif", "-y", outputFileName);

      console.log("✅ Using actual user settings:");
      console.log("  - Size:", settings.size + "px");
      console.log("  - FPS:", settings.frameRate);
      console.log("  - Quality:", settings.quality);
      console.log(
        "  - Copyright:",
        settings.copyright ? `"${settings.copyright}"` : "none"
      );
      console.log("  - Video filter:", videoFilter);

      console.log("Single-step GIF conversion args:", args);

      try {
        console.log("🚀 Starting FFmpeg execution...");
        console.log("📝 Full command:", args.join(" "));
        console.log("🎨 Video filter chain:", videoFilter);

        const ffmpegLogs: string[] = [];
        
        // ログハンドラー
        const logHandler = ({
          type,
          message,
        }: {
          type: string;
          message: string;
        }) => {
          ffmpegLogs.push(`[${type}] ${message}`);
          if (type === "fferr" || message.toLowerCase().includes("error")) {
            console.error(`🚨 FFmpeg Error: [${type}] ${message}`);
          }
        };

        // 進行状況ハンドラー - UIプログレスバーに反映
        const progressHandler = ({ progress }: { progress: number }) => {
          const percent = Math.round(progress * 100);
          console.log(`FFmpeg conversion progress: ${percent}%`);
          
          // FFmpegの進行状況を20-80%の範囲でマッピング（前後に準備とクリーンアップがあるため）
          const mappedProgress = 20 + (progress * 60);
          onProgress?.({
            step: "converting",
            progress: Math.round(mappedProgress),
            message: `GIF変換中... ${percent}%`,
          });
        };

        this.ffmpeg.on("log", logHandler);
        this.ffmpeg.on("progress", progressHandler);

        await this.ffmpeg.exec(args);

        this.ffmpeg.off("log", logHandler);
        this.ffmpeg.off("progress", progressHandler);

        console.log("✅ FFmpeg execution completed");
        console.log("📋 FFmpeg execution logs:", ffmpegLogs.slice(-10));

        try {
          const files = await this.ffmpeg.listDir(".");
          console.log("📁 Files in FFmpeg FS after conversion:");
          files.forEach((file) => {
            console.log(`  - ${file.name}`);
          });

          const outputFile = files.find((file) => file.name === outputFileName);
          console.log(
            `Output file '${outputFileName}' exists: ${!!outputFile}`
          );

          if (!outputFile) {
            console.error("❌ Output file was not created by FFmpeg");
            console.error(
              "Available files:",
              files.map((f) => f.name)
            );
            throw new Error("FFmpegが出力ファイルを生成しませんでした");
          }

          try {
            const fileData = await this.ffmpeg.readFile(outputFileName);
            const fileSize =
              fileData instanceof Uint8Array
                ? fileData.byteLength
                : fileData.length;
            console.log(`📏 Output file size before read: ${fileSize} bytes`);

            if (fileSize === 0) {
              console.error("❌ Output file exists but is empty");
              throw new Error("FFmpegが空のファイルを生成しました");
            }
          } catch (sizeCheckErr) {
            console.error("Failed to check file size:", sizeCheckErr);
          }
        } catch (listErr) {
          console.error("Cannot list files:", listErr);
        }
      } catch (err) {
        console.error("❌ FFmpeg execution failed:", err);
        console.error("Full error details:", err);

        console.log("FFmpeg command that failed:", args);

        throw new Error(`変換エラー: ${err}`);
      }

      onProgress?.({
        step: "converting",
        progress: 80,
        message: "ファイルを読み取り中...",
      });

      let data: Uint8Array;
      try {
        console.log("🔍 Reading output file...");

        const result = await this.ffmpeg.readFile(outputFileName);
        data = result as Uint8Array;
        console.log(
          `📄 Output file read successfully: ${data.byteLength} bytes`
        );

        if (data.byteLength === 0) {
          console.error(`❌ Output file is empty (0 bytes)`);
          throw new Error(
            "出力ファイルが空です - FFmpeg変換が失敗した可能性があります"
          );
        }

        console.log("✅ GIF conversion completed successfully!");
      } catch (readErr) {
        console.error("❌ Failed to read output file:", readErr);
        throw new Error(`出力ファイル読み取りエラー: ${readErr}`);
      }

      onProgress?.({
        step: "converting",
        progress: 95,
        message: "クリーンアップ中...",
      });

      try {
        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(outputFileName);
        // フォントファイルもクリーンアップ
        await this.ffmpeg.deleteFile(VIRTUAL_FONT_PATH);
      } catch (cleanupErr) {
        console.warn("Cleanup warning:", cleanupErr);
      }

      // Canvas APIを使用したウォーターマーク処理はFFmpegで完結するため削除
      // if (settings.copyright.trim()) {
      //   console.log(
      //     "✅ Copyright watermark added via FFmpeg - preserving GIF animation"
      //   );
      // }

      onProgress?.({ step: "completed", progress: 100, message: "変換完了！" });

      return data;
    } catch (error) {
      console.error("Conversion error:", error);

      try {
        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(outputFileName);
        // エラー時もフォントファイルをクリーンアップ
        await this.ffmpeg.deleteFile(VIRTUAL_FONT_PATH);
      } catch (cleanupErr) {
        console.warn("Error cleanup failed:", cleanupErr);
      }

      onProgress?.({
        step: "error",
        progress: 0,
        message: "変換中にエラーが発生しました",
      });
      throw error;
    }
  }

  terminate(): void {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
    }
    this.loaded = false;
    this.fontLoaded = false; // 終了時にもリセット
  }
}

// シングルトンインスタンス
let converterInstance: FFmpegConverter | null = null;

export function getFFmpegConverter(): FFmpegConverter {
  if (!converterInstance && typeof window !== "undefined") {
    converterInstance = new FFmpegConverter();
  }
  return converterInstance!;
}
