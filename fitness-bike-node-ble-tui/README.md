# Aerobike Controller - Modern TypeScript Implementation

Bluetooth経由でAerobikeを制御するモダンなNode.js/TypeScript実装です。React TUIとMCPサーバー機能を提供します。

## 特徴

- 🚴‍♂️ **Bluetooth Low Energy** - @abandonware/noble を使用した安定したBLE通信
- 🖥️ **React TUI** - inkライブラリによるモダンなターミナルUI
- 🔌 **MCP Server** - Model Context Protocol対応サーバー機能
- 📊 **リアルタイムメトリクス** - 速度、ケイデンス、パワー、距離の取得
- 🎛️ **負荷制御** - 1-80レベルの抵抗調整

## インストール

```bash
npm install
```

## 使用方法

### 1. TUIアプリケーション

```bash
npm run tui
```

**操作方法:**
- `s` - デバイススキャン開始
- `c` - 接続
- `r1-80` - 抵抗レベル設定 (例: r20)
- `q` - 終了

### 2. MCPサーバー

```bash
npm run dev
```

**利用可能なツール:**
- `scan_aerobike` - Bluetoothスキャン
- `connect_aerobike` - デバイス接続
- `disconnect_aerobike` - 切断
- `get_metrics` - メトリクス取得
- `set_resistance` - 負荷レベル設定
- `get_connection_status` - 接続状態確認

## 技術スタック

- **Language**: TypeScript/Node.js (ES Modules)
- **Bluetooth**: @abandonware/noble (実績のあるBLEライブラリ)
- **TUI**: React + ink
- **MCP**: @modelcontextprotocol/sdk
- **Build**: TypeScript Compiler

## ファイル構成

```
├── aerobike-controller.ts  # コアBluetoothコントローラー
├── mcp-server.ts          # MCPサーバー実装
├── tui-app.tsx           # React TUIアプリケーション
├── fitness-bike-controller.js  # オリジナル実装
└── build/                # ビルド出力
```

## Bluetooth仕様

- **Service UUID**: 0x1826 (Fitness Machine Service)
- **Data Characteristic**: 0x2ad2 (Indoor Bike Data)
- **Control Characteristic**: 0x2ad9 (Fitness Machine Control Point)

## メトリクス

リアルタイム取得可能な情報:
- 瞬間速度・平均速度 (km/h)
- 瞬間ケイデンス・平均ケイデンス (rpm)
- 瞬間パワー・平均パワー (W)
- 総距離 (m)
- 抵抗レベル (1-80)

## 開発

```bash
# ビルド
npm run build

# 開発モード
npm run dev

# TUI開発
npm run tui
```

## 対応デバイス

- MG03 Aerobike
- Fitness Machine Service (0x1826) 対応のその他デバイス