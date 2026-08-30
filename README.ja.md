# even-head-tilt-control

> Source: README.md @ main

Even G2 向けプラグイン。頭の動き（頷き・首振り・ターン（左右を向く）・頭傾き）をタッチ操作（`tap` / `dbl` / `swipe-up` / `swipe-down`）に割り当ててテストします。

長押し中にジェスチャを行うと割り当て、離したあと同じ動きで control が発火します。割り当ては Even Hub ローカルストレージに永続化され、Phone WebView に binding と control ログが表示されます。

**Package ID:** `com.pentalab.head-tilt-control`

詳細は英語版 [README.md](./README.md) を参照してください。

## 実機サイドロード（QR）

Cloud Agent などスマホから `localhost` に届かない場合、`npm run qr` だけでは不十分です。トンネルを張ってから `npm run qr:tunnel` を使います。

手順の全体（トンネル起動 → QR → スマホスキャン → グラス）: **[docs/device-sideload.ja.md](./docs/device-sideload.ja.md)** · [English](./docs/device-sideload.md)

```bash
npm run dev                          # 端末1
bash scripts/dev-tunnel.sh           # 端末2 — /tmp/cf-tunnel.log に記録
npm run qr:tunnel                    # 端末3 — Cloudflare URL 向け QR
```

## License

MIT — [LICENSE](./LICENSE)。
