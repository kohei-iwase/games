# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## リポジトリ概要

ゲーム制作用のリポジトリ。現在のプロジェクトは `kaijo-minnezang/`（海城のミンネザング、3D戦術海戦の試作 v0.4）のみ。ルートの `.gitignore` はUnity用テンプレートだが、現行プロジェクトはUnityではなく素のWebGL + ES Modules。

ドキュメントやゲーム内テキストは日本語で書かれている。

## kaijo-minnezang

### 起動・テスト

ビルド不要・外部依存なし（npm/package.jsonなし）。`dist/` がそのままソースで、編集対象もここ。

```sh
# リポジトリのルートから起動（ES Modulesのためfile://では不可）
python3 -m http.server 8000 --directory kaijo-minnezang/dist

# テスト（kaijo-minnezang/ で実行。各ファイルが単体のテストスクリプトで、assert失敗で非ゼロ終了）
node tests/combat.mjs       # 戦闘ルール（Battle）
node tests/geometry3d.mjs   # カメラ・座標の往復変換、メッシュの有限値。/tmp/minnezang-3d-scene.json を出力
```

追加環境が必要なテスト：
- `node tests/ui-smoke.mjs`：環境変数 `CODEX_PRIMARY_RUNTIME_NODE_MODULES` で示されるディレクトリの `@napi-rs/canvas` を `require` する。未設定だと失敗する。
- `python tests/native3d.py`：先に `geometry3d.mjs` を実行して生成したシーンJSONを読み、EGL/OpenGL ES（`libEGL.so.1`, `libGL.so.1`）とPillowでオフスクリーン描画し、`/tmp/minnezang-3d-native.png` を出力する。
- `tests/render.mjs` と `dist/render.mjs` は旧2D版の残骸で、現在のゲーム（`index.html`→`app.mjs`）からは読み込まれない。

### アーキテクチャ

依存方向は `app.mjs` → `battle.mjs` / `render3d.mjs` → `scene3d.mjs` / `shaders3d.mjs` / `space3d.mjs`。

- `battle.mjs`：DOM非依存の戦闘シミュレーション（`Battle` クラス、`ORDERS`、`SKILLS`）。Nodeテストはこのモジュールを直接動かす。戦場は2D論理座標（`WIDTH=1000, HEIGHT=650`）で、血域の濃度、蓄血、イベントポーズ、スキル予約、拘束、ジョスト、勝敗はすべてここに置く。
- `space3d.mjs`：行列演算、カメラ（`cameraState`）、論理座標から3Dへの変換（`world(x,y,h)` は `[x-500, h, y-325]`）、画面座標から海面へのレイ交差（`groundPoint`）、手続き生成メッシュ（`meshes`）。
- `scene3d.mjs`：`buildScene(battle, ...)` で Battle の状態から描画用のモデル一覧を作る純粋関数。`bloodTexture` で血域濃度をテクスチャ化する。
- `shaders3d.mjs`：GLSL文字列（照明・海面の波・血域）。WebGL版（`render3d.mjs`）とネイティブEGL版（`native3d.py`）が同じシェーダーを使う。
- `render3d.mjs`：WebGL描画、ラベル用の2Dキャンバス、カメラ操作。
- `app.mjs`：入力、HUD、カットイン、演出時間を担当。カットイン中は戦闘時間を止め、射出集中（ジョストのタイミング入力）中は戦闘速度を0.12倍にする。

ロジックをDOM・WebGLから切り離しているので、ゲームルールの変更は `battle.mjs` と `tests/combat.mjs`、見た目や座標の変更は `space3d.mjs` / `scene3d.mjs` と `tests/geometry3d.mjs` で検証できる。

### コードスタイル

`dist/*.mjs` は1行に多くを詰めた圧縮気味の手書きコード（1行800〜1000文字以上の行もある）。フォーマッターやリンターはない。編集時は既存の書き方に合わせ、ファイル全体を整形し直さない。

ブラウザ実機での操作・レイアウトは未確認（READMEに記載）。騎士名や数値は仮設定。
