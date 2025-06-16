# Gifizer - 動画をGIFに変換

様々な形式の動画を無音のGIFに変換し、Imgurに自動アップロードできるWebアプリケーションです。

## 🌟 特徴

- **多様な形式対応**: MP4, AVI, MOV, MKV, WebMなどの主要動画形式をサポート
- **高速変換**: FFmpegエンジンによる最適化された変換処理
- **自動アップロード**: 変換完了後、自動的にImgurにアップロードして共有リンクを生成
- **カスタマイズ可能**: サイズ、品質、フレームレートの調整が可能
- **著作権表示**: オプションで著作権表示をGIFに追加
- **履歴管理**: 変換履歴の保存と削除機能
- **レスポンシブデザイン**: モバイルファーストのマテリアルデザイン
- **ダークモード**: ライト/ダークテーマの切り替え
- **音声通知**: 変換完了時の音声通知

## 🚀 セットアップ

### 前提条件

- Node.js 18以上
- FFmpeg (ローカル開発環境)
- Imgur API Client ID

### インストール

1. リポジトリをクローン:
```bash
git clone <repository-url>
cd gifizer
```

2. 依存関係をインストール:
```bash
npm install
```

3. 環境変数を設定:
```bash
cp .env.example .env.local
```

`.env.local`ファイルを編集し、Imgur Client IDを設定:
```bash
IMGUR_CLIENT_ID=your_imgur_client_id_here
```

### Imgur API Client IDの取得

1. [Imgur API](https://api.imgur.com/oauth2/addclient)にアクセス
2. アプリケーションを登録（匿名アップロード用）
3. Client IDをコピーして環境変数に設定

### ローカル開発

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)でアプリケーションにアクセス

## 🛠️ 技術スタック

- **フロントエンド**: Next.js 15, React 19, TypeScript
- **スタイリング**: Tailwind CSS v4, マテリアルデザイン
- **動画処理**: FFmpeg, fluent-ffmpeg
- **API**: Next.js API Routes
- **外部サービス**: Imgur API v3
- **アイコン**: Font Awesome
- **テーマ**: next-themes (ダークモード対応)

## 📁 プロジェクト構造

```
gifizer/
├── app/
│   ├── api/
│   │   ├── convert/         # 動画→GIF変換API
│   │   └── upload-imgur/    # Imgur API統合
│   ├── layout.tsx          # ルートレイアウト
│   ├── page.tsx            # メインページ
│   └── globals.css         # グローバルスタイル
├── components/
│   ├── header.tsx          # ヘッダーコンポーネント
│   ├── file-upload.tsx     # ファイルアップロード
│   ├── conversion-settings.tsx  # 変換設定パネル
│   ├── progress-indicator.tsx   # 進行状況表示
│   ├── history-panel.tsx   # 履歴管理
│   └── theme-provider.tsx  # テーマプロバイダー
├── lib/
│   └── fontawesome.ts      # Font Awesome設定
└── tmp/                    # 一時ファイル（自動生成）
```

## 🎨 使い方

1. **ファイル選択**: ドラッグ&ドロップまたはクリックで動画ファイルを選択
2. **設定調整**: サイズ、品質、フレームレート、著作権表示を設定
3. **変換開始**: 「GIF変換を開始」ボタンをクリック
4. **結果確認**: 変換完了後、GIFプレビューとImgurリンクを取得
5. **履歴管理**: 変換履歴から過去のGIFを管理・削除

## 🔧 変換設定

### サイズオプション
- **320px**: 小さいファイルサイズ
- **480px**: バランス重視（デフォルト）
- **720px**: 高画質

### 品質オプション
- **低 (256色)**: 最小ファイルサイズ
- **中 (16色)**: バランス重視（デフォルト）
- **高 (8色)**: 最高画質

### フレームレート
- **10fps**: 滑らかさ < ファイルサイズ
- **15fps**: バランス重視（デフォルト）
- **24fps**: 最も滑らか

## 🚢 デプロイ

### Vercel

1. Vercelアカウントを作成
2. GitHubリポジトリと連携
3. 環境変数を設定:
   - `IMGUR_CLIENT_ID`: Imgur API Client ID
   - `FFMPEG_PATH`: FFmpegバイナリパス（Vercel用）

### その他のプラットフォーム

FFmpegバイナリが利用可能な環境であれば、任意のプラットフォームでデプロイ可能です。

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🤝 コントリビューション

プルリクエストやイシューの報告を歓迎します。大きな変更を行う前に、まずイシューを作成してください。

## 🙏 謝辞

- [Next.js](https://nextjs.org) - React フレームワーク
- [FFmpeg](https://ffmpeg.org) - 動画処理エンジン
- [Imgur](https://imgur.com) - 画像ホスティングサービス
- [Font Awesome](https://fontawesome.com) - アイコンライブラリ
- [Tailwind CSS](https://tailwindcss.com) - CSSフレームワーク
