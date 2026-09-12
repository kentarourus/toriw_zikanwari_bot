# 学校時間割bot

Google スプレッドシートの「時間割」「連絡」を表示する、スマートフォン対応の静的Webアプリです。現在は **1-5** と **2-3** に対応しています。

## ページ構成

- `/` — Sitesでは2-3時間割、GitHub Pagesではクラス一覧へ移動
- `/classes/` — 3学年・各7クラスの一覧
- `/classes/1-5/` — 1-5 時間割

公開ファイルは `dist` にまとめています。共通のJavaScriptとCSSは `dist/assets`、クラス別の予備データは `dist/data` にあります。クラスとスプレッドシートの対応は `config/classes.json` が管理します。

## 更新と確認

```text
npm run build       色付きセルを読むモジュールを更新
npm run snapshots   各クラスの予備データを更新
npm test            シート、色、ページ構成を確認
```

ローカルでは `python -m http.server 5173 --directory dist` で確認できます。ページを開いたときと「更新」を押したときに最新のシートを取得し、取得できない場合はクラス別の予備データを表示します。元のシートへの書き込みは行いません。

## GitHub Pages

`main` ブランチへ反映すると `.github/workflows/pages.yml` が `dist` をGitHub Pagesへ配信します。初回のみ、GitHubの **Settings → Pages → Source** を **GitHub Actions** に設定してください。
