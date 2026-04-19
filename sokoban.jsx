import { useEffect, useMemo, useState } from "react";

const LEVELS = [
  [
    "########",
    "#  .   #",
    "#  $   #",
    "#  @   #",
    "#      #",
    "########",
  ],
  [
    "##########",
    "#        #",
    "#  $$ .  #",
    "#  #  .  #",
    "#  @     #",
    "##########",
  ],
  [
    "###########",
    "#    #    #",
    "# $  # .  #",
    "# $$   .. #",
    "#  @ #    #",
    "###########",
  ],
  [
    "############",
    "#   .  .   #",
    "# $$ ## $$ #",
    "#     @    #",
    "#   .  .   #",
    "############",
  ],
];

const DIRS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

function keyOf(x, y) {
  return `${x},${y}`;
}

function parseLevel(index) {
  const rows = LEVELS[index];
  const walls = new Set();
  const goals = new Set();
  const boxes = new Set();
  let player = { x: 1, y: 1 };

  rows.forEach((row, y) => {
    row.split("").forEach((ch, x) => {
      if (ch === "#") walls.add(keyOf(x, y));
      if (ch === "." || ch === "*" || ch === "+") goals.add(keyOf(x, y));
      if (ch === "$" || ch === "*") boxes.add(keyOf(x, y));
      if (ch === "@" || ch === "+") player = { x, y };
    });
  });

  return {
    level: index,
    width: Math.max(...rows.map(r => r.length)),
    height: rows.length,
    walls,
    goals,
    boxes,
    player,
    moves: 0,
    pushes: 0,
    status: "playing",
    message: "箱を全て光る床へ押し込め。",
  };
}

function isSolved(state) {
  return [...state.boxes].every(box => state.goals.has(box));
}

function move(state, dir) {
  if (state.status !== "playing") return state;
  const [dx, dy] = dir;
  const px = state.player.x + dx;
  const py = state.player.y + dy;
  const pk = keyOf(px, py);
  if (state.walls.has(pk)) return { ...state, message: "壁だ。" };

  const boxes = new Set(state.boxes);
  let pushes = state.pushes;
  if (boxes.has(pk)) {
    const bx = px + dx;
    const by = py + dy;
    const bk = keyOf(bx, by);
    if (state.walls.has(bk) || boxes.has(bk)) return { ...state, message: "箱が動かない。" };
    boxes.delete(pk);
    boxes.add(bk);
    pushes += 1;
  }

  const next = {
    ...state,
    player: { x: px, y: py },
    boxes,
    moves: state.moves + 1,
    pushes,
    message: boxes.has(pk) ? "箱を押した。" : "移動した。",
  };
  return isSolved(next) ? { ...next, status: "cleared", message: "クリア。倉庫が整った。" } : next;
}

function Tile({ type, children }) {
  return <div style={{ ...styles.tile, ...styles[type] }}>{children}</div>;
}

function Board({ state }) {
  const cells = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const k = keyOf(x, y);
      const wall = state.walls.has(k);
      const goal = state.goals.has(k);
      const box = state.boxes.has(k);
      const player = state.player.x === x && state.player.y === y;
      cells.push(
        <Tile key={k} type={wall ? "wall" : goal ? "goal" : "floor"}>
          {goal && <span style={styles.goalDot} />}
          {box && <span style={goal ? styles.boxDone : styles.box} />}
          {player && (
            <span style={styles.worker}>
              <span style={styles.workerHead} />
              <span style={styles.workerBody} />
            </span>
          )}
        </Tile>,
      );
    }
  }

  return (
    <div style={{ ...styles.board, gridTemplateColumns: `repeat(${state.width}, minmax(28px, 52px))` }}>
      {cells}
    </div>
  );
}

export default function Sokoban() {
  const [state, setState] = useState(() => parseLevel(0));

  useEffect(() => {
    const onKeyDown = (e) => {
      if (DIRS[e.key]) {
        e.preventDefault();
        setState(current => move(current, DIRS[e.key]));
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        setState(current => parseLevel(current.level));
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setState(current => parseLevel((current.level + 1) % LEVELS.length));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const solvedBoxes = useMemo(() => [...state.boxes].filter(box => state.goals.has(box)).length, [state.boxes, state.goals]);

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Sokoban</h1>
            <p style={styles.sub}>pixel warehouse puzzle</p>
          </div>
          <div style={styles.actions}>
            <a style={styles.link} href="./index.html">一覧へ</a>
            <button type="button" style={styles.button} onClick={() => setState(parseLevel(state.level))}>RESET</button>
            <button type="button" style={styles.button} onClick={() => setState(parseLevel((state.level + 1) % LEVELS.length))}>NEXT</button>
          </div>
        </header>

        <section style={styles.hud}>
          <span>LEVEL {state.level + 1}/{LEVELS.length}</span>
          <span>MOVES {state.moves}</span>
          <span>PUSHES {state.pushes}</span>
          <span>BOXES {solvedBoxes}/{state.goals.size}</span>
        </section>

        <section style={styles.stage}>
          <Board state={state} />
        </section>

        <section style={styles.message}>{state.message}</section>

        <section style={styles.guide}>
          <span><kbd style={styles.kbd}>↑↓←→</kbd><kbd style={styles.kbd}>WASD</kbd> 移動</span>
          <span><kbd style={styles.kbd}>R</kbd> リセット</span>
          <span><kbd style={styles.kbd}>N</kbd> 次の面</span>
        </section>

        {state.status === "cleared" && (
          <div style={styles.result}>
            <div style={styles.resultTitle}>STAGE CLEAR</div>
            <div>Moves {state.moves} / Pushes {state.pushes}</div>
            <button type="button" style={styles.resultButton} onClick={() => setState(parseLevel((state.level + 1) % LEVELS.length))}>次の面へ</button>
          </div>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#111827",
    color: "#f9fafb",
    fontFamily: '"Nunito", "Hiragino Sans", system-ui, sans-serif',
    padding: "22px 12px",
  },
  shell: {
    width: "min(980px, 100%)",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  title: {
    margin: 0,
    fontSize: "1.7rem",
    letterSpacing: 0,
  },
  sub: {
    margin: "3px 0 0",
    color: "#9ca3af",
    fontSize: "0.84rem",
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  link: {
    color: "#f9fafb",
    textDecoration: "none",
    border: "1px solid #374151",
    background: "#1f2937",
    borderRadius: "6px",
    padding: "8px 10px",
    fontWeight: 800,
  },
  button: {
    color: "#f9fafb",
    border: "1px solid #374151",
    background: "#1f2937",
    borderRadius: "6px",
    padding: "8px 10px",
    fontWeight: 900,
    cursor: "pointer",
  },
  hud: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    border: "1px solid #374151",
    background: "#172033",
    padding: "10px",
    borderRadius: "8px",
    marginBottom: "12px",
    fontWeight: 900,
    color: "#dbeafe",
  },
  stage: {
    display: "flex",
    justifyContent: "center",
    overflow: "auto",
    border: "1px solid #374151",
    background: "#263244",
    borderRadius: "8px",
    padding: "18px",
    boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
  },
  board: {
    display: "grid",
    gap: "2px",
    imageRendering: "pixelated",
  },
  tile: {
    position: "relative",
    aspectRatio: "1",
    minWidth: "28px",
    overflow: "hidden",
  },
  floor: {
    background: "linear-gradient(135deg, #4b5563 0 25%, #566274 25% 50%, #4b5563 50% 75%, #414b5c 75%)",
    backgroundSize: "18px 18px",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.04)",
  },
  wall: {
    background: "linear-gradient(135deg, #7c3f25 0 24%, #9a5a34 24% 50%, #6b341f 50% 76%, #b26a40 76%)",
    backgroundSize: "20px 20px",
    boxShadow: "inset 0 -5px #4a2518, inset 0 3px rgba(255,255,255,0.14)",
  },
  goal: {
    background: "linear-gradient(135deg, #374151 0 25%, #455164 25% 50%, #374151 50% 75%, #2f3848 75%)",
    backgroundSize: "18px 18px",
  },
  goalDot: {
    position: "absolute",
    left: "33%",
    top: "33%",
    width: "34%",
    height: "34%",
    background: "#fde68a",
    borderRadius: "4px",
    boxShadow: "0 0 12px rgba(253,230,138,0.75)",
  },
  box: {
    position: "absolute",
    inset: "12%",
    background: "linear-gradient(135deg, #d97706 0 28%, #f59e0b 28% 58%, #b45309 58%)",
    border: "3px solid #78350f",
    boxShadow: "inset 0 4px rgba(255,255,255,0.28), 0 5px rgba(0,0,0,0.22)",
  },
  boxDone: {
    position: "absolute",
    inset: "12%",
    background: "linear-gradient(135deg, #16a34a 0 28%, #22c55e 28% 58%, #15803d 58%)",
    border: "3px solid #14532d",
    boxShadow: "0 0 12px rgba(34,197,94,0.55), inset 0 4px rgba(255,255,255,0.25)",
  },
  worker: {
    position: "absolute",
    left: "18%",
    right: "18%",
    top: "9%",
    bottom: "12%",
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: "2px",
    zIndex: 3,
  },
  workerHead: {
    width: "42%",
    aspectRatio: "1",
    background: "#fde68a",
    border: "2px solid #92400e",
    borderRadius: "4px",
  },
  workerBody: {
    width: "58%",
    height: "42%",
    background: "#38bdf8",
    border: "2px solid #075985",
    borderRadius: "3px",
    boxShadow: "inset 0 4px rgba(255,255,255,0.28)",
  },
  message: {
    marginTop: "12px",
    border: "1px solid #374151",
    background: "#172033",
    padding: "10px",
    borderRadius: "8px",
    color: "#dbeafe",
    fontWeight: 800,
  },
  guide: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "12px",
    color: "#d1d5db",
    fontWeight: 800,
  },
  kbd: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "26px",
    marginRight: "4px",
    padding: "0 7px",
    border: "1px solid #4b5563",
    borderRadius: "5px",
    background: "#111827",
    color: "#f9fafb",
    fontFamily: "monospace",
    fontWeight: 900,
  },
  result: {
    position: "fixed",
    inset: 0,
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    background: "rgba(17,24,39,0.78)",
  },
  resultTitle: {
    fontSize: "1.8rem",
    fontWeight: 1000,
  },
  resultButton: {
    border: "1px solid #f9fafb",
    background: "#f9fafb",
    color: "#111827",
    borderRadius: "6px",
    padding: "10px 16px",
    fontWeight: 900,
    cursor: "pointer",
  },
};
