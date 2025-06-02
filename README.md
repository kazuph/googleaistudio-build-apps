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

### 💕 技術書典Tinderスワイプ Chrome Extension
技術書典の書籍一覧をTinder風のスワイプUIで効率的に閲覧できるChrome Extension

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

## デプロイメント

各アプリケーションはCloudflare WorkersまたはCloudflare Pagesにデプロイされています。

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。 