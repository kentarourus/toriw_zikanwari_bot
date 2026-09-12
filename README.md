# 学校時間割bot

Google スプレッドシートの「時間割」「連絡」を表示する、スマートフォン対応の静的Webアプリです。現在は **1-5**、**2-1**、**2-3**、**2-5** に対応しています。

## ページ構成

- `/` — 3学年・各7クラスの一覧
- `/classes/` — クラス一覧へ移動する互換URL
- `/classes/1-5/` — 1-5 時間割
- `/classes/2-1/` — 2-1 時間割
- `/classes/2-3/` — 2-3 時間割
- `/classes/2-5/` — 2-5 時間割

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
