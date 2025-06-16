/**
 * Video utility functions for extracting metadata
 */

export interface VideoMetadata {
  duration: number; // Duration in seconds
  width: number;
  height: number;
  aspectRatio: number; // Width / Height
  fileSize: number; // File size in bytes
}

/**
 * Extract video metadata using multiple methods
 * @param file - Video file to analyze
 * @returns Promise with video metadata
 */
export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  console.log(
    "Starting metadata extraction for:",
    file.name,
    file.type,
    file.size
  );

  // Try binary parsing first (fastest and most reliable)
  try {
    console.log("Trying binary metadata extraction...");
    return await getVideoMetadataFromBinary(file);
  } catch (binaryError) {
    console.warn("Binary metadata extraction failed:", binaryError);

    // Try HTML5 Video API
    try {
      console.log("Trying HTML5 Video API...");
      return await getVideoMetadataPrimary(file);
    } catch (primaryError) {
      console.warn("Primary metadata extraction failed:", primaryError);

      // Try fallback HTML5 method
      try {
        console.log("Trying fallback HTML5 method...");
        return await getVideoMetadataFallback(file);
      } catch {
        console.warn("HTML5 Video API methods failed, trying FFmpeg method");

        // Try FFmpeg-based metadata extraction as final fallback
        try {
          console.log("Trying FFmpeg metadata extraction...");
          return await getVideoMetadataWithFFmpeg(file);
        } catch {
          console.error("All metadata extraction methods failed");
          throw new Error(
            "動画の詳細情報を取得できませんでしたが、変換は可能です"
          );
        }
      }
    }
  }
}

/**
 * Extract metadata directly from MP4 binary data
 * This method parses the MP4 file structure to get duration and resolution
 */
async function getVideoMetadataFromBinary(file: File): Promise<VideoMetadata> {
  console.log("Reading video binary data...");

  // Detect file format based on file signature
  const header = file.slice(0, 12);
  const headerBuffer = await header.arrayBuffer();
  const headerData = new Uint8Array(headerBuffer);
  const signature = readString(headerData, 0, 4);

  console.log("File signature:", signature);

  if (signature === "RIFF") {
    // Check if it's AVI file
    const aviSignature = readString(headerData, 8, 4);
    console.log("RIFF type:", aviSignature);

    if (aviSignature === "AVI ") {
      console.log("Detected AVI file, using AVI parser");
      return await parseAVIMetadata(file);
    }
  }

  // Default to MP4 parsing (works for MP4, MOV, etc.)
  console.log("Using MP4/MOV parser");
  return await parseMP4Metadata(file);
}

async function parseAVIMetadata(file: File): Promise<VideoMetadata> {
  console.log("Parsing AVI metadata...");

  // Read first 64KB which should contain the header
  const chunkSize = Math.min(64 * 1024, file.size);
  const chunk = file.slice(0, chunkSize);
  const buffer = await chunk.arrayBuffer();
  const data = new Uint8Array(buffer);

  let duration = 0;
  let width = 0;
  let height = 0;
  let frameRate = 0;
  let totalFrames = 0;

  // Parse RIFF structure
  let offset = 12; // Skip RIFF header

  while (offset < data.length - 8) {
    const chunkId = readString(data, offset, 4);
    const chunkSize = readUint32LE(data, offset + 4); // AVI uses little-endian

    console.log(`AVI chunk: ${chunkId}, size: ${chunkSize}`);

    if (chunkId === "LIST") {
      const listType = readString(data, offset + 8, 4);
      console.log(`LIST type: ${listType}`);

      if (listType === "hdrl") {
        // Parse header list
        const headerData = parseAVIHeaderList(data, offset + 12, chunkSize - 4);
        if (headerData.width) width = headerData.width;
        if (headerData.height) height = headerData.height;
        if (headerData.frameRate) frameRate = headerData.frameRate;
        if (headerData.totalFrames) totalFrames = headerData.totalFrames;
      }
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 === 1) offset++; // Padding for odd sizes
  }

  // Calculate duration
  if (totalFrames > 0 && frameRate > 0) {
    duration = totalFrames / frameRate;
  }

  console.log("AVI metadata extracted:", {
    duration,
    width,
    height,
    frameRate,
    totalFrames,
  });

  if (duration > 0 && width > 0 && height > 0) {
    return {
      duration,
      width,
      height,
      aspectRatio: width / height,
      fileSize: file.size,
    };
  } else {
    throw new Error("Could not extract complete AVI metadata");
  }
}

function parseAVIHeaderList(
  data: Uint8Array,
  startOffset: number,
  size: number
): {
  width?: number;
  height?: number;
  frameRate?: number;
  totalFrames?: number;
} {
  const result: {
    width?: number;
    height?: number;
    frameRate?: number;
    totalFrames?: number;
  } = {};
  let offset = startOffset;
  const endOffset = startOffset + size;

  while (offset < endOffset - 8) {
    const chunkId = readString(data, offset, 4);
    const chunkSize = readUint32LE(data, offset + 4);

    console.log(`  AVI header chunk: ${chunkId}, size: ${chunkSize}`);

    if (chunkId === "avih") {
      // Main AVI header
      const microSecPerFrame = readUint32LE(data, offset + 8);
      result.totalFrames = readUint32LE(data, offset + 16);
      result.width = readUint32LE(data, offset + 32);
      result.height = readUint32LE(data, offset + 36);

      if (microSecPerFrame > 0) {
        result.frameRate = 1000000 / microSecPerFrame;
      }

      console.log(
        `  avih: width=${result.width}, height=${result.height}, frames=${result.totalFrames}, fps=${result.frameRate}`
      );
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 === 1) offset++; // Padding
  }

  return result;
}

function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  );
}

async function parseMP4Metadata(file: File): Promise<VideoMetadata> {
  // First, try to read from the beginning (fast start MP4s have moov at the beginning)
  let result = await tryParseMP4Chunk(file, 0, Math.min(512 * 1024, file.size));

  if (result.duration > 0 && result.width > 0 && result.height > 0) {
    console.log("Found metadata at beginning of file");
    return result;
  }

  // If not found at beginning, try the end of the file (non-fast-start MP4s)
  console.log("Metadata not found at beginning, trying end of file...");
  const endChunkSize = Math.min(1024 * 1024, file.size); // Read last 1MB
  const endStart = Math.max(0, file.size - endChunkSize);

  result = await tryParseMP4Chunk(file, endStart, endChunkSize);

  if (result.duration > 0 && result.width > 0 && result.height > 0) {
    console.log("Found metadata at end of file");
    return result;
  }

  // If still not found and file is small enough, read the entire file
  if (file.size <= 10 * 1024 * 1024) {
    // 10MB limit
    console.log("File is small, reading entire file...");
    result = await tryParseMP4Chunk(file, 0, file.size);

    if (result.duration > 0 && result.width > 0 && result.height > 0) {
      console.log("Found metadata in full file");
      return result;
    }
  }

  throw new Error("Could not extract complete metadata from binary data");
}

async function tryParseMP4Chunk(
  file: File,
  start: number,
  size: number
): Promise<VideoMetadata> {
  const chunk = file.slice(start, start + size);
  const buffer = await chunk.arrayBuffer();
  const data = new Uint8Array(buffer);

  console.log(`Analyzing MP4 chunk: ${start}-${start + size} (${size} bytes)`);

  let duration = 0;
  let width = 0;
  let height = 0;
  let timescale = 0;

  // Parse MP4 atoms/boxes
  let offset = 0;
  while (offset < data.length - 8) {
    // Read atom size and type
    const atomSize = readUint32BE(data, offset);
    const atomType = readString(data, offset + 4, 4);

    console.log(`Found atom: ${atomType}, size: ${atomSize}`);

    if (atomSize === 0 || atomSize > data.length - offset) {
      break;
    }

    if (atomType === "moov") {
      // Parse movie atom
      console.log("Parsing moov atom...");
      const movieData = parseMoovAtom(
        data,
        offset + 8,
        Math.min(atomSize - 8, data.length - offset - 8)
      );
      if (movieData.duration) duration = movieData.duration;
      if (movieData.timescale) timescale = movieData.timescale;
      if (movieData.width) width = movieData.width;
      if (movieData.height) height = movieData.height;
      break; // Found moov, no need to continue
    }

    offset += atomSize;
  }

  // Convert duration from time units to seconds
  if (duration > 0 && timescale > 0) {
    duration = duration / timescale;
  }

  console.log("Binary metadata extracted:", {
    duration,
    width,
    height,
    timescale,
  });

  return {
    duration,
    width,
    height,
    aspectRatio: width > 0 && height > 0 ? width / height : 0,
    fileSize: file.size,
  };
}

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] << 24) |
    (data[offset + 1] << 16) |
    (data[offset + 2] << 8) |
    data[offset + 3]
  );
}

function readString(data: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...data.slice(offset, offset + length));
}

function parseMoovAtom(
  data: Uint8Array,
  startOffset: number,
  size: number
): {
  duration?: number;
  timescale?: number;
  width?: number;
  height?: number;
} {
  const result: {
    duration?: number;
    timescale?: number;
    width?: number;
    height?: number;
  } = {};
  let offset = startOffset;
  const endOffset = startOffset + size;

  while (offset < endOffset - 8) {
    const atomSize = readUint32BE(data, offset);
    const atomType = readString(data, offset + 4, 4);

    if (atomSize === 0 || atomSize > endOffset - offset) {
      break;
    }

    console.log(`  Found sub-atom: ${atomType}, size: ${atomSize}`);

    if (atomType === "mvhd") {
      // Movie header atom
      const version = data[offset + 8];
      let timeOffset = offset + 12; // Skip version and flags

      if (version === 1) {
        // 64-bit version
        timeOffset += 16; // Skip creation and modification time
        result.timescale = readUint32BE(data, timeOffset);
        // Duration is 64-bit, but we'll read just the lower 32 bits
        result.duration = readUint32BE(data, timeOffset + 8);
      } else {
        // 32-bit version
        timeOffset += 8; // Skip creation and modification time
        result.timescale = readUint32BE(data, timeOffset);
        result.duration = readUint32BE(data, timeOffset + 4);
      }

      console.log(
        `  mvhd: duration=${result.duration}, timescale=${result.timescale}`
      );
    }

    if (atomType === "trak") {
      // Track atom - look for video track
      const trackData = parseTrackAtom(data, offset + 8, atomSize - 8);
      if (trackData.width && trackData.height) {
        result.width = trackData.width;
        result.height = trackData.height;
      }
    }

    offset += atomSize;
  }

  return result;
}

function parseTrackAtom(
  data: Uint8Array,
  startOffset: number,
  size: number
): {
  width?: number;
  height?: number;
} {
  const result: {
    width?: number;
    height?: number;
  } = {};
  let offset = startOffset;
  const endOffset = startOffset + size;

  while (offset < endOffset - 8) {
    const atomSize = readUint32BE(data, offset);
    const atomType = readString(data, offset + 4, 4);

    if (atomSize === 0 || atomSize > endOffset - offset) {
      break;
    }

    if (atomType === "tkhd") {
      // Track header atom
      const version = data[offset + 8];
      let dimensionOffset = offset + 12;

      if (version === 1) {
        dimensionOffset += 32; // Skip to dimensions in 64-bit version
      } else {
        dimensionOffset += 20; // Skip to dimensions in 32-bit version
      }

      // Skip matrix (36 bytes) to get to width and height
      dimensionOffset += 36;

      // Width and height are 32-bit fixed-point numbers (16.16)
      const widthFixed = readUint32BE(data, dimensionOffset);
      const heightFixed = readUint32BE(data, dimensionOffset + 4);

      result.width = Math.round(widthFixed / 65536);
      result.height = Math.round(heightFixed / 65536);

      console.log(`  tkhd: width=${result.width}, height=${result.height}`);
      break; // Found dimensions, exit track parsing
    }

    offset += atomSize;
  }

  return result;
}

/**
 * Extract video metadata using FFmpeg (requires FFmpeg to be loaded)
 * This is used as a final fallback when HTML5 Video API fails
 */
async function getVideoMetadataWithFFmpeg(file: File): Promise<VideoMetadata> {
  // Dynamic import to avoid issues if FFmpeg is not available
  try {
    const { getFFmpegConverter } = await import("@/lib/ffmpeg-wasm");
    const converter = getFFmpegConverter();

    // Load FFmpeg if not already loaded
    if (!converter) {
      throw new Error("FFmpeg converter not available");
    }

    // Load FFmpeg (this will be quick if already loaded)
    await converter.load();

    // Use the new extractMetadata method
    return await converter.extractMetadata(file);
  } catch (importError) {
    console.error("Cannot load FFmpeg for metadata extraction:", importError);
    throw new Error("Cannot load FFmpeg for metadata extraction");
  }
}

/**
 * Primary video metadata extraction method using HTML5 Video API
 */
async function getVideoMetadataPrimary(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    video.preload = "metadata";
    video.muted = true; // Prevent audio issues

    // Set a shorter timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.warn("Primary metadata extraction timeout");
      video.removeAttribute("src");
      video.src = "";
      URL.revokeObjectURL(url);
      reject(new Error("メタデータの取得がタイムアウトしました（3秒）"));
    }, 3000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      console.log("Primary metadata: onloadedmetadata triggered");

      try {
        // Validate the metadata
        const duration = video.duration;
        const width = video.videoWidth;
        const height = video.videoHeight;

        console.log(
          `Primary metadata values: duration=${duration}, width=${width}, height=${height}`
        );

        // Check for invalid values
        if (isNaN(duration) || duration <= 0) {
          throw new Error("動画の長さが取得できませんでした");
        }

        if (!width || !height || width <= 0 || height <= 0) {
          throw new Error("動画の解像度が取得できませんでした");
        }

        const metadata: VideoMetadata = {
          duration,
          width,
          height,
          aspectRatio: width / height,
          fileSize: file.size,
        };

        console.log("Primary metadata extraction successful:", metadata);

        // Clean up
        URL.revokeObjectURL(url);
        resolve(metadata);
      } catch (error) {
        console.error("Primary metadata validation failed:", error);
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);

      let errorMessage = "動画メタデータの取得に失敗しました";

      // Try to get more specific error information
      if (video.error) {
        switch (video.error.code) {
          case video.error.MEDIA_ERR_ABORTED:
            errorMessage = "動画の読み込みが中断されました";
            break;
          case video.error.MEDIA_ERR_NETWORK:
            errorMessage = "ネットワークエラーが発生しました";
            break;
          case video.error.MEDIA_ERR_DECODE:
            errorMessage =
              "動画のデコードに失敗しました（ファイルが破損している可能性があります）";
            break;
          case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = "サポートされていない動画形式です";
            break;
          default:
            errorMessage = "不明な動画エラーが発生しました";
        }
      }

      reject(new Error(errorMessage));
    };

    // Additional event listeners for better debugging
    video.onloadstart = () => {
      console.log("Primary metadata: Video load started");
    };

    video.onloadeddata = () => {
      console.log("Primary metadata: Video data loaded");
    };

    video.oncanplay = () => {
      console.log("Primary metadata: Video can play");
    };

    video.oncanplaythrough = () => {
      console.log("Primary metadata: Video can play through");
    };

    video.onstalled = () => {
      console.warn("Primary metadata: Video loading stalled");
    };

    video.onsuspend = () => {
      console.warn("Primary metadata: Video loading suspended");
    };

    video.onabort = () => {
      console.warn("Primary metadata: Video loading aborted");
    };

    video.onprogress = () => {
      console.log("Primary metadata: Video loading progress");
    };

    try {
      video.src = url;
    } catch {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error("動画ファイルの読み込みに失敗しました"));
    }
  });
}

/**
 * Fallback metadata extraction method using file analysis
 */
async function getVideoMetadataFallback(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    video.preload = "auto"; // More aggressive preload for fallback
    video.muted = true;
    video.controls = false;
    video.style.display = "none";

    // Shorter timeout for fallback method
    const timeout = setTimeout(() => {
      console.warn("Fallback metadata extraction timeout");
      if (document.body.contains(video)) {
        document.body.removeChild(video);
      }
      URL.revokeObjectURL(url);
      reject(
        new Error(
          "フォールバック方式でもメタデータの取得がタイムアウトしました（5秒）"
        )
      );
    }, 5000);

    let metadataCheckCount = 0;
    const maxMetadataChecks = 10; // Maximum number of checks before giving up

    // Try multiple events to catch metadata
    const checkMetadata = () => {
      metadataCheckCount++;
      console.log(`Fallback metadata check #${metadataCheckCount}`);

      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;

      console.log(
        `Metadata values: duration=${duration}, width=${width}, height=${height}`
      );

      if (!isNaN(duration) && duration > 0 && width > 0 && height > 0) {
        clearTimeout(timeout);
        if (document.body.contains(video)) {
          document.body.removeChild(video);
        }
        URL.revokeObjectURL(url);

        resolve({
          duration,
          width,
          height,
          aspectRatio: width / height,
          fileSize: file.size,
        });
        return true;
      }

      // If we've tried too many times, give up
      if (metadataCheckCount >= maxMetadataChecks) {
        console.warn("Fallback metadata extraction: too many failed attempts");
        clearTimeout(timeout);
        if (document.body.contains(video)) {
          document.body.removeChild(video);
        }
        URL.revokeObjectURL(url);
        reject(
          new Error(
            "フォールバック方式：メタデータ検証の試行回数が上限に達しました"
          )
        );
        return false;
      }

      return false;
    };

    video.onloadedmetadata = checkMetadata;
    video.onloadeddata = checkMetadata;
    video.oncanplay = checkMetadata;
    video.oncanplaythrough = checkMetadata;

    video.onerror = () => {
      clearTimeout(timeout);
      document.body.removeChild(video);
      URL.revokeObjectURL(url);
      reject(new Error("フォールバック方式でも動画の読み込みに失敗しました"));
    };

    try {
      // Add to DOM for some browsers that require it
      document.body.appendChild(video);
      video.src = url;
      video.load();
    } catch {
      clearTimeout(timeout);
      if (document.body.contains(video)) {
        document.body.removeChild(video);
      }
      URL.revokeObjectURL(url);
      reject(
        new Error("フォールバック方式でも動画ファイルの読み込みに失敗しました")
      );
    }
  });
}

/**
 * Format duration from seconds to readable format (MM:SS or HH:MM:SS)
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) {
    return "00:00";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Format file size to human readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get common aspect ratio display name
 * @param aspectRatio - Width / Height ratio
 * @returns Common aspect ratio name or empty string
 */
export function getAspectRatioDisplay(aspectRatio: number): string {
  const tolerance = 0.01; // Allow small variations

  const commonRatios = [
    { ratio: 16 / 9, display: "16:9" },
    { ratio: 4 / 3, display: "4:3" },
    { ratio: 3 / 2, display: "3:2" },
    { ratio: 21 / 9, display: "21:9" },
    { ratio: 1 / 1, display: "1:1" },
    { ratio: 9 / 16, display: "9:16" },
    { ratio: 3 / 4, display: "3:4" },
    { ratio: 2 / 3, display: "2:3" },
  ];

  for (const { ratio, display } of commonRatios) {
    if (Math.abs(aspectRatio - ratio) < tolerance) {
      return display;
    }
  }

  return "";
}

/**
 * Estimate GIF file size based on video metadata and conversion settings
 * Using the formula: ファイルサイズ(バイト) ≈ ((横幅(px) × 高さ(px) × [log₂(色の数)] / 8) × フレーム数) / 圧縮率(2)
 * @param metadata - Video metadata
 * @param settings - Conversion settings
 * @returns Estimated GIF size in bytes after compression
 */
export function estimateGifSize(
  metadata: VideoMetadata,
  settings: {
    size: number;
    frameRate: number;
    quality: string;
    duration?: number;
  }
): number {
  // Calculate target dimensions
  const targetWidth = settings.size;
  const targetHeight = Math.round(targetWidth / metadata.aspectRatio);

  // Calculate frames
  const duration = settings.duration || metadata.duration;
  const totalFrames = Math.round(duration * settings.frameRate);

  // Quality-based color count mapping
  const colorCounts = {
    low: 64, // 64 colors
    medium: 128, // 128 colors
    high: 256, // 256 colors
  };

  const colorCount =
    colorCounts[settings.quality as keyof typeof colorCounts] || 128;

  // Apply the formula from screenshot: (width × height × log₂(colors) / 8) × frames
  const bitsPerPixel = Math.log2(colorCount);
  const bytesPerPixel = bitsPerPixel / 8;
  const bytesPerFrame = targetWidth * targetHeight * bytesPerPixel;
  const baseSize = bytesPerFrame * totalFrames;

  // Add minimal GIF format overhead (header, global color table, etc.)
  const formatOverhead = 1024 + colorCount * 3; // Header + color table

  // Apply compression ratio = 2 (divide by 2)
  const compressionRatio = 2;
  const estimatedSize = (baseSize + formatOverhead) / compressionRatio;

  console.log("GIF Size Calculation:", {
    targetWidth,
    targetHeight,
    totalFrames,
    colorCount,
    bitsPerPixel: bitsPerPixel.toFixed(2),
    bytesPerPixel: bytesPerPixel.toFixed(3),
    bytesPerFrame: Math.round(bytesPerFrame),
    baseSize: Math.round(baseSize),
    formatOverhead,
    beforeCompression: Math.round(baseSize + formatOverhead),
    compressionRatio,
    estimatedSize: Math.round(estimatedSize),
  });

  return Math.round(estimatedSize);
}

/**
 * Format estimated GIF size with warning levels
 * @param sizeInBytes - Estimated size in bytes
 * @returns Object with formatted size and warning level
 */
export function formatEstimatedGifSize(sizeInBytes: number): {
  formatted: string;
  warningLevel: "safe" | "warning" | "danger";
  message?: string;
} {
  const sizeMB = sizeInBytes / (1024 * 1024);
  const formatted = formatFileSize(sizeInBytes);

  if (sizeMB < 8) {
    return { formatted, warningLevel: "safe" };
  } else if (sizeMB < 12) {
    return {
      formatted,
      warningLevel: "warning",
      message: "サイズが大きめです。品質や長さを調整することをお勧めします。",
    };
  } else {
    return {
      formatted,
      warningLevel: "danger",
      message:
        "サイズが非常に大きくなります。アップロードできない可能性があります。",
    };
  }
}
