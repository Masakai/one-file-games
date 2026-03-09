import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const rootDir = process.cwd();
const tempDir = path.join(rootDir, ".tmp-transpile");
const parentDir = path.dirname(rootDir);

async function findNodeModuleDirs() {
  const localEntries = await readdir(rootDir, { withFileTypes: true });
  const parentEntries = await readdir(parentDir, { withFileTypes: true });

  return [
    ...localEntries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("node_modules"))
      .map((entry) => path.join(rootDir, entry.name)),
    ...parentEntries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("node_modules"))
    .map((entry) => path.join(parentDir, entry.name)),
  ];
}

const nodeModuleDirs = await findNodeModuleDirs();

let esbuildMainPath = null;
for (const dir of nodeModuleDirs) {
  const candidate = path.join(dir, "esbuild", "lib", "main.js");
  try {
    await readFile(candidate, "utf8");
    esbuildMainPath = candidate;
    break;
  } catch {
    // Continue searching candidate directories.
  }
}

if (!esbuildMainPath) {
  throw new Error("esbuild package not found");
}

const require = createRequire(import.meta.url);
const { build } = require(esbuildMainPath);

const games = [
  "connect-four",
  "fifteen-puzzle",
  "game-2048",
  "hanoi",
  "hit-and-blow",
  "lights-out",
  "minesweeper",
  "othello",
  "super-startrek",
  "tic-tac-toe",
];

function extractHeadBits(html, file) {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);

  if (!titleMatch || !styleMatch) {
    throw new Error(`head parse failed: ${file}`);
  }

  return {
    title: titleMatch[1],
    style: styleMatch[1],
  };
}

function renderHtml({ title, style, scriptName }) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>${style}</style>
</head>
<body>
  <div id="root"></div>
  <script src="./${scriptName}"></script>
</body>
</html>
`;
}

await mkdir(tempDir, { recursive: true });

for (const game of games) {
  const htmlPath = path.join(rootDir, `${game}.html`);
  const entryPath = path.join(tempDir, `${game}.entry.jsx`);
  const outPath = path.join(rootDir, `${game}.js`);

  const html = await readFile(htmlPath, "utf8");
  const { title, style } = extractHeadBits(html, htmlPath);

  const entrySource = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "../${game}.jsx";

createRoot(document.getElementById("root")).render(React.createElement(App));
`;

  await writeFile(entryPath, entrySource, "utf8");

  await build({
    entryPoints: [entryPath],
    outfile: outPath,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    jsx: "automatic",
    logLevel: "silent",
    nodePaths: nodeModuleDirs,
  });

  await writeFile(
    htmlPath,
    renderHtml({ title, style, scriptName: `${game}.js` }),
    "utf8",
  );
}
