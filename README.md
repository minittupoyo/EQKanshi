# EQKanshi - Misskey向け地震速報Bot

Wolfxの緊急地震速報API（WebSocket）および P2P地震情報のWebSocket（code 551専用）を受信し、Misskeyに自動投稿する地震速報Botです。

---

## 🌟 特長・機能

1. **Wolfx 緊急地震速報 (EEW) 専用モジュール**
   - `wss://ws-api.wolfx.jp/jma_eew` に接続。
   - `type: heartbeat` の自動フィルタリング。
   - イベントID (`EventID`) と報数 (`Serial`) を管理し、同報数や古くなった過過去報の重複投稿を徹底排除。
   - キャンセル報 (`isCancel: true`) や警報/予報の各種情報を分かりやすくMisskeyに投稿。
   - 訓練報 (`isTraining`) のフィルタリング対応。

2. **P2P地震情報 code 551 専用モジュール**
   - `wss://api.p2pquake.net/v2/ws` に接続。
   - **`code: 551`（各地の震度・震源に関する情報）のみを厳密に処理**（他コードは無視）。
   - ユニークID (`id`) による既読重複チェック。
   - 情報が空・未確定のデータの誤配信を自動防止。
   - 震度速報・震源震度情報を地域ごとに分かりやすくフォーマットしてMisskeyへ投稿。

3. **Misskey API投稿・自動リトライ**
   - Misskey Note作成API (`/api/notes/create`) を利用。
   - 公開範囲 (`public`, `home`, `unlisted`, `specified`) の変更に対応。
   - ネットワークエラー時の自動リトライ（指数バックオフ）。
   - `MISSKEY_TOKEN` 未設定時はドライランモードとして動作し、投稿内容をコンソールに出力。

4. **堅牢なWebSocket接続管理**
   - 切断時の自動再接続機能（デフォルト 5秒間隔）。

---

## 🚀 セットアップ & 起動手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成します。

```bash
cp .env.example .env
```

`.env` を編集してMisskeyのアクセストークンや接続先インスタンスのURLを設定します。

```env
# Misskey インスタンス設定
MISSKEY_ORIGIN=https://misskey.io
MISSKEY_TOKEN=your_misskey_access_token_here
MISSKEY_VISIBILITY=public

# WebSocket エンドポイント設定
WOLFX_WS_URL=wss://ws-api.wolfx.jp/jma_eew
P2P_WS_URL=wss://api.p2pquake.net/v2/ws

# オプション設定
ALLOW_TRAINING=false
RECONNECT_INTERVAL_MS=5000
```

### 3. テストの実行

重複チェックやフォーマッターの動作をテストできます。

```bash
npm test
```

### 4. 起動

#### 開発モード (tsx)
```bash
npm start
```

#### ビルドと本番起動
```bash
npm run build
node dist/index.js
```

### 🐳 Docker / Docker Compose で起動

#### Docker Compose を使う場合 (推奨)
```bash
# ビルドと起動 (バックグラウンド)
docker compose up -d --build

# ログの確認
docker compose logs -f

# 停止
docker compose down
```

#### Docker 単体で使う場合
```bash
docker build -t eqkanshi .
docker run -d --name eqkanshi --env-file .env eqkanshi
```

---

## 📁 ディレクトリ構造

```
├── src/
│   ├── config.ts       # 環境変数・設定ロード
│   ├── types.ts        # Wolfx EEW / P2P 551 / Misskey 型定義
│   ├── misskey.ts      # Misskey API クライアント (リトライ付)
│   ├── dedupe.ts       # 重複排除 & 情報欠落・誤配信チェックロジック
│   ├── formatters.ts   # Misskey向け Note テキストフォーマッター
│   ├── wolfx.ts        # Wolfx EEW WebSocket クライアント
│   ├── p2p.ts          # P2P 地震情報 (code 551) WebSocket クライアント
│   └── index.ts        # メインエントリポイント
├── tests/
│   └── test_all.ts     # 単体テストスクリプト
├── package.json
├── tsconfig.json
└── README.md
```
