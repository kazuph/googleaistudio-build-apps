# Vibe Coding Apps

このリポジトリは、AIを活用して構築された様々なアプリケーションを収録したモノレポです。各アプリケーションは独立して開発・デプロイされており、GitHub Pagesでライブデモが公開されています。

## 🌐 ライブデモサイト

**GitHub Pages**: https://kazuph.github.io/vibe-coding-apps/

## 📁 モノレポ構造

このリポジトリは以下の構造で構成されています：

```
vibe-coding-apps/
├── docs/                    # GitHub Pages公開用ディレクトリ
│   ├── index.html          # メインランディングページ
│   ├── face-crop/          # Face Cropperのライブデモ
│   ├── fitness-bike/       # Fitness Bikeのライブデモ
│   └── kids-learning/      # Kids Learningのライブデモ
├── face-crop-app/          # AI Face Cropperソースコード
├── fitness-bike-webbluetooth/ # Fitness Bike Reactアプリソースコード
├── fitness-bike-node-ble-tui/ # Fitness Bike Node.jsアプリソースコード
├── techbook-preview-extension/ # Chrome Extension
└── techbook-swipe-extension/   # Chrome Extension
```

## 🔄 プロジェクト対応表

| ソースコード | ライブデモ | 説明 |
|-------------|-----------|------|
| `face-crop-app/` | `docs/face-crop/` | MediaPipe Face Detector |
| `fitness-bike-webbluetooth/` | `docs/fitness-bike/` | Web Bluetooth API版 |
| `fitness-bike-node-ble-tui/` | なし | Node.js TUI版（Bluetooth制御） |
| `techbook-*-extension/` | なし | Chrome Extensions |
| なし | `docs/kids-learning/` | 学習アプリ（スタンドアロン） |

## プロジェクト一覧

### 🎯 AI Face Cropper
MediaPipe Face Detectorを使用した高精度な顔検出・画像切り抜きアプリケーション

- **ライブデモ**: https://face-cropper.kazuph.workers.dev/
- **ソースコード**: [face-crop-app/](./face-crop-app/)
- **技術スタック**: MediaPipe, JavaScript, Cloudflare Workers
- **機能**: 
  - 高精度な顔検出
  - カスタマイズ可能な切り抜きサイズ
  - 明るさ・彩度の正規化
  - バッチ処理対応

### 📚 技術書典プレビュー Chrome Extension
技術書典の本一覧ページで、本のリンクにマウスオーバーすると詳細情報をプレビュー表示するChrome Extension

![技術書典プレビュー動作デモ](./techbook-preview-extension/assets/popup.gif)

- **ソースコード**: [techbook-preview-extension/](./techbook-preview-extension/)
- **技術スタック**: Chrome Extension Manifest V3, JavaScript, CSS
- **機能**:
  - マウスホバーで詳細情報を即座に表示
  - マークダウン記法の解釈
  - スマートな位置調整
  - 高速キャッシュ機能

### 💕 技術書典Tinderスワイプ Chrome Extension
技術書典の書籍一覧をTinder風のスワイプUIで効率的に閲覧できるChrome Extension

![技術書典Tinderスワイプ動作デモ](./techbook-swipe-extension/assets/tinder.gif)

- **ソースコード**: [techbook-swipe-extension/](./techbook-swipe-extension/)
- **技術スタック**: Chrome Extension Manifest V3, JavaScript, CSS
- **機能**:
  - 📚 書籍一覧をカード形式で表示
  - 👈 左スワイプ（バツ）：書籍をスキップして非表示に
  - 👉 右スワイプ（ハート）：書籍を新しいタブで開く（現在のタブの右隣に配置）
  - ❤️ ハートした書籍にはマークを表示
  - 🔄 スワイプ履歴を保存し、次回訪問時も反映
  - 📖 詳細ページから書籍の概要・価格・タグを自動取得
  - ⌨️ キーボード操作対応（左右矢印キー、ESCキー）
  - 🎯 ドラッグ＆スワイプ、ボタンクリック、キーボード操作に対応

## 🚀 デプロイメント

### GitHub Pages
- **ライブデモ**: `docs/`ディレクトリから自動デプロイ
- **URL**: https://kazuph.github.io/vibe-coding-apps/
- **更新方法**: `docs/`内のファイルを更新してプッシュ

### Cloudflare Workers/Pages
- **本格運用版**: 各アプリケーションは個別にCloudflare WorkersまたはPagesにデプロイ
- **デプロイコマンド**: 各プロジェクトディレクトリ内で`npm run deploy`または`pnpm run deploy`

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。 