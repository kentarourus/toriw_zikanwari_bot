# 個人用 台湾CLI相談

構成: unlisted Pages画面 → Cloudflare Worker → 個人PCの常駐Codex app-server (gpt-6-luna / medium)。GitHub Actions経路も未接続時の従来経路として保持する。

これはGitHubにログインした本人のための試作です。推測しにくいURLはアクセス認証の代わりにはなりません。接続URLを他人に共有しないでください。GitHub Actionsの起動には数分かかることがあります。

## 接続先
- 非公開実行リポジトリ: kentarourus/taiwan-private-cli
- Workflow: .github/workflows/chat.yml (workflow_dispatchのみ)
- Pages画面: /taiwan-chat/
- Worker: taiwan-private-cli-bridge

## 認証の設定手順
1. Cloudflare Wranglerを `account:read user:read workers_scripts:write` でログイン。
2. GitHub Fine-grained tokenを作成。対象は `taiwan-private-cli` のみ、Actions read/write、Metadata read、期限付き。Workerの `GITHUB_TOKEN` Secretに登録。チャットや公開ソースへ貼らない。
3. この試作専用のChatGPT CLIログイン情報を、非公開実行リポジトリのActions Secret `TAIWAN_CODEX_AUTH_JSON` に登録。API keyではなくChatGPT認証を利用。認証の移設には本人の承認が必要。公開repoにauth.jsonをコミットしない。
4. Workerの `ACCESS_PATH` Secretに十分長いランダムな値を設定。
5. Workerをデプロイし、`https://…workers.dev/<ACCESS_PATH>` を接続URLとして設定。

## データ
会話入力はworkflowの入力、回答はprivate artifact `private-answer` として保存される。artifactの保存期間は1日。公開Pagesには会話やトークンを保存しない。GitHub実行履歴の保持設定はリポジトリ側で管理する。会話履歴と接続先はブラウザーのlocalStorageに保持する。会話は一覧から再開・削除できる。接続先の設定欄は表示しない。AIへ送る文脈は直近7件（各1500文字まで）で、端末上の全文保存は切り詰めない。

## 検証状況
2026-11-16: 専用のChatGPT認証をprivate repoのSecretに登録済み。GitHub Actions run 43807678050でgpt-6-luna / mediumを実行し、研修旅行の日付回答を確認済み。Cloudflare Workerも配置済み。専用GitHub ActionsトークンをWorkerへ登録済み。Worker経由でジョブ起動から回答取得まで確認済み。

## 専用ログインの補助
`npm install --prefix outputs/private-cli-tools --no-save --package-lock=false libsodium-wrappers` の後、`node private-taiwan-cli/setup-auth.mjs <codex.exeのパス>` を実行する。本人が通常のブラウザーログインを完了すると、専用認証だけを暗号化してprivate repoのSecretへ登録する。通常利用のCodex認証には変更を加えない。

## 応答待ちと参照情報
画面は実際のGitHubジョブ段階（起動待ち・準備・回答作成・回答取得）と経過時間を表示する。完了率の推測表示はしない。CLI本体だけを固定バージョンのキャッシュから復元し、認証と会話はキャッシュに入れない。ブラウザーは送信直後に状態を確認し、その後2.5秒ごとに取得する。

Web検索はliveで有効。天気に関する質問はOpen-Meteoから台湾時間の予報を取得し、日付・地点・出典を添えてモデルへ渡す。台北を基本とし、質問で指定された九份・高雄・台南・台中・花蓮・基隆にも対応。予報期間外と欠測値を推測で埋めない。関連する観光・交通・警報は公式サイトを優先して検索する。会話・検索イベント本文を実行ログへ出さず、検索回数のみ結果に付加する。

利用者の追加承認により個人PCの常駐方式へ移行。登録されたPCへの接続失敗時は自動で別の処理を起動せず、PCの電源・ネットワーク確認を案内する。

## 使用量と画面
CLIのturn.completedイベントから入力・出力・入力キャッシュ・推論出力の使用量を取得し、結果artifact経由で画面へ渡す。入力内キャッシュと出力内推論は内数として扱い、総数へ再加算しない。画面では回答ごとの実測値と、端末に保存された会話の取得済み回答分の累計を表示する。過去の未取得分・失敗実行・他端末の会話は含まず、プランの残量や料金を意味しない。

履歴欄はデスクトップでも収納・再表示でき、状態を端末に保存する。Markdownはmarkdown-itでHTMLを無効にして表示し、外部リンクにはnoopener/noreferrerを付ける。画像の自動読込は無効。

## 個人PCの常駐版
`daemon/server.mjs`は127.0.0.1:8793だけで待ち受け、専用Bearer接続鍵で認証。URLを知るだけでは直接利用できない。Codex app-serverを起動したまま再利用し、各質問はephemeralスレッド・read-only・コマンド/アプリ/プラグイン無効で処理する。会話本文・秘密情報をjournalへ出さない。サーバー側の回答はメモリー上に最大24時間保持し、PC再起動で消える。ブラウザーの会話履歴は残る。

`daemon/tunnel.mjs`がチャット専用ポートだけをCloudflare Quick Tunnelにつなぎ、専用鍵でWorkerへ接続先を登録。登録先はSQLite Durable Objectに保存。個人試作用のQuick Tunnelは固定URLや稼働率の保証がなく、再作成時のURL変更は自動登録する。SSHポート・PCのファイル配信は追加しない。PCの電源とネット接続が必要。systemd userサービスとlingerでログアウト後の継続・起動時の開始・障害時の再起動を設定する。

runtime.json（token, bridge）とChatGPT認証auth/auth.jsonはPCの専用フォルダー内でmode 600。認証情報や接続鍵を公開リポジトリへ入れない。Worker側はLOCAL_RUNNER_TOKEN Secretを使用。レート制限は従来の2回/分を維持。

画面の＋から現在地を取得し、プレビューを確認・取り消しできる。位置は送信したときだけ会話に含め、地図リンク・精度・取得時刻を添える。位置を送信した会話はブラウザーに保存される。現在地の天気を尋ねた場合は共有座標を予報取得に使い、明示した都市名を優先する。
