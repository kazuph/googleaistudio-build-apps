# Vibe Coding Apps

このリポジトリには、AIを活用して構築された様々なアプリケーションが含まれています。

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

## デプロイメント

各アプリケーションはCloudflare WorkersまたはCloudflare Pagesにデプロイされています。

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。 