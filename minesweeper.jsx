import { useState, useCallback, useRef, useEffect } from "react";

const PRESETS = {
  easy:   { rows: 9,  cols: 9,  mines: 10, label: "初級" },
  medium: { rows: 12, cols: 12, mines: 24, label: "中級" },
  hard:   { rows: 16, cols: 16, mines: 50, label: "上級" },
};

function createBoard(rows, cols, mines, firstR, firstC) {
  const board = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, count: 0 }))
  );
  // Place mines avoiding first click and neighbors
  const safe = new Set();
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const nr = firstR + dr, nc = firstC + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols)
        safe.add(nr * cols + nc);
    }
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!board[r][c].mine && !safe.has(r * cols + c)) {
      board[r][c].mine = true;
      placed++;
    }
  }
  // Compute counts
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
      let cnt = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) cnt++;
        }
      board[r][c].count = cnt;
    }
  return board;
}

function cloneBoard(b) { return b.map(row => row.map(cell => ({ ...cell }))); }

function reveal(board, r, c, rows, cols) {
  const b = cloneBoard(board);
  const stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
    const cell = b[cr][cc];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.count === 0 && !cell.mine) {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr !== 0 || dc !== 0) stack.push([cr + dr, cc + dc]);
    }
  }
  return b;
}

const NUM_COLORS = ["", "#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#b45309", "#0891b2", "#1e293b", "#64748b"];

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function Minesweeper() {
  const [diff, setDiff] = useState("easy");
  const [board, setBoard] = useState(null);
  const [gameState, setGameState] = useState("ready"); // ready | playing | won | lost
  const [time, setTime] = useState(0);
  const [bestTimes, setBestTimes] = useState({ easy: null, medium: null, hard: null });
  const timerRef = useRef(null);
  const [showHelp, setShowHelp] = useState(false);

  const { rows, cols, mines } = PRESETS[diff];

  // Timer
  useEffect(() => {
    if (gameState === "playing") {
      timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState]);

  const resetGame = useCallback((d) => {
    const dd = d || diff;
    setDiff(dd);
    setBoard(null);
    setGameState("ready");
    setTime(0);
  }, [diff]);

  const flagCount = board ? board.flat().filter(c => c.flagged).length : 0;
  const revealedCount = board ? board.flat().filter(c => c.revealed).length : 0;
  const totalSafe = rows * cols - mines;

  // Check win
  useEffect(() => {
    if (gameState === "playing" && board && revealedCount === totalSafe) {
      setGameState("won");
      setBestTimes(prev => {
        const cur = prev[diff];
        if (cur === null || time < cur) return { ...prev, [diff]: time };
        return prev;
      });
    }
  }, [revealedCount, totalSafe, gameState, board, diff, time]);

  const handleClick = useCallback((r, c) => {
    if (gameState === "won" || gameState === "lost") return;
    if (board && board[r][c].flagged) return;

    let b;
    if (!board) {
      // First click
      b = createBoard(rows, cols, mines, r, c);
      b = reveal(b, r, c, rows, cols);
      setBoard(b);
      setGameState("playing");
      return;
    }

    if (board[r][c].revealed) {
      // Chord: if count matches adjacent flags, reveal neighbors
      const cell = board[r][c];
      if (cell.count === 0) return;
      let adjFlags = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].flagged) adjFlags++;
        }
      if (adjFlags === cell.count) {
        b = cloneBoard(board);
        let hitMine = false;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !b[nr][nc].flagged && !b[nr][nc].revealed) {
              if (b[nr][nc].mine) hitMine = true;
              b = reveal(b, nr, nc, rows, cols);
            }
          }
        setBoard(b);
        if (hitMine) { revealAllMines(b); setGameState("lost"); }
      }
      return;
    }

    b = cloneBoard(board);
    if (b[r][c].mine) {
      revealAllMines(b);
      b[r][c].exploded = true;
      setBoard(b);
      setGameState("lost");
      return;
    }
    b = reveal(board, r, c, rows, cols);
    setBoard(b);
  }, [board, gameState, rows, cols, mines]);

  const handleRightClick = useCallback((e, r, c) => {
    e.preventDefault();
    if (gameState === "won" || gameState === "lost") return;
    if (!board) return;
    if (board[r][c].revealed) return;
    const b = cloneBoard(board);
    b[r][c].flagged = !b[r][c].flagged;
    setBoard(b);
  }, [board, gameState]);

  function revealAllMines(b) {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (b[r][c].mine) b[r][c].revealed = true;
  }

  const cellSize = diff === "hard" ? 30 : diff === "medium" ? 34 : 38;
  const fontSize = diff === "hard" ? "0.75rem" : diff === "medium" ? "0.8rem" : "0.9rem";

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
            マインスイーパーのルール
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>1.</span>
            <span>マス目の下に地雷が隠れています。地雷を踏まずに安全なマスを全て開ければクリア。</span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>2.</span>
            <span>数字はそのマスの周囲8マスにある地雷の数を示します。</span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>3.</span>
            <span>右クリックで旗を立てて、地雷だと思う場所をマークできます。</span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>4.</span>
            <span>数字マスをクリックすると、周囲の旗の数が一致していれば残りを一括オープンできます。</span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>5.</span>
            <span>初手は必ず安全です。</span>
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
          fontSize: "1.8rem", letterSpacing: "0.06em", margin: 0, color: "#1e293b",
        }}>💣 マインスイーパー</h1>
        <button onClick={() => setShowHelp(true)} style={{
          width: "32px", height: "32px", borderRadius: "50%",
          background: "#f1f5f9", color: "#64748b",
          border: "1.5px solid #e2e8f0",
          fontSize: "0.85rem", fontWeight: 800, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>?</button>
      </div>
      <div style={{ fontSize: "0.7rem", color: "#94a3b8", letterSpacing: "0.12em", marginBottom: "14px" }}>
        Minesweeper
      </div>

      {/* Difficulty */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "14px" }}>
        {Object.entries(PRESETS).map(([key, val]) => (
          <button key={key} onClick={() => resetGame(key)} style={{
            padding: "5px 14px", borderRadius: "8px",
            border: diff === key ? "1.5px solid #1e293b" : "1.5px solid #e2e8f0",
            background: diff === key ? "#1e293b" : "#ffffff",
            color: diff === key ? "#ffffff" : "#64748b",
            fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
          }}>{val.label}</button>
        ))}
      </div>

      {/* Status bar */}
      <div style={{
        display: "flex", gap: "20px", alignItems: "center",
        marginBottom: "12px", fontSize: "0.85rem", fontWeight: 700,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "1.1rem" }}>💣</span>
          <span style={{ color: "#dc2626" }}>{mines - flagCount}</span>
        </div>
        <div style={{
          padding: "4px 14px", borderRadius: "8px",
          background: gameState === "won" ? "#f0fdf4" : gameState === "lost" ? "#fef2f2" : "#f8fafc",
          border: gameState === "won" ? "1.5px solid #86efac" : gameState === "lost" ? "1.5px solid #fecaca" : "1.5px solid #e2e8f0",
          fontSize: "1.1rem",
          transition: "all 0.3s",
        }}>
          {gameState === "won" ? "😎" : gameState === "lost" ? "💀" : "🙂"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "1rem" }}>⏱</span>
          <span style={{ color: "#2563eb", fontFamily: "monospace" }}>{formatTime(time)}</span>
        </div>
      </div>

      {/* Best time */}
      {bestTimes[diff] !== null && (
        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginBottom: "10px", fontWeight: 600 }}>
          🏆 ベスト: {formatTime(bestTimes[diff])}
        </div>
      )}

      {/* Board */}
      <div style={{
        background: "#f1f5f9", borderRadius: "12px", padding: "6px",
        border: "1.5px solid #e2e8f0",
        boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
        overflow: "auto",
        maxWidth: "95vw",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
          gap: "1.5px",
        }}>
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const cell = board ? board[r][c] : null;
              const revealed = cell?.revealed;
              const flagged = cell?.flagged;
              const mine = cell?.mine;
              const exploded = cell?.exploded;
              const count = cell?.count || 0;

              let bg = "#ffffff";
              let content = null;
              let textColor = "#1e293b";

              if (revealed) {
                if (mine) {
                  bg = exploded ? "#fecaca" : "#fef2f2";
                  content = "💣";
                } else if (count > 0) {
                  bg = "#f8fafc";
                  content = count;
                  textColor = NUM_COLORS[count];
                } else {
                  bg = "#f1f5f9";
                }
              } else if (flagged) {
                bg = "#fffbeb";
                content = "🚩";
              } else {
                bg = "#ffffff";
              }

              return (
                <div key={`${r}-${c}`}
                  onClick={() => handleClick(r, c)}
                  onContextMenu={e => handleRightClick(e, r, c)}
                  style={{
                    width: cellSize, height: cellSize,
                    background: bg,
                    border: revealed ? "1px solid #e2e8f0" : "1.5px solid #d1d5db",
                    borderRadius: "4px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: (!revealed && !gameState.match(/won|lost/)) ? "pointer" : "default",
                    fontSize: typeof content === "number" ? fontSize : `${cellSize * 0.45}px`,
                    fontWeight: 900,
                    color: textColor,
                    transition: "background 0.1s",
                    boxShadow: !revealed ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  }}
                  onMouseEnter={e => {
                    if (!revealed && !flagged && !gameState.match(/won|lost/))
                      e.currentTarget.style.background = "#eff6ff";
                  }}
                  onMouseLeave={e => {
                    if (!revealed && !flagged)
                      e.currentTarget.style.background = "#ffffff";
                  }}
                >
                  {content}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Game over buttons */}
      {(gameState === "won" || gameState === "lost") && (
        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <div style={{
            fontSize: "0.9rem", fontWeight: 800, marginBottom: "10px",
            color: gameState === "won" ? "#15803d" : "#dc2626",
          }}>
            {gameState === "won" ? `🎉 クリア！ ${formatTime(time)}` : "💥 ゲームオーバー"}
          </div>
          <button onClick={() => resetGame()} style={{
            padding: "10px 32px",
            background: "#1e293b", color: "#ffffff",
            border: "none", borderRadius: "10px",
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 800, fontSize: "0.9rem", cursor: "pointer",
            boxShadow: "0 4px 12px rgba(30,41,59,0.15)",
          }}>もう一局</button>
        </div>
      )}

      {/* Help */}
      <div style={{
        marginTop: "16px", fontSize: "0.7rem", color: "#94a3b8",
        textAlign: "center", lineHeight: 1.8, fontWeight: 600,
      }}>
        左クリック: 開く　／　右クリック: 旗を立てる　／　数字クリック: 周囲一括オープン
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
}
