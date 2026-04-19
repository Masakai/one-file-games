# One File Games

1970年代頃からの古典的なコンピュータゲームを、JavaScriptでブラウザ向けに再現したゲーム集です。各ゲームは `*.html` から生成済みの `*.js` を読み込む構成で、`index.html` から一覧できます。

## 遊び方

`index.html` をブラウザで開くとゲーム一覧が表示されます。

ローカルサーバーで確認する場合:

```bash
python3 -m http.server 8127
```

その後、次を開きます。

```text
http://127.0.0.1:8127/index.html
```

## 収録ゲーム

| ゲーム | ファイル | 概要 |
|---|---|---|
| 2048 | `game-2048.html` | 同じ数字のタイルを合体させて 2048 を目指すパズル |
| オセロ | `othello.html` | 8x8 盤のリバーシ |
| ハノイの塔 | `hanoi.html` | 円盤をルール通りに移す古典パズル |
| 15パズル | `fifteen-puzzle.html` | スライド式の数字並べパズル |
| 四目並べ | `connect-four.html` | 縦・横・斜めに4つ並べる対戦ゲーム |
| 三目並べ | `tic-tac-toe.html` | 3x3 のマルバツゲーム |
| マインスイーパー | `minesweeper.html` | 地雷を避けて全マスを開くパズル |
| Hit & Blow | `hit-and-blow.html` | 数字の並びを推理するゲーム |
| ライツアウト | `lights-out.html` | 全てのライトを消す反転パズル |
| Lunar Lander | `lunar-lander.html` | 推力・燃料・速度を管理して月面へ着陸するゲーム |
| Rogue | `rogue.html` | ASCII 表示のダンジョン探索ゲーム |
| Super Star Trek | `super-startrek.html` | 古典的な宇宙戦術シミュレーション |
| Core War | `core-war.html` | Redcode 風プログラム同士のコアメモリ対戦 |
| Sokoban | `sokoban.html` | ドット絵表示の倉庫番パズル |

## 開発

編集対象は主に `*.jsx` です。配布用の `*.js` は `scripts/transpile-jsx.mjs` で再生成します。

```bash
node scripts/transpile-jsx.mjs
```

生成後、必要に応じて構文チェックします。

```bash
node --check rogue.js
node --check lunar-lander.js
node --check core-war.js
node --check sokoban.js
```

## ファイル構成

- `index.html`: ゲーム一覧ページ
- `*.html`: 各ゲームの単体起動ページ
- `*.jsx`: React で書いたゲーム本体
- `*.js`: ブラウザ配布用にバンドル済みの生成ファイル
- `scripts/transpile-jsx.mjs`: JSX から JS を生成するスクリプト
- `CHANGELOG.md`: リリース履歴

## 注意

- `node_modules/` と `.tmp-transpile/` は生成・依存関係用の作業ディレクトリです。
- 新しいゲームを追加した場合は、`scripts/transpile-jsx.mjs` の `games` 配列と `index.html` の一覧カードも更新してください。
