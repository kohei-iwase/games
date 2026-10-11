# games

ゲーム制作用リポジトリ。現在の作品は `kaijo-minnezang/`（海城のミンネザング）。詳細は各ディレクトリの README を参照。

## モデルの使い分け

メインの会話は Opus で、相談・設計判断・全体の進行を担当する。作業は次のサブエージェントに任せる。

| 用途 | サブエージェント | モデル |
|---|---|---|
| ファイル・仕様・用法の検索、調査 | `searcher` | Haiku |
| 方針が決まった実装、テストの追加と実行 | `implementer` | Sonnet |
| 設計・バランス・仕様の深い検討（セカンドオピニオン） | `advisor` | Opus |
| OpenAI Codex による実装（ユーザーが指定したとき、別モデルの案を比べたいとき） | `codex` | Codex CLI（操作役は Sonnet） |

- 複数ファイルにまたがる調査は、自分で読み回らず `searcher` に任せる。
- 実装は、変更箇所と仕様を明確にしてから `implementer` に渡す。返ってきた差分とテスト結果は自分で確認してからコミットする。
- `codex` には、ユーザーが Codex・GPT 系モデルを指定したときだけ任せる。既定の実装担当は `implementer`。`codex` を使うには、環境に `OPENAI_API_KEY` を登録し、`api.openai.com` への通信を許可しておく必要がある。モデルは環境変数 `CODEX_MODEL` で指定できる。
- 1〜2行の修正や、すでに開いているファイルの小さな変更は、委任せずに直接行ってよい。
- ユーザーとの相談、仕様の決定、コミット・プッシュはメインの会話で行う。

## テスト

```sh
cd kaijo-minnezang
node tests/combat.mjs
node tests/campaign.mjs
node tests/geometry3d.mjs
```
