# Changelog

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
