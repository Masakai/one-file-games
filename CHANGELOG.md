# Changelog

## [v1.3.0] - 2026-05-14

### Added
- `yajikita-trail.html` に笑いパラメータのゲーム影響を実装（笑い低→移動コスト2倍、笑い高→草鞋消費なし）。
- `moving-mayhem.html` / `moving-mayhem.js` を追加し、物理演算を使った引っ越しゲームをブラウザで遊べるようにした。
- `index.html` に Moving Mayhem と弥次喜多トレイルへの導線を追加。

### Changed
- `yajikita-trail.html` のタイトルを「弥次喜多道中記」→「弥次喜多トレイル」に変更。
- `index.html` のゲームカード名を「弥次喜多トレイル」に変更。

## [v1.2.0] - 2026-04-19

### Added
- `lunar-lander.html` / `lunar-lander.jsx` / `lunar-lander.js` を追加し、月面着陸ゲームをピクセルアート風表示で遊べるようにした。
- `core-war.html` / `core-war.jsx` / `core-war.js` を追加し、Redcode 風のコアメモリ対戦を可視化した。
- `sokoban.html` / `sokoban.jsx` / `sokoban.js` を追加し、ドット絵表示の倉庫番パズルを実装した。
- `README.md` を追加し、プロジェクト概要、遊び方、収録ゲーム、開発手順を整理した。
- `index.html` の先頭に、70年代のレトロなコンピュータゲームを懐かしむヒーローセクションを追加した。
- `index.html` のフッタに著作権表示を追加した。

### Changed
- `scripts/transpile-jsx.mjs` の変換対象に `lunar-lander`、`core-war`、`sokoban` を追加。
- `index.html` に Lunar Lander、Core War、Sokoban への導線を追加。

## [v1.1.0] - 2026-04-19

### Added
- `rogue.html` / `rogue.jsx` / `rogue.js` を追加し、Rogue 風のASCIIダンジョン探索ゲームをブラウザで遊べるようにした。
- ランダム生成される部屋・通路・階段、モンスター、金貨・食料・薬・巻物・武器・鎧・魔除け、HP・経験値・スコアを実装。
- `index.html` に Rogue への導線を追加。
- Rogue の画面内にキー説明パネルを追加し、主要操作を常時確認できるようにした。

### Changed
- `scripts/transpile-jsx.mjs` の変換対象に `rogue` を追加。

## v1.0.2 - 2026-03-09

### Changed
- 各ゲームの配布形式を見直し、`*.jsx` をトランスパイルした `*.js` を追加して `html` から直接読み込む構成へ変更。
- 変換手順を再実行できるよう、`scripts/transpile-jsx.mjs` を追加。

### Fixed
- 各 `html` から `@babel/standalone` とインライン JSX を除去し、ランタイム変換に依存せず動作するよう修正。
- `super-startrek.jsx` の NAV/TOR コース入力欄に方角ガイドを追加し、1-8 の向きが分かりにくい問題を改善。

## v1.0.1 - 2026-03-08

### Fixed
- `game-2048.html` のタブレット向けスワイプ操作を修正し、iPad などでフリックが効かない問題を解消。
- `game-2048.html` と `game-2048.jsx` の2048盤面に移動アニメーションを追加し、タイルがどのセルへ動いたか視認しやすく改善。
- `game-2048.html` と `game-2048.jsx` の盤面描画不具合を修正し、行配列が数字列として表示される問題を解消。

## v1.0.0 - 2026-03-07

### Added
- `super-startrek.jsx` を追加し、SUPER STAR TREK をブラウザで遊べる形で実装。
- `super-startrek.html` を追加し、単体HTMLとして直接プレイ可能にした。
- `index.html` に Super Star Trek への導線を追加。

### Changed
- Super Star Trek のUIをプレイしやすいレイアウトへ調整（COMMAND/COMPUTER/GUIDE 構成）。

[v1.3.0]: https://github.com/Masakai/one-file-games/compare/v1.2.0...v1.3.0
[v1.2.0]: https://github.com/Masakai/one-file-games/compare/v1.1.0...v1.2.0
[v1.1.0]: https://github.com/Masakai/one-file-games/compare/v1.0.2...v1.1.0
