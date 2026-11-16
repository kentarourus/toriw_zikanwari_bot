# 個人用 台湾CLI相談

構成: unlisted Pages画面 → Cloudflare Worker → private GitHub Actions → Codex CLI (gpt-6-luna / medium)。

これはGitHubにログインした本人のための試作です。推測しにくいURLはアクセス認証の代わりにはなりません。接続URLを他人に共有しないでください。GitHub Actionsの起動には数分かかることがあります。

## 接続先
- 非公開実行リポジトリ: kentarourus/taiwan-private-cli
- Workflow: .github/workflows/chat.yml (workflow_dispatchのみ)
- Pages画面: /_private/taiwan-6b7e94d2/
- Worker: taiwan-private-cli-bridge

## 未設定の認証
1. Cloudflare Wranglerを `account:read user:read workers_scripts:write` でログイン。
2. GitHub Fine-grained tokenを作成。対象は `taiwan-private-cli` のみ、Actions read/write、Metadata read、期限付き。Workerの `GITHUB_TOKEN` Secretに登録。チャットや公開ソースへ貼らない。
3. この試作専用のChatGPT CLIログイン情報を、非公開実行リポジトリのActions Secret `TAIWAN_CODEX_AUTH_JSON` に登録。API keyではなくChatGPT認証を利用。認証の移設には本人の承認が必要。公開repoにauth.jsonをコミットしない。
4. Workerの `ACCESS_PATH` Secretに十分長いランダムな値を設定。
5. Workerをデプロイし、`https://…workers.dev/<ACCESS_PATH>` を接続URLとして設定。

## データ
会話入力はworkflowの入力、回答はprivate artifact `private-answer` として保存される。artifactの保存期間は1日。公開Pagesには会話やトークンを保存しない。GitHub実行履歴の保持設定はリポジトリ側で管理する。会話自体は画面のメモリーにのみ保持し、リロードで消える。

## 検証状況
CLIのLuna medium接続はローカルのChatGPTログインで確認済み。GitHub上での認証・Cloudflare連携・ブラウザーでの通し動作は、Secret設定後に検証が必要。

## 専用ログインの補助
`npm install --prefix outputs/private-cli-tools --no-save --package-lock=false libsodium-wrappers` の後、`node private-taiwan-cli/setup-auth.mjs <codex.exeのパス>` を実行する。本人がdeviceログインを完了すると、専用認証だけを暗号化してprivate repoのSecretへ登録する。通常利用のCodex認証には変更を加えない。
