# 実機サイドロード（QR + トンネル）

Cloud Agent / リモート VM など、スマホから `localhost` に届かない環境で、本プラグインを G2 実機に載せる手順です。

## なぜトンネルが必要か

`npm run qr` だけだと QR の先は `http://127.0.0.1:5173` です。これは **Vite を動かしているマシン自身** からしか開けません。

- **Cloud Agent / リモート VM**: スマホからその loopback には届かない → スキャンしても読めない／真っ白。
- **同じ LAN のノート PC**: トンネルなしで `http://<LANのIP>:5173` が使えることが多い（[LAN 代替](#lan-代替トンネルなし)）。

Cloud Agent では **公開 HTTPS トンネル**（ここでは Cloudflare quick tunnel）を張り、その URL 向けに QR を出します。

本リポジトリの Vite は `server.allowedHosts: true` 済みなので、Cloudflare のホスト名でもブロックされません。

## 前提

- Node 20+
- スマホの Even Realities アプリ（開発者向け QR サイドロード）
- G2 がペアリング済み・装着可能
- `evenhub` CLI（`npm` の `@evenrealities/evenhub-cli`）
- 初回のみ必要なら `npx evenhub login`

```bash
npm ci
```

## 一連の手順（Cloud Agent / リモート）

リポジトリ直下で **ターミナルを3つ**（または tmux のペイン3つ）用意します。

### 1. Vite を起動

```bash
npm run dev
```

起動したままにし、ローカルで確認:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/
# 200 なら OK
```

### 2. Cloudflare quick tunnel を起動

`cloudflared` を入れたうえで:

```bash
cloudflared tunnel --url http://127.0.0.1:5173 2>&1 | tee /tmp/cf-tunnel.log
```

またはヘルパー（npm スクリプトが期待するログパスと同じ）:

```bash
bash scripts/dev-tunnel.sh
```

ログに次のような URL が出るまで待つ:

```text
https://<ランダム>.trycloudflare.com
```

quick tunnel は **再起動のたびにホスト名が変わります**。トンネルを立て直したら QR も取り直してください。

### 3. サイドロード用 QR を出す

トンネルを起動したまま:

```bash
npm run qr:tunnel
```

`/tmp/cf-tunnel.log` から最初の `*.trycloudflare.com` を拾い、`evenhub qr --url <そのHTTPS>` を実行します。

手動の場合:

```bash
URL=$(grep -Eo 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' /tmp/cf-tunnel.log | head -1)
echo "$URL"
evenhub qr --url "$URL"
```

### 4. スマホでスキャン

1. **Even Realities** アプリを開く
2. 開発者向け／サイドロード用の QR スキャンを開く
3. ターミナルの QR を読む
4. 電話の WebView がトンネル URL を読み込む（プラグイン UI + フォンミラー）

### 5. グラス側

1. G2 を装着し、アプリ上で接続を確認
2. グラス／Hub メニューから本プラグインを起動（package id: `com.pentalab.head-tilt-control`）
3. 操作一覧（`tap` / `dbl` / …）が出れば OK。フォンミラーに bindings と `debug-ws` 状態が出ます

### 6. 任意: 平面キャリブ

フォンミラーの **平面キャリブ開始** を押し、グラスを机などに約2秒置くと `g₀` が保存されます。その後装着して、行を長押し＋頭ジェスチャで割り当てます。

## npm スクリプトの意味

| スクリプト | 用途 |
|------------|------|
| `npm run dev` | Vite（`127.0.0.1:5173`） |
| `npm run qr` | **localhost 専用** QR（スマホがそのホストに届く場合のみ） |
| `npm run qr:tunnel` | `/tmp/cf-tunnel.log` の Cloudflare URL 向け QR |
| `bash scripts/dev-tunnel.sh` | `cloudflared` → Vite、ログを `/tmp/cf-tunnel.log` へ |

## LAN 代替（トンネルなし）

スマホと Vite 実行機が同じ LAN にいる場合:

1. 必要なら `vite.config.ts` の `server.host` を `true` / `0.0.0.0` に変更して LAN 待ち受け
2. マシンの IP を確認（例: `192.168.x.x`）
3. `evenhub qr --url http://192.168.x.x:5173`
4. Even アプリでスキャン

このとき `npm run qr`（localhost）は使わないでください。

## トラブルシュート

| 症状 | 確認 |
|------|------|
| QR しても開かない／タイムアウト | トンネル未起動、または QR がまだ `127.0.0.1`。トンネル起動後に `npm run qr:tunnel` を再実行 |
| Vite が host を拒否 | `allowedHosts: true`（本リポは設定済み） |
| `qr:tunnel` の URL が空 | ログ未作成／まだ URL 行がない。トンネル ready を待つ |
| コードを直しても古い UI | フォン WebView を強リロード、または QR 再スキャン |
| 一覧が出ない／IMU なし | 接続・装着・プラグイン前面。ログに `[head-tilt] ready` |
| トンネル URL が変わった | quick tunnel の仕様。QR を取り直す |

## 関連

- グラスなし検証: `npm run verify:deskless` / `?mockImu=1` — [README.ja.md](../README.ja.md)
- 英語版: [device-sideload.md](./device-sideload.md)
