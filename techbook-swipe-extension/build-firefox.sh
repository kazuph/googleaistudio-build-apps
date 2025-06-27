#!/bin/bash

# Firefox用の拡張機能をビルド
echo "Building Firefox extension..."

# manifest.jsonをバックアップ
cp manifest.json manifest-backup.json

# Firefox版のmanifestを使用
cp manifest-firefox.json manifest.json

# web-ext buildコマンドでxpiファイルを作成
web-ext build --overwrite-dest

# manifestを元に戻す
mv manifest-backup.json manifest.json

echo "Build complete! Check web-ext-artifacts/ directory for the .zip file"
echo ""
echo "To install permanently:"
echo "1. Upload the .zip file to addons.mozilla.org"
echo "2. Or use Firefox Nightly's custom add-on collection feature"