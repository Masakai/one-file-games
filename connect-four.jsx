import { useState, useCallback, useEffect, useRef } from "react";

const ROWS = 6, COLS = 7;
const EMPTY = 0, PLAYER = 1, AI = 2;

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function cloneBoard(b) { return b.map(r => [...r]); }

function dropPiece(board, col, piece) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === EMPTY) {
      const b = cloneBoard(board);
      b[r][col] = piece;
      return { board: b, row: r };
    }
  }
  return null;
}

function checkWin(board, piece) {
  // Horizontal, vertical, diagonal
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      // Right
      if (c + 3 < COLS && board[r][c] === piece && board[r][c+1] === piece && board[r][c+2] === piece && board[r][c+3] === piece)
        return [[r,c],[r,c+1],[r,c+2],[r,c+3]];
      // Down
      if (r + 3 < ROWS && board[r][c] === piece && board[r+1][c] === piece && board[r+2][c] === piece && board[r+3][c] === piece)
        return [[r,c],[r+1,c],[r+2,c],[r+3,c]];
      // Diag right-down
      if (r + 3 < ROWS && c + 3 < COLS && board[r][c] === piece && board[r+1][c+1] === piece && board[r+2][c+2] === piece && board[r+3][c+3] === piece)
        return [[r,c],[r+1,c+1],[r+2,c+2],[r+3,c+3]];
      // Diag left-down
      if (r + 3 < ROWS && c - 3 >= 0 && board[r][c] === piece && board[r+1][c-1] === piece && board[r+2][c-2] === piece && board[r+3][c-3] === piece)
        return [[r,c],[r+1,c-1],[r+2,c-2],[r+3,c-3]];
    }
  return null;
}

function isFull(board) { return board[0].every(c => c !== EMPTY); }

function getValidCols(board) {
  return Array.from({ length: COLS }).map((_, c) => c).filter(c => board[0][c] === EMPTY);
}

// AI evaluation
function scoreWindow(window, piece) {
  const opp = piece === PLAYER ? AI : PLAYER;
  const pCount = window.filter(w => w === piece).length;
  const oCount = window.filter(w => w === opp).length;
  const eCount = window.filter(w => w === EMPTY).length;
  if (pCount === 4) return 100;
  if (pCount === 3 && eCount === 1) return 5;
  if (pCount === 2 && eCount === 2) return 2;
  if (oCount === 3 && eCount === 1) return -4;
  return 0;
}

function evaluate(board, piece) {
  let score = 0;
  // Center preference
  const centerCol = Math.floor(COLS / 2);
  const centerCount = board.reduce((s, row) => s + (row[centerCol] === piece ? 1 : 0), 0);
  score += centerCount * 3;

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++) {
      const w = [board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]];
      score += scoreWindow(w, piece);
    }
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++) {
      const w = [board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]];
      score += scoreWindow(w, piece);
    }
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++) {
      const w = [board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]];
      score += scoreWindow(w, piece);
    }
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 3; c < COLS; c++) {
      const w = [board[r][c], board[r+1][c-1], board[r+2][c-2], board[r+3][c-3]];
      score += scoreWindow(w, piece);
    }
  return score;
}

function minimax(board, depth, alpha, beta, maximizing) {
  const pWin = checkWin(board, PLAYER);
  const aWin = checkWin(board, AI);
  if (aWin) return { score: 100000 + depth };
  if (pWin) return { score: -100000 - depth };
  const valid = getValidCols(board);
  if (valid.length === 0 || depth === 0) return { score: evaluate(board, AI) };

  if (maximizing) {
    let best = { score: -Infinity, col: valid[0] };
    for (const col of valid) {
      const res = dropPiece(board, col, AI);
      if (!res) continue;
      const { score } = minimax(res.board, depth - 1, alpha, beta, false);
      if (score > best.score) best = { score, col };
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = { score: Infinity, col: valid[0] };
    for (const col of valid) {
      const res = dropPiece(board, col, PLAYER);
      if (!res) continue;
      const { score } = minimax(res.board, depth - 1, alpha, beta, true);
      if (score < best.score) best = { score, col };
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function aiChoose(board, difficulty) {
  const valid = getValidCols(board);
  if (valid.length === 0) return -1;
  if (difficulty === "easy") return valid[Math.floor(Math.random() * valid.length)];
  const depth = difficulty === "normal" ? 4 : 7;
  const { col } = minimax(board, depth, -Infinity, Infinity, true);
  return col;
}

const DIFF_OPTIONS = [
  { key: "easy", label: "よわい" },
  { key: "normal", label: "ふつう" },
  { key: "hard", label: "最強" },
];

const CELL_SIZE = 54;

export default function ConnectFour() {
  const [board, setBoard] = useState(emptyBoard);
  const [turn, setTurn] = useState(PLAYER);
  const [winLine, setWinLine] = useState(null);
  const [gameState, setGameState] = useState("playing"); // playing | won | lost | draw
  const [difficulty, setDifficulty] = useState("normal");
  const [thinking, setThinking] = useState(false);
  const [hoverCol, setHoverCol] = useState(-1);
  const [lastDrop, setLastDrop] = useState(null);
  const [score, setScore] = useState({ player: 0, ai: 0, draw: 0 });

  const [showHelp, setShowHelp] = useState(false);

  // AI turn
  useEffect(() => {
    if (turn !== AI || gameState !== "playing") return;
    setThinking(true);
    const timer = setTimeout(() => {
      const col = aiChoose(board, difficulty);
      const res = dropPiece(board, col, AI);
      if (!res) { setThinking(false); return; }
      setBoard(res.board);
      setLastDrop([res.row, col]);
      const win = checkWin(res.board, AI);
      if (win) {
        setWinLine(win);
        setGameState("lost");
        setScore(s => ({ ...s, ai: s.ai + 1 }));
      } else if (isFull(res.board)) {
        setGameState("draw");
        setScore(s => ({ ...s, draw: s.draw + 1 }));
      } else {
        setTurn(PLAYER);
      }
      setThinking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [turn, board, gameState, difficulty]);

  const handleClick = useCallback((col) => {
    if (turn !== PLAYER || gameState !== "playing" || thinking) return;
    const res = dropPiece(board, col, PLAYER);
    if (!res) return;
    setBoard(res.board);
    setLastDrop([res.row, col]);
    const win = checkWin(res.board, PLAYER);
    if (win) {
      setWinLine(win);
      setGameState("won");
      setScore(s => ({ ...s, player: s.player + 1 }));
    } else if (isFull(res.board)) {
      setGameState("draw");
      setScore(s => ({ ...s, draw: s.draw + 1 }));
    } else {
      setTurn(AI);
    }
  }, [board, turn, gameState, thinking]);

  const resetGame = (d) => {
    setBoard(emptyBoard());
    setTurn(PLAYER);
    setWinLine(null);
    setGameState("playing");
    setThinking(false);
    setHoverCol(-1);
    setLastDrop(null);
    if (d) setDifficulty(d);
  };

  const isWinCell = (r, c) => winLine && winLine.some(([wr, wc]) => wr === r && wc === c);

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
            四目並べのルール
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>1.</span>
            <span>7列の盤面に、あなた（🔴）とAI（🟡）が交互に駒を落とします。</span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>2.</span>
            <span>駒は選んだ列の一番下の空きマスに落ちます。</span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>3.</span>
            <span>縦・横・斜めのいずれかに先に4つ連続で揃えた方が勝ちです。</span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>4.</span>
            <span>全マス埋まっても揃わなければ引き分けです。</span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
            <span style={{ color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>5.</span>
            <span>難易度「最強」のAIはかなり手強いです！</span>
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
          fontSize: "1.7rem", letterSpacing: "0.06em", margin: 0, color: "#1e293b",
        }}>四目並べ</h1>
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
        Connect Four
      </div>

      {/* Difficulty */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
        {DIFF_OPTIONS.map(d => (
          <button key={d.key} onClick={() => resetGame(d.key)} style={{
            padding: "5px 14px", borderRadius: "8px",
            border: difficulty === d.key ? "1.5px solid #1e293b" : "1.5px solid #e2e8f0",
            background: difficulty === d.key ? "#1e293b" : "#ffffff",
            color: difficulty === d.key ? "#ffffff" : "#64748b",
            fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
          }}>{d.label}</button>
        ))}
      </div>

      {/* Score */}
      <div style={{
        display: "flex", gap: "6px", alignItems: "stretch",
        marginBottom: "12px", background: "#f8fafc", borderRadius: "12px",
        border: "1px solid #e2e8f0", padding: "4px",
      }}>
        <div style={{
          padding: "6px 16px", borderRadius: "8px", textAlign: "center",
          background: turn === PLAYER && gameState === "playing" ? "#fef2f2" : "transparent",
          border: turn === PLAYER && gameState === "playing" ? "1.5px solid #fecaca" : "1.5px solid transparent",
          transition: "all 0.3s",
        }}>
          <div style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 600 }}>🔴 あなた</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#dc2626" }}>{score.player}</div>
        </div>
        <div style={{ padding: "6px 12px", textAlign: "center" }}>
          <div style={{ fontSize: "0.6rem", color: "#cbd5e1", fontWeight: 600 }}>引分</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#94a3b8" }}>{score.draw}</div>
        </div>
        <div style={{
          padding: "6px 16px", borderRadius: "8px", textAlign: "center",
          background: turn === AI && gameState === "playing" ? "#fefce8" : "transparent",
          border: turn === AI && gameState === "playing" ? "1.5px solid #fde68a" : "1.5px solid transparent",
          transition: "all 0.3s",
        }}>
          <div style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 600 }}>🟡 AI</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#ca8a04" }}>{score.ai}</div>
        </div>
      </div>

      {/* Status */}
      <div style={{
        marginBottom: "10px", fontSize: "0.85rem", fontWeight: 700, minHeight: "1.4em",
        color: gameState === "won" ? "#15803d" : gameState === "lost" ? "#dc2626" : gameState === "draw" ? "#a16207"
          : thinking ? "#2563eb" : "#64748b",
      }}>
        {thinking && <span style={{ display: "inline-block", animation: "pulse 1.2s ease-in-out infinite", marginRight: 4 }}>●</span>}
        {gameState === "won" ? "あなたの勝ち！" : gameState === "lost" ? "AIの勝ち！" : gameState === "draw" ? "引き分け！"
          : thinking ? "AI思考中..." : "あなたの番です（🔴）"}
      </div>

      {/* Board */}
      <div style={{
        background: "#2563eb", borderRadius: "14px", padding: "8px",
        boxShadow: "0 4px 20px rgba(37,99,235,0.15)",
        border: "3px solid #1d4ed8",
      }}>
        {/* Column hover indicators */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "4px", paddingLeft: "0" }}>
          {Array.from({ length: COLS }).map((_, c) => (
            <div key={c} style={{
              width: CELL_SIZE, height: "20px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {hoverCol === c && turn === PLAYER && gameState === "playing" && !thinking && (
                <div style={{
                  width: CELL_SIZE - 16, height: CELL_SIZE - 16, borderRadius: "50%",
                  background: "#dc2626", opacity: 0.4,
                  animation: "fadeIn 0.15s ease",
                }} />
              )}
            </div>
          ))}
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${CELL_SIZE}px)`,
          gap: "4px",
        }}>
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isWin = isWinCell(r, c);
              const isLast = lastDrop && lastDrop[0] === r && lastDrop[1] === c;
              return (
                <div key={`${r}-${c}`}
                  onClick={() => handleClick(c)}
                  onMouseEnter={() => setHoverCol(c)}
                  onMouseLeave={() => setHoverCol(-1)}
                  style={{
                    width: CELL_SIZE, height: CELL_SIZE,
                    borderRadius: "50%",
                    background: cell === PLAYER ? "#dc2626"
                      : cell === AI ? "#eab308"
                      : "#e8edf3",
                    border: isWin ? "3px solid #ffffff"
                      : cell === PLAYER ? "2px solid #b91c1c"
                      : cell === AI ? "2px solid #ca8a04"
                      : "2px solid #d1d8e3",
                    boxShadow: isWin ? "0 0 12px rgba(255,255,255,0.6)"
                      : cell !== EMPTY ? "inset 0 -3px 6px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)"
                      : "inset 0 2px 4px rgba(0,0,0,0.1)",
                    cursor: (turn === PLAYER && gameState === "playing" && board[0][c] === EMPTY && !thinking) ? "pointer" : "default",
                    transition: "all 0.15s",
                    animation: isLast ? "dropIn 0.3s ease" : "none",
                  }}
                />
              );
            })
          )}
        </div>
      </div>

      {gameState !== "playing" && (
        <button onClick={() => resetGame()} style={{
          marginTop: "16px", padding: "10px 32px",
          background: "#1e293b", color: "#ffffff",
          border: "none", borderRadius: "10px",
          fontWeight: 800, fontSize: "0.9rem", cursor: "pointer",
          boxShadow: "0 4px 12px rgba(30,41,59,0.15)",
          animation: "fadeInUp 0.4s ease",
        }}>もう一局</button>
      )}

      <div style={{
        marginTop: "14px", fontSize: "0.7rem", color: "#94a3b8",
        textAlign: "center", fontWeight: 600,
      }}>
        列をクリックして駒を落とそう ／ 縦・横・斜めに4つ揃えたら勝ち
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dropIn { from { transform: translateY(-40px); opacity: 0.5; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
}
