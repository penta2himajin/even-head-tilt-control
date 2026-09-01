# 実機サイドロード（QR + トンネル）

Cloud Agent / リモート VM、またはスマホから `localhost` に届かない環境で G2 実機にプラグインを載せる手順です。

トンネル + QR は [`@penta2himajin/even-deskless`](https://github.com/penta2himajin/even-deskless) に委譲しています（`npm run qr:tunnel`）。詳細: `node_modules/@penta2himajin/even-deskless/docs/cloud-agent-qr.md`。

## トンネルが必要な理由

`npm run qr` だけだと QR の先は `http://127.0.0.1:5173` です。これは **Vite を動かしているマシン自身** からしか開けません。

- **Cloud Agent / リモート VM**: スマホから loopback に届かない → スキャンしても開かない
- **同一 LAN のノート PC**: トンネルなしで `http://<LAN-IP>:5173` を使える場合あり（[LAN 代替](#lan-代替トンネルなし)）

Cloud Agent では **even-deskless 経由の Cloudflare quick tunnel** を張り、その URL 向け QR を出します。

`vite.config.ts` は `server.allowedHosts: true` 済み（Cloudflare ホスト名を拒否しない）。

## 前提

- Node 20+
- スマホの Even Realities アプリ（開発者向け QR サイドロード）
- G2 ペアリング済み・装着
- `@evenrealities/evenhub-cli`（`npm run` 経由で PATH に `evenhub`）
- `cloudflared`（PATH または `/tmp/cloudflared`）
- 初回: 必要なら `npx evenhub login`

```bash
npm ci
```

## 手順（Cloud Agent / リモート）

リポジトリ root で **2 端末**（または tmux ペイン）。

### 1. Vite 起動

```bash
npm run dev
```

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/
# 200 を期待
```

### 2. トンネル + サイドロード QR

```bash
npm run qr:tunnel
```

`node_modules/@penta2himajin/even-deskless/scripts/qr-tunnel.sh` を実行します。

1. Vite が `http://127.0.0.1:5173/` で応答しているか確認
2. ログ内の `*.trycloudflare.com` が **まだ生きていれば再利用**（HTTPS probe）
3. なければ `cloudflared` をバックグラウンド起動して URL 待ち
4. その HTTPS URL で `evenhub qr` を表示

既定ログ: `/tmp/even-deskless-cf-tunnel.log`（`CF_TUNNEL_LOG` で変更可）。

quick tunnel は **再起動のたびにホスト名が変わります**。切れたら `npm run qr:tunnel` を再実行。

### 3. スマホでスキャン

1. Even Realities アプリを開く
2. 開発者向け／サイドロード用 QR スキャン
3. ターミナルの QR を読む
4. Phone WebView にプラグイン UI + ミラーが表示される

### 4. グラス側

1. G2 を装着しアプリで接続確認
2. Hub から本プラグイン起動（`com.pentalab.head-tilt-control`）
3. コントロール一覧（`tap` / `dbl` / …）。Phone ミラーに binding・IMU 生値・`debug-ws` が出る

### 5. 任意: 平面キャリブ

Phone ミラーで **平面キャリブ開始** → グラスを平面に ~2 秒置いて `g₀` を保存。

## npm スクリプト

| スクリプト | 用途 |
|------------|------|
| `npm run dev` | Vite `127.0.0.1:5173` |
| `npm run qr` | **localhost 専用** QR |
| `npm run qr:tunnel` | even-deskless: トンネル（起動 or 再利用）+ `evenhub qr` |

## LAN 代替（トンネルなし）

スマホと Vite マシンが同一 LAN の場合:

1. 必要なら `vite.config.ts` の `server.host` を LAN 向けに変更
2. マシン IP（例 `192.168.x.x`）を確認
3. `evenhub qr --url http://192.168.x.x:5173`

## トラブルシュート

| 症状 | 原因の目安 |
|------|------------|
| QR しても開かない | Vite 未起動、またはトンネル URL 失効 → `npm run dev` のあと `npm run qr:tunnel` |
| トンネルで Vite 403 | `allowedHosts: true` 不足（本 repo は設定済み） |
| URL が取れない | cloudflared 待ち／ログ確認（`/tmp/even-deskless-cf-tunnel.log`） |
| コード変更が反映されない | WebView 強リロード or QR 再スキャン |
| トンネル URL が変わった | quick tunnel の仕様 → `npm run qr:tunnel` 再実行 |

- 英語版: [device-sideload.md](./device-sideload.md)
