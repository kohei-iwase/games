# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリ概要

ゲーム制作用のリポジトリ。現在の作品は `kaijo-minnezang/`（海城のミンネザング、3D戦術海戦の試作）のみ。詳細は各ディレクトリの README を参照。ルートの `.gitignore` はUnity用テンプレートだが、現行プロジェクトはUnityではなく素のWebGL + ES Modules。

このリポジトリは原則日本語で表示する。ゲーム内の表示テキスト（ラベル・見出し・ボタン等）、ドキュメント、コミットメッセージ、PRの説明は日本語で書く。キー名（Space, F, Q/W/E）など、英字のほうが自然なものは例外。

## ブランチ運用

- 作業ブランチ → `develop` へのマージは、テストが通っていれば確認なしで行ってよい。
- `main` へのマージ・プッシュはユーザーが手動で行う。Claude は `main` にプッシュ・マージしない（PRを作る場合も、マージはしない）。
- GitHub 側で `main` に force push 禁止・ブランチ削除禁止の保護ルールを設定している（PR必須やCI必須ではない）。`git push --force` は `main` 以外でも、ユーザーの指示なしには使わない。
- マージ済みの作業ブランチは `.github/workflows/delete-merged-branch.yml` が自動で削除する（`main` / `develop` は対象外）。PR のマージ時と、`develop` へマージコミットがプッシュされたとき（取り込まれたブランチの先端がマージ時のままの場合）に動く。クラウドセッションからはリモートブランチを削除できない（プロキシが403を返す）ので、Claude は削除を試みない。
- 作業ブランチの PR がマージされた（PR のマージ通知を受け取った、または自分で `develop` へのマージを終えた）ら、Claude はユーザーへの確認なしに、そのセッション自身をアーカイブしてよい（claude-code-remote の `archive_session` に自分のセッションIDを渡す。IDは `get_session` で確認する）。アーカイブ前に、未プッシュの変更がないことを確認し、結果を一言報告する。

## モデルの使い分け

メインの会話は Opus で、相談・設計判断・全体の進行を担当する。作業は次のサブエージェントに任せる。

| 用途 | サブエージェント | モデル |
|---|---|---|
| ファイル・仕様・用法の検索、調査 | `searcher` | Haiku |
| 方針が決まった実装、テストの追加と実行 | `implementer` | Sonnet |
| 設計・バランス・仕様の深い検討（セカンドオピニオン） | `advisor` | Opus |
| OpenAI Codex による実装（ユーザーが指定したとき、別モデルの案を比べたいとき） | `codex` | Codex CLI（操作役は Sonnet） |
| 世界観・キャラクター設定の草案（ユーザーが設定の作成を頼んだとき） | `lorekeeper` | Codex CLI（操作役は Sonnet） |
| キャラクター画像など画像の生成（ユーザーが画像の作成を頼んだとき） | `illustrator` | OpenAI 画像生成API（操作役は Sonnet） |

- 複数ファイルにまたがる調査は、自分で読み回らず `searcher` に任せる。
- 実装は、変更箇所と仕様を明確にしてから `implementer` に渡す。返ってきた差分とテスト結果は自分で確認してからコミットする。
- `codex` には、ユーザーが Codex・GPT 系モデルを指定したときだけ任せる。既定の実装担当は `implementer`。`codex` を使うには、Codex CLI（Node 16以上。nvm で導入した Node 22 を使う）をインストールし、APIキーでログイン済みにしておく（`printenv OPENAI_API_KEY | codex login --with-api-key` のように標準入力で渡す。状態確認は `codex login status`）。`api.openai.com` への通信も許可しておく。モデルは環境変数 `CODEX_MODEL` で指定できる。APIキーをファイルやチャットに書かない。
- `lorekeeper` の草案は `kaijo-minnezang/docs/setting/` に置き、採用するかはユーザーが決める。`illustrator` の画像は `kaijo-minnezang/art/` に置く。画像生成は枚数に応じて課金されるため、1回の依頼は最大2枚にする。`illustrator` は、APIキーをキーチェーン（サービス名 `openai-api-key`）から読む。
- 1〜2行の修正や、すでに開いているファイルの小さな変更は、委任せずに直接行ってよい。
- ユーザーとの相談、仕様の決定、コミット・プッシュはメインの会話で行う。

## kaijo-minnezang

### 起動・テスト

ビルド不要・外部依存なし（npm/package.jsonなし）。`dist/` がそのままソースで、編集対象もここ。

```sh
# リポジトリのルートから起動（ES Modulesのためfile://では不可）
python3 -m http.server 8000 --directory kaijo-minnezang/dist

# テスト（kaijo-minnezang/ で実行。各ファイルが単体のテストスクリプトで、assert失敗で非ゼロ終了）
cd kaijo-minnezang
node tests/combat.mjs       # 戦闘ルール（Battle）、難易度（現在は正騎士の1段階）、戦果報告
node tests/campaign.mjs     # エピローグ・助言・記録保存（localStorageはテスト内でモック）
node tests/geometry3d.mjs   # カメラ・座標の往復変換、メッシュの有限値。/tmp/minnezang-3d-scene.json を出力
```

追加環境が必要なテスト：
- `node tests/ui-smoke.mjs`：環境変数 `CODEX_PRIMARY_RUNTIME_NODE_MODULES` で示されるディレクトリの `@napi-rs/canvas` を `require` する。未設定だと失敗する。
- `python tests/native3d.py`：先に `geometry3d.mjs` を実行して生成したシーンJSONを読み、EGL/OpenGL ES（`libEGL.so.1`, `libGL.so.1`）とPillowでオフスクリーン描画し、`/tmp/minnezang-3d-native.png` を出力する。
- `tests/render.mjs` と `dist/render.mjs` は旧2D版の残骸で、現在のゲーム（`index.html`→`app.mjs`）からは読み込まれない。

### アーキテクチャ

依存方向は `app.mjs` → `battle.mjs` / `campaign.mjs` / `config.mjs` / `render3d.mjs` → `scene3d.mjs` / `shaders3d.mjs` / `space3d.mjs`。

- `battle.mjs`：DOM非依存の戦闘シミュレーション（`Battle` クラス、`ORDERS`、`SKILLS`、`DIFFICULTY`）。Nodeテストはこのモジュールを直接動かす。戦場は2D論理座標（`WIDTH=1000, HEIGHT=650`）で、血域の濃度、蓄血、イベントポーズ、スキル予約、拘束、ジョスト、勝敗はすべてここに置く。
- `campaign.mjs`：プロローグ、戦闘結果に応じたエピローグと助言、`localStorage` への記録保存。
- `config.mjs`：視点・自動ポーズ（`pauseMode`：`events`／`none`）・ジョスト入力補助・カットイン短縮の設定を `localStorage` に保存し、`applyConfig` で `Battle` に反映する。`Battle.autoPause` が false のとき `queuePause` はポーズせず `notice` に通知を残す（手動の `pause()` は常に有効）。旗艦は `battle.mjs` の `FLAGSHIP`（内部IDは `lance`、表示名はミラルカ）。
- `space3d.mjs`：行列演算、カメラ（`cameraState`）、論理座標から3Dへの変換（`world(x,y,h)` は `[x-500, h, y-325]`）、画面座標から海面へのレイ交差（`groundPoint`）、手続き生成メッシュ（`meshes`）。
- `scene3d.mjs`：`buildScene(battle, ...)` で Battle の状態から描画用のモデル一覧を作る純粋関数。`bloodTexture` で血域濃度をテクスチャ化する。
- `shaders3d.mjs`：GLSL文字列（照明・海面の波・血域）。WebGL版（`render3d.mjs`）とネイティブEGL版（`native3d.py`）が同じシェーダーを使う。
- `render3d.mjs`：WebGL描画、ラベル用の2Dキャンバス、カメラ操作。
- `app.mjs`：入力、HUD、カットイン、演出時間を担当。カットイン中は戦闘時間を止め、射出集中（ジョストのタイミング入力）中は戦闘速度を0.12倍にする。

ロジックをDOM・WebGLから切り離しているので、ゲームルールの変更は `battle.mjs` と `tests/combat.mjs`、見た目や座標の変更は `space3d.mjs` / `scene3d.mjs` と `tests/geometry3d.mjs` で検証できる。

### コードスタイル

`dist/*.mjs` は1行に多くを詰めた圧縮気味の手書きコード（1行800〜1000文字以上の行もある）。フォーマッターやリンターはない。編集時は既存の書き方に合わせ、ファイル全体を整形し直さない。

ブラウザ実機での操作・レイアウトは未確認（READMEに記載）。騎士名や数値は仮設定。
