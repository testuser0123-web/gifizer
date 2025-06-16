# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gifizer is a Next.js application for converting various video formats to silent GIFs and uploading them to Imgur with deletion capabilities. The project uses Next.js 15 with App Router, TypeScript, and Tailwind CSS v4.

## User Ideas & Notes

<!-- ユーザーがアイデアやメモを記録するスペースです -->

- ✅ ローカルの開発環境だとアップロードできるのに、vercel にデプロイすると、なぜかファイルが大きすぎますと表示される。
- ✅ gif 変換はファイルの大きさにかかわらず最後までやって。「Base64 エンコード後のファイルサイズが大きすぎます (38.7MB)。Imgur の制限は 10MB です。」このエラーはいらない。

### 確認すべき点

- 動画が正しく gif 化されるか
- その間表示に問題はないか
- API を設定して、動画が正しくアップロードされるか

### What I asked Claude

Vercel で ffmpeg を使う場合の制約と解決策について調べてみます。

Vercel で ffmpeg を使う際の制約と解決策について調べました。結論から言うと、Vercel のサーバーレス関数で ffmpeg を直接使うのは難しいですが、代替手段があります。
主な制約
サーバーレス関数での制限

Vercel のサーバーレス関数には 50MB の圧縮サイズ制限があり、ffmpeg をインストールすると通常この制限を超えてしまいます
How do I have Vercel install `ffmpeg` before running my server? · vercel/vercel · Discussion #9729 +2
。非圧縮状態では 250MB の制限もあります
Troubleshooting Build Error: “Serverless Function has exceeded the unzipped maximum size of 250 MB”

。

@ffmpeg-installer/ffmpeg パッケージを使った場合、デプロイが 53.55MB になって制限を超過する例が報告されています
How do I have Vercel install `ffmpeg` before running my server? · vercel/vercel · Discussion #9729

。
推奨される解決策

1. ffmpeg.wasm（クライアントサイド処理）

最も実用的な解決策は、ブラウザ上で WebAssembly として動作する ffmpeg.wasm を使うこと
Using WebAssembly (Wasm)

です。

メリット:

    Vercelのサーバーレス関数の制限を回避
    クライアントサイドで処理するため、サーバー負荷が軽減
    20MBのWebAssemblyバイナリとして提供

注意点:

    Next.jsでの使用時は「use client」ディレクティブが必要で、サーバーサイドレンダリングでは動作しません
    GitHub

Vercel

    ブラウザでの処理のため、大きなファイルの場合はパフォーマンスに制限がある

2. 外部サービスへの移行

動画処理のような重い処理は、別のマイクロサービスとして分離し、Vercel の Function から API として呼び出す方法
Troubleshooting Build Error: “Serverless Function has exceeded the unzipped maximum size of 250 MB”

も推奨されています。 3. Edge Functions の検討

Edge Functions は軽量で低レイテンシーの実行が可能で、一部のユースケースではサーバーレス関数の代替になる
Troubleshooting Build Error: “Serverless Function has exceeded the unzipped maximum size of 250 MB”

可能性があります。
実装例

ffmpeg.wasm を使った Next.js での基本的な実装：

javascript

'use client'
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

const load = async () => {
const baseURL = 'https://unpkg.com/@ffmpeg/[email protected]/dist/umd'
await ffmpeg.load({
coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
});
};

結論: Vercel で ffmpeg を使いたい場合は、サーバーサイドではなくクライアントサイドで ffmpeg.wasm を使用するのが最も現実的な解決策です。

### 実装済み機能

- ✅ 削除するために必要な情報は localStorage に保存するべきですね。
- ✅ gif のサイズは３つくらいの選択肢の中から選べるとよいかも。
- ✅ 著作権者の名前を入力するフィールドを作って、何も入力されていなければそのまま、何か入力されていたら「© 名前」のように文字を動画に入れられるといいです。
- ✅ font awesome の記号をたくさん用いてわかりやすいように。
- ✅ デザインはモバイルファーストで。
- ✅ 水色を基調としたマテリアルテーマを使用。ダークモードに対応。
- ✅ 作業が終わったら音で通知してほしい。
- ✅ コンポーネントの配置は中央ぞろえやマージンを使ってきれいにしてください。
- ✅ 動画を選択したら「動画ファイルを選択」コンポーネントは非表示に。
- ✅ 変換はユーザーサイドで行ってください。（※ FFmpeg WASM の問題によりサーバーサイドに変更）
- ✅ 変換のエラーを直してください。
- ✅ 動画の長さは無制限にしてください。
- ✅ 変換品質で「高」のほうが色数が少なくなってるのを直して。

## Development Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Technical Architecture

### Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Backend**: Next.js API Routes, Multer (file upload)
- **Video Processing**: FFmpeg
- **External Services**: Imgur API v3
- **Deployment**: Vercel (serverless)
- **Fonts**: Geist Sans & Geist Mono from next/font/google

### Project Structure

- `app/` - Next.js App Router pages and layouts
- `app/layout.tsx` - Root layout with font configuration
- `app/page.tsx` - Main page (currently default Next.js template)
- `app/globals.css` - Global styles with Tailwind
- Path alias `@/*` configured for root-level imports

## Feature Specifications

### 1. Video Processing Pipeline

- **Supported Input**: MP4, AVI, MOV, MKV, WebM
- **Output**: Silent GIF (audio removed)
- **FFmpeg Pipeline**: Audio removal → Frame rate adjustment → Resize → GIF conversion
- **Quality Options**: Low/Medium/High (256/16/8 color palette)
- **Size Options**: 320px, 480px, 720px (width-based, aspect ratio maintained)
- **Frame Rate**: 10fps, 15fps, 24fps
- **Max Duration**: 30 seconds (auto-cut for longer videos)
- **Performance**: Chunk processing, Web Workers, real-time progress

### 2. UI/UX Design

- **Main Components**:
  - Header with site name and navigation
  - Drag & drop area for video upload
  - Conversion settings panel (quality, size, frame rate)
  - Progress indicator
  - Result display area (GIF preview, Imgur link)
  - Upload history with delete functionality
- **User Flow**: Upload → Settings → Convert → Auto-upload to Imgur → Share/Delete

### 3. Imgur API Integration

- **Authentication**: Client ID (anonymous uploads)
- **Environment Variable**: `IMGUR_CLIENT_ID`
- **Upload Process**: GIF conversion → Base64 encode → POST to `/upload` → Store links
- **Response Handling**: Direct link + delete hash storage
- **Error Handling**: Rate limits (12,500/day), 10MB file limit, network retry

### 4. File Management & Deletion

- **Storage**: localStorage (serverless compatible)
- **Data Structure**: `{id, filename, imgurLink, deleteHash, timestamp}`
- **Delete Options**:
  - Local deletion (localStorage removal)
  - Imgur deletion (DELETE request with hash)
  - Bulk delete (clear all history)
  - Auto-delete (30 days, optional)
- **History Display**: Thumbnails, upload date, filename, copy link, delete button

### 5. Security Requirements

- **File Upload**: MIME type validation, 100MB size limit, malicious file detection
- **API Security**: CORS configuration, IP-based rate limiting, environment variable protection
- **Data Protection**: Temp file cleanup, HTTPS enforcement, localStorage only (no personal data)

### 6. Development & Deployment

- **Environment**: Node.js 18+, FFmpeg binary, ESLint + Prettier
- **Deployment**: Vercel serverless functions, environment variables, build optimization
- **CI/CD**: GitHub Actions, automated testing, security scanning

## Implementation Phases

### Phase 1: Core Functionality

- Next.js project setup
- File upload UI implementation
- FFmpeg integration and GIF conversion

### Phase 2: Imgur Integration

- API integration and upload functionality
- Error handling and retry logic

### Phase 3: Management Features

- History display and deletion functionality
- localStorage management system

### Phase 4: Optimization

- Performance improvements
- UI/UX enhancements
- Test implementation

## Key Implementation Notes

- Uses TypeScript in strict mode
- Configured for serverless deployment (Vercel recommended)
- Will require FFmpeg integration for video processing
- Client-side state management planned via localStorage
- Imgur API authentication via Client ID (anonymous uploads)
