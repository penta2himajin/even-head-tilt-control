# even-head-tilt-control

> Source: README.md @ main

Even G2 向けプラグイン。頭の動き（頷き・首振り・ターン（左右を向く）・頭傾き）をタッチ操作（`tap` / `dbl` / `swipe-up` / `swipe-down`）に割り当ててテストします。

長押し中にジェスチャを行うと割り当て、離したあと同じ動きで control が発火します。割り当ては Even Hub ローカルストレージに永続化され、Phone WebView に binding と control ログが表示されます。

**Package ID:** `com.pentalab.head-tilt-control`

詳細は英語版 [README.md](./README.md) を参照してください。

## 実機サイドロード（QR）

Cloud Agent などスマホから `localhost` に届かない場合、`npm run qr` だけでは不十分です。トンネルを張ってから `npm run qr:tunnel` を使います。

```bash
npm run dev          # 端末1 — Vite
npm run qr:tunnel    # 端末2 — トンネル + QR（even-deskless）
```

`qr:tunnel` は [`@penta2himajin/even-deskless`](https://github.com/penta2himajin/even-deskless) の `scripts/qr-tunnel.sh` に委譲します。環境変数などは `node_modules/@penta2himajin/even-deskless/docs/cloud-agent-qr.md` を参照。

手順の全体: **[docs/device-sideload.ja.md](./docs/device-sideload.ja.md)** · [English](./docs/device-sideload.md)

## License

MIT — [LICENSE](./LICENSE)。
