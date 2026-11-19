# 台湾サイトの対面翻訳

GitHub Pages の `dist/taiwan/translate/` から専用 Cloudflare Worker の `POST /translate` を呼び出します。Worker は DeepL API に原文を渡し、日本語（`JA`）と中国語（入力 `ZH`、繁体字出力 `ZH-HANT`）を双方向に翻訳します。音声入力と読み上げは端末の機能を使います。

## 公開手順

1. DeepL の API プランに登録し、DeepL のアカウント画面で API キーを取得します。
2. Cloudflare にログインした状態で、このディレクトリからコマンドを実行します。入力欄が表示されたら、`DEEPL_AUTH_KEY` に DeepL のキーを設定します。

   ```sh
   npx wrangler deploy
   npx wrangler secret put DEEPL_AUTH_KEY
   ```

3. 標準の公開先は `dist/taiwan/translate/config.js` に設定しています。別の Worker に接続する場合は、GitHub リポジトリ変数 `TAIWAN_TRANSLATION_ENDPOINT` にその HTTPS URL と `/translate` を設定して GitHub Pages をデプロイします。カスタムドメインを使う場合は、Worker の `ALLOWED_ORIGIN` にパスを含まないオリジンを設定します。
4. 公開画面で両方向の翻訳を確認します。利用コードは不要です。DeepL のプランに応じた上限が適用されます。

API キーは Worker のシークレットに保存します。API キーの末尾が `:fx` の場合は無料枠用エンドポイントを使用します。

- [DeepL API 認証](https://developers.deepl.com/docs/getting-started/auth)
- [Cloudflare Workers のシークレット](https://developers.cloudflare.com/workers/configuration/secrets/)
