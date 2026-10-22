# ACT SDLC Workflows

natserract の開発ワークフロー向け Claude Code プラグインです。作業は Linear の Issue として始まり、act-sdlc がアイデアからリリースまでの道のりをサポートします。

```text
 Linear Issue ──► /plan ──► /to-spec ──► Linearでレビュー ──► /start ──► /verify ──► リリース
                 トリアージ    RFCの作成      (人が承認する)        1度に1つの   テスト、設計、
                 と分割                                           タスクを構築 セキュリティの確認
```

各 Issue には、Linear 上で1つの **RFC**（計画ドキュメント）が作成されます。チームがそこでレビューと承認を行い、Claude はそれに従って作業の構築と確認を行います。

## クイックスタート

**1. インストール** (初回のみ):

```bash
claude plugin marketplace add natserract/ai
claude plugin install act-sdlc@actual
```

**2. マシンのセットアップ** (初回のみ)、Claude Code 内で実行します:

```
/act-sdlc:init      # ワークスペース ~/.act/ を作成します
/act-sdlc:setup     # 翻訳用 API キーを追加します (任意)
```

**3. Issue に取り組む** (例: ACT-95):

| ステップ | 実行コマンド | 何が起こるか |
| :- | :- | :- |
| 1. 計画 | `/act-sdlc:plan ACT-95` | Issue の準備ができているか確認し、ラベルを追加します。大きすぎる場合はサブ Issue に分割します。 |
| 2. 計画の作成 | `/act-sdlc:to-spec ACT-95` | RFC を作成し、Linear の Issue に投稿します。 |
| 3. 承認 | *(Linear上)* | チームが RFC をレビューし、Issue を **In Progress (進行中)** に移動させます。 |
| 4. 構築 | `/act-sdlc:start ACT-95` | 現在のリポジトリの次のタスクを実行し、確認した上で RFC にチェックを入れます。次のタスクに進むには再度実行します。 |
| 5. 確認 | `/act-sdlc:verify ACT-95` | テスト、設計、セキュリティを確認し、合格か不合格かを RFC に記録します。 |
| 6. リリース | *(Linear上)* | リリースを行い、Issue を **Done/Released (完了/リリース済み)** に移動させます。 |

迷ったときは？ いつでも `/act-sdlc:status ACT-95` を実行してください。Issue の現在の状況と、次に行うべきことを教えてくれます。

## コマンド

### 日常業務

| コマンド | 用途 |
| :- | :- |
| `/act-sdlc:plan <issue>` | Issue のトリアージを行います。大きな Issue は小さなサブ Issue に分割します。 |
| `/act-sdlc:to-spec <issue>` | Issue の RFC を作成し、Linear に投稿します。 |
| `/act-sdlc:start <issue>` | 現在のリポジトリで、RFC の次のタスクを構築します。 |
| `/act-sdlc:verify <issue>` | リリース前に、現在のリポジトリの完了した作業を確認します。 |
| `/act-sdlc:status <issue>` | Issue の現状と次のステップを確認します。 |
| `/act-sdlc:review <PR link or issue>` | チームメンバーのプルリクエスト (PR) をレビューします。 |

### 閲覧

| コマンド | 用途 |
| :- | :- |
| `/act-sdlc:open <issue>` | 設定した言語で RFC を開きます (`--en` で英語、`--linear` で Linear 上で開きます)。 |
| `/act-sdlc:translate-issue <issue>` | Linear の Issue をあなたの言語に翻訳します。 |

### セットアップ

| コマンド | 用途 |
| :- | :- |
| `/act-sdlc:init` | ワークスペース `~/.act/` を作成します (マシンごとに1回)。 |
| `/act-sdlc:setup` | 翻訳 API キーを追加または確認します。 |
| `/act-sdlc:config` | 設定を表示または変更します。 |

`<issue>` は `ACT-95` のような Issue キー、または Linear Issue の URL を指します。

<details>
<summary><b>各コマンドのオプション</b></summary>

| コマンド | オプション |
| :- | :- |
| `plan` | `--no-split`: サブ Issue を作成せずに、提案された分割案のみを表示します。 |
| `to-spec` | `--no-publish`: RFC を Linear に投稿せず、マシン上に保存したままにします。 |
| `start` | `--task 2.2`: 特定のタスクを指定します。 `--group 3`: タスクグループ全体を指定します。 `--all`: 未完了のすべてのタスクを指定します。 `--force`: RFC が承認される前に開始します。 |
| `verify` | `--deep`: より深いセキュリティレビューを実行します。 `--base <branch>`: 別のブランチと比較します。 |
| `review` | `--deep`: より深いセキュリティレビューを実行します。 `--no-comment`: PR にコメントを投稿しません。 |
| `open` | `--en`: 英語の RFC を表示します。 `--linear`: Linear 上で開きます。 `--print`: チャット内に表示します。 |
| `translate-issue` | `--lang in`: 別の言語に翻訳します。 `--force`: 再翻訳します。 `--summary`: 要約のみを表示します。 |

</details>

## 各ステップの確認内容

- **`/plan`:** Issue が明確であり、受け入れ基準（Acceptance Criteria）があるかを確認します。1つの RFC に収まる適切なサイズですか？大きすぎる場合は、まず答えるべき質問である **decision（決定）** チケットと **work（作業）** チケットに分割され、順序付けが行われます。
- **`/to-spec`:** RFC は4つのパートで構成されます:
  1. **Proposal (提案):** なぜその作業が必要なのか。
  2. **Requirements (要件):** テスト可能なシナリオとして、何が真でなければならないか。
  3. **Design (設計):** どのように動作するか。[コールグラフ (Call Graph)](docs/call-graph.md) の図や、コードの各部分について**誰に聞くべきか**を含みます。
  4. **Tasks (タスク):** チェックリスト。各タスクには関連するリポジトリがタグ付けされます。
- **`/start`:** RFC の設計に従い、各タスク独自のチェックを実行し、その後にのみタスクにチェックを入れます。
- **`/verify`:** すべてのシナリオに対する合格テスト、コードと設計の一致、コードレビュー、および OWASP Top 10 に基づく [セキュリティレビュー](docs/security-review.md) を確認します。認証、決済、個人データなどの機密領域については、より深く検証します。
- **`/review`:** チェックアウトせずに、プルリクエストに対して同じチェックを行います。PR にレビューコメントを投稿したり、選択した指摘事項を新しい Linear Issue に変換したりできます。

## act-sdlc が変更するもの、変更しないもの

| 場所 | act-sdlc が行う可能性があること | 決して行わないこと |
| :- | :- | :- |
| **Linear** | RFC と1つのコメントの投稿 (`/to-spec`)、ラベルの追加とサブ Issue の作成 (`/plan`)、タスクへのチェック入れ (`/start`)、RFC への verify 結果の記録 (`/verify`)、選択した Issue の作成 (`/review`) | Issue のステータス、担当者、タイトル、説明の変更、またはラベルの削除 |
| **GitHub** | 選択した場合に PR へコメントレビューを投稿 (`/review`) | Approve（承認）または Request Changes（変更要求） |
| **あなたのコード** | 構築中のファイルの編集 (`/start`) およびテストの追加 (`/verify`) | ブランチの作成・切り替え、コミット、プッシュ。Git の操作はあなたが行います。 |
| **あなたのマシン** | ドラフトと翻訳を `~/.act/` に、設定を `~/.config/act-sdlc/` に保存します。 | アプリのリポジトリにファイルを追加すること |

Issue ステータスの移動、作業の割り当て、PR の承認は人間が行います。

## 設定

設定は個人ごとのものです。`/act-sdlc:config` で変更できます:

```
/act-sdlc:config show                          # すべての設定を表示
/act-sdlc:config set translate.language jp     # 日本語に翻訳する
/act-sdlc:config set rfc.publish false         # RFC をマシン上にとどめる
```

| 設定 | デフォルト | 役割 |
| :- | :- | :- |
| `translate.language` | `id` | 国コードで指定するあなたの言語: `id` インドネシア語、`in` ヒンディー語、`jp` 日本語、[その他](docs/translation.md#choose-a-language) |
| `translate.provider` | `gemini` | 翻訳に使用する AI: `gemini`、`claude`、`openai`、`openrouter` |
| `translate.model` | 空 | 特定のモデル。`openai` と `openrouter` の場合は必須です |
| `translate.auto` | `false` | Linear Issue のリンクを貼り付けた際に自動的に翻訳します |
| `rfc.publish` | `true` | RFC を Linear に投稿します |
| `plan.autoSplit` | `true` | 大きな Issue を自動的にサブ Issue に分割します |
| `phases.lightLabels` | `Small Size` | 短い RFC を受け取る小さな Issue 用のラベル |
| `phases.callGraph` | `true` | 完全な RFC においてコールグラフ（Call Graph）を必須とします |
| `start.skills` | 空 | 各タスクで実行する追加のスキル (例: `code-review`) |

詳細: [docs/configuration.md](docs/configuration.md)

## インストールオプション

**必須要件:**
- Claude Code;
- Node.js 20.19 以降;
- claude.ai のコネクタ設定、または `/mcp` を通じて Linear が Claude に接続されていること;
- `/review` を使用する場合のみ、GitHub CLI (`gh`) にログインしていること。

**チーム全体での使用:** プロジェクトの `.claude/settings.json` に以下をコミットすると、プロジェクトを開いた全員にこのプラグインが提案されます:

```json
{
  "extraKnownMarketplaces": {
    "actual": { "source": { "source": "github", "repo": "natserract/ai" } }
  },
  "enabledPlugins": {
    "act-sdlc@actual": true
  }
}
```

**ローカルクローンからのインストール** (アップデートは `git pull` で行います):

```bash
git clone https://github.com/natserract/ai.git
cd ai
claude plugin marketplace add ./
claude plugin install act-sdlc@actual
```

**プラグイン自体の開発を行う場合:**

```bash
claude --plugin-dir ./workflows/act-sdlc
```

プラグインのソースコードは [`workflows/act-sdlc`](https://github.com/natserract/ai/tree/main/workflows/act-sdlc) にあります。`actual` マーケットプレイスは、リポジトリのルートにある `.claude-plugin/marketplace.json` で定義されています。

## 詳細を学ぶ

| ドキュメント | 読む目的 |
| :- | :- |
| [docs/lifecycle.md](docs/lifecycle.md) | 全体的なワークフロー: 7つのフェーズ、誰が何をするか、Issue がどう移動するか |
| [docs/call-graph.md](docs/call-graph.md) | コールグラフの描き方とレビュー方法 |
| [docs/security-review.md](docs/security-review.md) | セキュリティレビューの手法 |
| [docs/configuration.md](docs/configuration.md) | すべての設定と、ファイルが保存される場所 |
| [docs/translation.md](docs/translation.md) | 翻訳のセットアップ、言語、プロバイダーについて |

## 今後の予定

- **`/prototype`:** 不明瞭な設計上の疑問に答えるため、使い捨てのクイックな実験を行います。
- **`/handoff`:** 未完了の作業をチームメイトや新しいセッションに引き継ぎます。
- **`/report-bug`:** 本番環境のバグを、原因となった RFC にリンクされた Issue に変換します。