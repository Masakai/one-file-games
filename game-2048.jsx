import { useState, useCallback, useEffect, useRef } from "react";

const SIZE = 4;

const TILE_STYLES = {
  2:    { bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  4:    { bg: "#fde68a", color: "#92400e", border: "#fcd34d" },
  8:    { bg: "#fdba74", color: "#ffffff", border: "#fb923c" },
  16:   { bg: "#fb923c", color: "#ffffff", border: "#f97316" },
  32:   { bg: "#f87171", color: "#ffffff", border: "#ef4444" },
  64:   { bg: "#ef4444", color: "#ffffff", border: "#dc2626" },
  128:  { bg: "#fbbf24", color: "#ffffff", border: "#f59e0b" },
  256:  { bg: "#f59e0b", color: "#ffffff", border: "#d97706" },
  512:  { bg: "#a78bfa", color: "#ffffff", border: "#8b5cf6" },
  1024: { bg: "#8b5cf6", color: "#ffffff", border: "#7c3aed" },
  2048: { bg: "#ffd700", color: "#ffffff", border: "#eab308" },
};

function getStyle(val) {
  if (TILE_STYLES[val]) return TILE_STYLES[val];
  if (val > 2048) return { bg: "#1e293b", color: "#ffd700", border: "#0f172a" };
  return { bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" };
}

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addRandom(grid) {
  const empty = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] === 0) empty.push([r, c]);
  if (empty.length === 0) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const g = grid.map(row => [...row]);
  g[r][c] = Math.random() < 0.9 ? 2 : 4;
  return g;
}

function initGrid() {
  let g = emptyGrid();
  g = addRandom(g);
  g = addRandom(g);
  return g;
}

function slideRow(row) {
  const filtered = row.filter(v => v !== 0);
  const result = [];
  let score = 0;
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const merged = filtered[i] * 2;
      result.push(merged);
      score += merged;
      i += 2;
    } else {
      result.push(filtered[i]);
      i++;
    }
  }
  while (result.length < SIZE) result.push(0);
  return { row: result, score };
}

function moveLeft(grid) {
  let score = 0;
  const g = grid.map(row => {
    const { row: newRow, score: s } = slideRow(row);
    score += s;
    return newRow;
  });
  return { grid: g, score };
}

function rotate90(grid) {
  const g = emptyGrid();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      g[c][SIZE - 1 - r] = grid[r][c];
  return g;
}

function rotate270(grid) { return rotate90(rotate90(rotate90(grid))); }
function rotate180(grid) { return rotate90(rotate90(grid)); }

function move(grid, dir) {
  let g = grid;
  if (dir === "right") g = rotate180(g);
  else if (dir === "up") g = rotate90(g);
  else if (dir === "down") g = rotate270(g);

  const { grid: moved, score } = moveLeft(g);

  if (dir === "right") return { grid: rotate180(moved), score };
  if (dir === "up") return { grid: rotate270(moved), score };
  if (dir === "down") return { grid: rotate90(moved), score };
  return { grid: moved, score };
}

function gridsEqual(a, b) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (a[r][c] !== b[r][c]) return false;
  return true;
}

function canMove(grid) {
  for (const dir of ["left", "right", "up", "down"]) {
    const { grid: g } = move(grid, dir);
    if (!gridsEqual(grid, g)) return true;
  }
  return false;
}

function hasWon(grid) {
  return grid.some(row => row.some(v => v >= 2048));
}

const CELL = 78;
const GAP = 6;
const BOARD_PX = SIZE * CELL + (SIZE - 1) * GAP;
const MOVE_ANIM_MS = 260;
const SWIPE_THRESHOLD = 24;

function detectSwipe(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return null;
  if (absDx > absDy) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function getLineCoords(line, dir) {
  if (dir === "left") return Array.from({ length: SIZE }, (_, i) => ({ r: line, c: i }));
  if (dir === "right") return Array.from({ length: SIZE }, (_, i) => ({ r: line, c: SIZE - 1 - i }));
  if (dir === "up") return Array.from({ length: SIZE }, (_, i) => ({ r: i, c: line }));
  return Array.from({ length: SIZE }, (_, i) => ({ r: SIZE - 1 - i, c: line }));
}

function buildMovePlan(grid, dir) {
  const nextGrid = emptyGrid();
  const tiles = [];
  let score = 0;
  let moved = false;
  let idSeed = 0;

  for (let line = 0; line < SIZE; line++) {
    const coords = getLineCoords(line, dir);
    const nonZero = coords
      .map(({ r, c }) => ({ r, c, value: grid[r][c] }))
      .filter(t => t.value !== 0);

    let i = 0;
    let target = 0;
    while (i < nonZero.length) {
      const cur = nonZero[i];
      const dst = coords[target];

      if (i + 1 < nonZero.length && nonZero[i + 1].value === cur.value) {
        const nxt = nonZero[i + 1];
        const merged = cur.value * 2;
        nextGrid[dst.r][dst.c] = merged;
        score += merged;

        const movedA = cur.r !== dst.r || cur.c !== dst.c;
        const movedB = nxt.r !== dst.r || nxt.c !== dst.c;
        moved = moved || movedA || movedB;

        tiles.push({ id: idSeed++, value: cur.value, fromR: cur.r, fromC: cur.c, toR: dst.r, toC: dst.c, moving: movedA });
        tiles.push({ id: idSeed++, value: nxt.value, fromR: nxt.r, fromC: nxt.c, toR: dst.r, toC: dst.c, moving: movedB });
        i += 2;
      } else {
        nextGrid[dst.r][dst.c] = cur.value;
        const isMoving = cur.r !== dst.r || cur.c !== dst.c;
        moved = moved || isMoving;
        tiles.push({ id: idSeed++, value: cur.value, fromR: cur.r, fromC: cur.c, toR: dst.r, toC: dst.c, moving: isMoving });
        i += 1;
      }
      target += 1;
    }
  }

  return { moved, score, nextGrid, tiles };
}

function tileFontSize(val) {
  if (val >= 1024) return "1rem";
  if (val >= 128) return "1.2rem";
  return "1.5rem";
}

function tilePos(r, c) {
  const step = CELL + GAP;
  return { x: c * step, y: r * step };
}

export default function Game2048() {
  const [grid, setGrid] = useState(() => initGrid());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animStarted, setAnimStarted] = useState(false);
  const [animTiles, setAnimTiles] = useState([]);
  const touchRef = useRef(null);
  const moveTimerRef = useRef(null);

  const [showHelp, setShowHelp] = useState(false);

  const doMove = useCallback((dir) => {
    if (gameOver || isAnimating) return;
    const plan = buildMovePlan(grid, dir);
    if (!plan.moved) return;

    setAnimTiles(plan.tiles);
    setAnimStarted(false);
    setIsAnimating(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimStarted(true)));

    if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
    moveTimerRef.current = setTimeout(() => {
      const g = addRandom(plan.nextGrid);
      const newScore = score + plan.score;
      setGrid(g);
      setScore(newScore);
      if (newScore > best) setBest(newScore);
      if (!keepPlaying && hasWon(g) && !won) setWon(true);
      if (!canMove(g)) setGameOver(true);
      setIsAnimating(false);
      setAnimStarted(false);
      setAnimTiles([]);
    }, MOVE_ANIM_MS);
  }, [grid, score, best, gameOver, won, keepPlaying, isAnimating]);

  useEffect(() => {
    return () => {
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
      if (map[e.key]) { e.preventDefault(); doMove(map[e.key]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doMove]);

  // Touch support
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchMove = (e) => {
    if (touchRef.current) e.preventDefault();
  };
  const handleTouchEnd = (e) => {
    if (!touchRef.current) return;
    const t = e.changedTouches[0];
    const dir = detectSwipe(touchRef.current, { x: t.clientX, y: t.clientY });
    touchRef.current = null;
    if (dir) doMove(dir);
  };
  const handleTouchCancel = () => { touchRef.current = null; };

  const resetGame = () => {
    setGrid(initGrid()); setScore(0); setGameOver(false);
    setWon(false); setKeepPlaying(false);
    setIsAnimating(false);
    setAnimStarted(false);
    setAnimTiles([]);
    if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
  };

  const maxTile = Math.max(...grid.flat());

  const HelpModal = () => {
    if (!showHelp) return null;
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }} onClick={() => setShowHelp(false)}>
        <div onClick={e => e.stopPropagation()} style={{
          background: "#ffffff", borderRadius: "18px",
          padding: "28px 32px", maxWidth: "380px", width: "90%",
          border: "1px solid #e2e8f0",
          boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
        }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#1e293b", marginBottom: "14px" }}>
            2048のルール
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>1.</span>
            <span>矢印キーまたはスワイプでタイルを上下左右にスライドさせます。</span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>2.</span>
            <span>同じ数字のタイル同士がぶつかると合体して倍の数字になります。</span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>3.</span>
            <span>スライドするたびに新しいタイル（2か4）が1つ出現します。</span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>4.</span>
            <span>2048のタイルを作ればクリア！達成後も続けてさらに上を目指せます。</span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>5.</span>
            <span>動かせなくなったらゲームオーバーです。</span>
          </div>
          </div>
          <button onClick={() => setShowHelp(false)} style={{
            marginTop: "18px", width: "100%", padding: "10px",
            background: "#f1f5f9", color: "#475569",
            border: "1px solid #e2e8f0", borderRadius: "10px",
            fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
          }}>閉じる</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#ffffff",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Nunito', 'Hiragino Sans', sans-serif",
      color: "#1e293b", padding: "24px 16px", userSelect: "none",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;900&family=Fredoka+One&display=swap" rel="stylesheet" />

      <HelpModal />
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
        <h1 style={{
          fontFamily: "'Fredoka One', cursive",
          fontSize: "2.2rem", letterSpacing: "0.04em", margin: 0, color: "#1e293b",
        }}>2048</h1>
        <button onClick={() => setShowHelp(true)} style={{
          width: "32px", height: "32px", borderRadius: "50%",
          background: "#f1f5f9", color: "#64748b",
          border: "1.5px solid #e2e8f0",
          fontSize: "0.85rem", fontWeight: 800, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>?</button>
      </div>

      <a href="./index.html" style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        padding: "6px 12px", marginBottom: "12px",
        borderRadius: "999px", border: "1.5px solid #cbd5e1",
        background: "#ffffff", color: "#334155",
        textDecoration: "none", fontSize: "0.72rem", fontWeight: 800,
        letterSpacing: "0.04em",
      }}>← ゲーム一覧へ</a>
<div style={{ fontSize: "0.7rem", color: "#94a3b8", letterSpacing: "0.12em", marginBottom: "14px" }}>
        タイルを合体させて2048を目指せ
      </div>

      {/* Score */}
      <div style={{
        display: "flex", gap: "8px", marginBottom: "14px",
      }}>
        <div style={{
          padding: "6px 20px", borderRadius: "10px", textAlign: "center",
          background: "#f8fafc", border: "1px solid #e2e8f0",
        }}>
          <div style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 600 }}>SCORE</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#1e293b", fontFamily: "monospace" }}>{score}</div>
        </div>
        <div style={{
          padding: "6px 20px", borderRadius: "10px", textAlign: "center",
          background: "#f8fafc", border: "1px solid #e2e8f0",
        }}>
          <div style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 600 }}>BEST</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#ca8a04", fontFamily: "monospace" }}>{best}</div>
        </div>
        <div style={{
          padding: "6px 16px", borderRadius: "10px", textAlign: "center",
          background: "#f8fafc", border: "1px solid #e2e8f0",
        }}>
          <div style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 600 }}>MAX</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 900, color: getStyle(maxTile).bg === "#f1f5f9" ? "#64748b" : getStyle(maxTile).border, fontFamily: "monospace" }}>{maxTile}</div>
        </div>
      </div>

      {/* Board */}
      <div style={{
        background: "#e2e8f0", borderRadius: "14px",
        padding: `${GAP}px`,
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        position: "relative",
        touchAction: "none",
      }}>
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          style={{ width: BOARD_PX, height: BOARD_PX, position: "relative" }}
        >
          <div style={{
            position: "absolute", inset: 0,
            display: "grid",
            gridTemplateColumns: `repeat(${SIZE}, ${CELL}px)`,
            gridTemplateRows: `repeat(${SIZE}, ${CELL}px)`,
            gap: `${GAP}px`,
          }}>
            {Array.from({ length: SIZE * SIZE }).map((_, i) => (
              <div key={i} style={{
                width: CELL, height: CELL, borderRadius: "10px",
                background: "#f1f5f9",
              }} />
            ))}
          </div>

          {!isAnimating && grid.flat().map((val, i) => {
            if (val === 0) return [];
            const r = Math.floor(i / SIZE);
            const c = i % SIZE;
            const p = tilePos(r, c);
            const s = getStyle(val);
            return (
              <div key={`tile-${r}-${c}-${val}`} style={{
                position: "absolute",
                left: p.x, top: p.y,
                width: CELL, height: CELL, borderRadius: "10px",
                background: s.bg,
                border: `2px solid ${s.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: tileFontSize(val), fontWeight: 900, color: s.color,
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                animation: "tilePop 0.12s ease-out",
              }}>
                {val}
              </div>
            );
          })}

          {isAnimating && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {animTiles.map((tile) => {
                const from = tilePos(tile.fromR, tile.fromC);
                const to = tilePos(tile.toR, tile.toC);
                const s = getStyle(tile.value);
                return (
                  <div key={`anim-${tile.id}`} style={{
                    position: "absolute",
                    left: from.x, top: from.y,
                    width: CELL, height: CELL, borderRadius: "10px",
                    background: s.bg,
                    border: `2px solid ${s.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: tileFontSize(tile.value), fontWeight: 900, color: s.color,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                    transition: `transform ${MOVE_ANIM_MS}ms cubic-bezier(0.22, 0.8, 0.2, 1)`,
                    transform: (animStarted && tile.moving)
                      ? `translate(${to.x - from.x}px, ${to.y - from.y}px)`
                      : "translate(0px, 0px)",
                    zIndex: tile.moving ? 2 : 1,
                  }}>
                    {tile.value}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Overlay */}
        {(gameOver || (won && !keepPlaying)) && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: "14px",
            background: "rgba(255,255,255,0.75)", backdropFilter: "blur(2px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            animation: "fadeInUp 0.4s ease",
          }}>
            <div style={{
              fontSize: "1.3rem", fontWeight: 900,
              color: won ? "#ca8a04" : "#dc2626",
              marginBottom: "8px",
            }}>
              {won ? "🎉 2048達成！" : "ゲームオーバー"}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "14px" }}>
              スコア: {score}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {won && !keepPlaying && (
                <button onClick={() => setKeepPlaying(true)} style={{
                  padding: "8px 20px", background: "#ca8a04", color: "#fff",
                  border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
                }}>続ける</button>
              )}
              <button onClick={resetGame} style={{
                padding: "8px 20px", background: "#1e293b", color: "#fff",
                border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
              }}>やり直す</button>
            </div>
          </div>
        )}
      </div>

      <button onClick={resetGame} style={{
        marginTop: "16px", padding: "8px 24px",
        background: "#f1f5f9", color: "#475569",
        border: "1.5px solid #e2e8f0", borderRadius: "10px",
        fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
      }}>リセット</button>

      <div style={{
        marginTop: "14px", fontSize: "0.7rem", color: "#94a3b8",
        textAlign: "center", fontWeight: 600, lineHeight: 1.8,
      }}>
        矢印キーまたはスワイプで操作
      </div>
      <div style={{
        marginTop: "8px",
        padding: "8px 12px",
        borderRadius: "10px",
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        fontSize: "0.7rem",
        color: "#64748b",
        textAlign: "center",
        lineHeight: 1.7,
      }}>
        例: <b style={{ color: "#334155" }}>2 + 2 = 4</b>（同じ数字だけ合体）<br />
        1手ごとに <b style={{ color: "#334155" }}>2 / 4</b> が1つ追加されます
      </div>

      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes tilePop { from { transform: scale(0.93); } to { transform: scale(1); } }
      `}</style>
    </div>
  );
}
