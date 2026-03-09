import { useMemo, useRef, useState, useEffect } from "react";

const GALAXY_SIZE = 8;
const SECTOR_SIZE = 8;
const INITIAL_ENERGY = 3000;
const INITIAL_TORPEDOES = 10;
const KLINGON_BASE_HP = 200;

const DIR = {
  1: { x: 1, y: 0 },
  2: { x: 1, y: -1 },
  3: { x: 0, y: -1 },
  4: { x: -1, y: -1 },
  5: { x: -1, y: 0 },
  6: { x: -1, y: 1 },
  7: { x: 0, y: 1 },
  8: { x: 1, y: 1 },
};

const pad3 = (n) => String(n).padStart(3, "0");
const inRange = (v, min, max) => v >= min && v <= max;
const randInt = (max) => Math.floor(Math.random() * max);

function makeGalaxy() {
  const galaxy = Array.from({ length: GALAXY_SIZE }, () =>
    Array.from({ length: GALAXY_SIZE }, () => ({ klingons: 0, base: 0, stars: 0, known: false })),
  );

  let totalK = 0;
  let totalB = 0;

  for (let qy = 0; qy < GALAXY_SIZE; qy++) {
    for (let qx = 0; qx < GALAXY_SIZE; qx++) {
      const r = Math.random();
      let k = 0;
      if (r > 0.98) k = 3;
      else if (r > 0.95) k = 2;
      else if (r > 0.8) k = 1;
      const b = Math.random() > 0.96 ? 1 : 0;
      const s = randInt(8) + 1;
      galaxy[qy][qx] = { klingons: k, base: b, stars: s, known: false };
      totalK += k;
      totalB += b;
    }
  }

  return { galaxy, totalK, totalB };
}

function placeObjects(quadrant, enterprise) {
  const board = Array.from({ length: SECTOR_SIZE }, () => Array.from({ length: SECTOR_SIZE }, () => "   "));
  const klingons = [];
  let base = null;

  const occupy = (x, y, token) => {
    board[y][x] = token;
  };

  occupy(enterprise.sx, enterprise.sy, "<*>");

  const randomEmpty = () => {
    while (true) {
      const x = randInt(SECTOR_SIZE);
      const y = randInt(SECTOR_SIZE);
      if (board[y][x] === "   ") return { x, y };
    }
  };

  for (let i = 0; i < quadrant.klingons; i++) {
    const p = randomEmpty();
    occupy(p.x, p.y, "+K+");
    klingons.push({ x: p.x, y: p.y, hp: KLINGON_BASE_HP * (0.5 + Math.random()) });
  }

  if (quadrant.base > 0) {
    const p = randomEmpty();
    occupy(p.x, p.y, ">!<");
    base = p;
  }

  for (let i = 0; i < quadrant.stars; i++) {
    const p = randomEmpty();
    occupy(p.x, p.y, " * ");
  }

  return { board, klingons, base };
}

function boardTokenColor(token) {
  if (token === "<*>") return "#38bdf8";
  if (token === "+K+") return "#ef4444";
  if (token === ">!<") return "#22c55e";
  if (token === " * ") return "#f59e0b";
  return "#334155";
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function gameInit() {
  const { galaxy, totalK: initialK, totalB: initialB } = makeGalaxy();
  let totalK = initialK;
  let totalB = initialB;

  const qx = randInt(GALAXY_SIZE);
  const qy = randInt(GALAXY_SIZE);
  const sx = randInt(SECTOR_SIZE);
  const sy = randInt(SECTOR_SIZE);

  if (totalB === 0) {
    galaxy[qy][qx].base = 1;
    totalB = 1;
  }
  if (totalK === 0) {
    const kx = randInt(GALAXY_SIZE);
    const ky = randInt(GALAXY_SIZE);
    galaxy[ky][kx].klingons += 1;
    totalK = 1;
  }

  galaxy[qy][qx].known = true;

  const placement = placeObjects(galaxy[qy][qx], { sx, sy });

  const startDate = (20 + randInt(20)) * 100;
  const missionDays = 25 + randInt(10);

  return {
    galaxy,
    enterprise: { qx, qy, sx, sy },
    board: placement.board,
    klingons: placement.klingons,
    base: placement.base,
    totalK,
    totalB,
    stardate: startDate,
    startDate,
    missionDays,
    energy: INITIAL_ENERGY,
    shields: 0,
    torpedoes: INITIAL_TORPEDOES,
    gameOver: false,
    won: false,
    logs: [
      "STARFLEET 指令: SUPER STAR TREK 任務を開始せよ。",
      `敵クリンゴン艦 ${totalK} 隻を、宇宙日付 ${startDate + missionDays} までに撃滅せよ。`,
      `銀河内の補給基地は ${totalB} 基地。`,
      `現在位置: QUADRANT ${qx + 1},${qy + 1} / SECTOR ${sx + 1},${sy + 1}`,
    ],
  };
}

function quadrantCode(q) {
  return q.klingons * 100 + q.base * 10 + q.stars;
}

function lrsRows(state) {
  const rows = [];
  for (let y = state.enterprise.qy - 1; y <= state.enterprise.qy + 1; y++) {
    const cols = [];
    for (let x = state.enterprise.qx - 1; x <= state.enterprise.qx + 1; x++) {
      if (!inRange(x, 0, GALAXY_SIZE - 1) || !inRange(y, 0, GALAXY_SIZE - 1)) {
        cols.push("***");
      } else {
        const q = state.galaxy[y][x];
        q.known = true;
        cols.push(pad3(quadrantCode(q)));
      }
    }
    rows.push(cols);
  }
  return rows;
}

function resolveDocking(state) {
  const { enterprise, base } = state;
  if (!base) return { docked: false, logs: [] };
  const docked = Math.abs(enterprise.sx - base.x) <= 1 && Math.abs(enterprise.sy - base.y) <= 1;
  if (!docked) return { docked: false, logs: [] };
  return {
    docked: true,
    logs: ["STARBASE とドッキング。補給完了。シールドを解除。"],
  };
}

function enterQuadrant(state, qx, qy, sx, sy) {
  const next = { ...state, enterprise: { qx, qy, sx, sy } };
  const q = next.galaxy[qy][qx];
  q.known = true;
  const placement = placeObjects(q, { sx, sy });
  next.board = placement.board;
  next.klingons = placement.klingons;
  next.base = placement.base;

  const logs = [`QUADRANT ${qx + 1},${qy + 1} に進入。`];
  if (placement.klingons.length > 0) logs.push("COMBAT AREA: CONDITION RED");
  const dockInfo = resolveDocking(next);
  if (dockInfo.docked) {
    next.energy = INITIAL_ENERGY;
    next.torpedoes = INITIAL_TORPEDOES;
    next.shields = 0;
  }
  return { next, logs: [...logs, ...dockInfo.logs] };
}

function fireBack(state, logs) {
  if (state.klingons.length === 0) return;
  const dockInfo = resolveDocking(state);
  if (dockInfo.docked) {
    logs.push("STARBASE シールドにより攻撃を無効化。");
    return;
  }

  for (const k of state.klingons) {
    const d = Math.max(0.5, distance({ x: state.enterprise.sx, y: state.enterprise.sy }, k));
    const hit = Math.floor((k.hp / d) * (2 + Math.random()));
    if (hit <= 0) continue;
    state.shields -= hit;
    logs.push(`敵攻撃: ${k.x + 1},${k.y + 1} から ${hit} ダメージ。`);
    k.hp = Math.max(0, k.hp / (3 + Math.random()));
    if (state.shields <= 0) {
      state.shields = 0;
      state.gameOver = true;
      state.won = false;
      logs.push("エンタープライズは撃沈された。ミッション失敗。");
      return;
    }
  }
}

function conditionLabel(state) {
  const dockInfo = resolveDocking(state);
  if (dockInfo.docked) return "DOCKED";
  if (state.klingons.length > 0) return "RED";
  if (state.energy < INITIAL_ENERGY * 0.1) return "YELLOW";
  return "GREEN";
}

export default function SuperStarTrek() {
  const [state, setState] = useState(() => gameInit());
  const [navCourse, setNavCourse] = useState("1");
  const [navWarp, setNavWarp] = useState("1");
  const [phaserEnergy, setPhaserEnergy] = useState("500");
  const [torCourse, setTorCourse] = useState("1");
  const [shieldTarget, setShieldTarget] = useState("0");
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state.logs.length]);

  const status = useMemo(
    () => ({
      condition: conditionLabel(state),
      deadline: state.startDate + state.missionDays,
      remainingDays: Math.max(0, (state.startDate + state.missionDays - state.stardate).toFixed(1)),
      totalEnergy: Math.floor(state.energy + state.shields),
    }),
    [state],
  );

  const append = (prev, lines) => ({ ...prev, logs: [...prev.logs, ...lines] });

  const runCommand = (runner) => {
    setState((prev) => {
      if (prev.gameOver) return prev;
      const next = {
        ...prev,
        galaxy: prev.galaxy.map((r) => r.map((q) => ({ ...q }))),
        board: prev.board.map((r) => [...r]),
        klingons: prev.klingons.map((k) => ({ ...k })),
        logs: [...prev.logs],
      };
      runner(next);
      if (!next.gameOver && next.stardate > next.startDate + next.missionDays) {
        next.gameOver = true;
        next.won = false;
        next.logs.push(`宇宙日付 ${next.stardate.toFixed(1)}。期限超過でミッション失敗。`);
      }
      return next;
    });
  };

  const cmdSrs = () => {
    runCommand((next) => {
      next.logs.push("SRS: 短距離センサー表示を更新。下のセクタグリッドを参照。", `CONDITION ${conditionLabel(next)}`);
    });
  };

  const cmdLrs = () => {
    runCommand((next) => {
      const rows = lrsRows(next);
      next.logs.push(`LRS: QUADRANT ${next.enterprise.qx + 1},${next.enterprise.qy + 1}`);
      for (const row of rows) next.logs.push(`  ${row.join(" ")}`);
    });
  };

  const cmdDam = () => {
    runCommand((next) => {
      next.logs.push("DAM: 主要デバイスは稼働中（本移植版では詳細破損モデルを簡略化）。");
    });
  };

  const cmdCom = () => {
    runCommand((next) => {
      next.logs.push(
        "COM STATUS REPORT",
        `  KLINGON LEFT: ${next.totalK}`,
        `  STARBASE: ${next.totalB}`,
        `  MISSION DEADLINE: ${next.startDate + next.missionDays}`,
      );
      next.logs.push("  CUMULATIVE RECORD (known only):");
      for (let y = 0; y < GALAXY_SIZE; y++) {
        const row = [];
        for (let x = 0; x < GALAXY_SIZE; x++) {
          row.push(next.galaxy[y][x].known ? pad3(quadrantCode(next.galaxy[y][x])) : "***");
        }
        next.logs.push(`  ${row.join(" ")}`);
      }
    });
  };

  const cmdResign = () => {
    runCommand((next) => {
      next.gameOver = true;
      next.won = false;
      next.logs.push("XXX: 艦長は指揮を辞任した。ミッション終了。");
    });
  };

  const cmdShield = () => {
    runCommand((next) => {
      const x = Number(shieldTarget);
      if (!Number.isFinite(x) || x < 0) {
        next.logs.push("SHE: 無効なシールド値。");
        return;
      }
      if (x > next.energy + next.shields) {
        next.logs.push("SHE: エネルギー不足。シールド変更なし。");
        return;
      }
      next.energy = next.energy + next.shields - x;
      next.shields = x;
      next.logs.push(`SHE: シールドを ${Math.floor(x)} に設定。`);
      fireBack(next, next.logs);
    });
  };

  const cmdPhaser = () => {
    runCommand((next) => {
      if (next.klingons.length === 0) {
        next.logs.push("PHA: このクォドラントに敵艦なし。");
        return;
      }
      const x = Number(phaserEnergy);
      if (!Number.isFinite(x) || x <= 0) {
        next.logs.push("PHA: 発射エネルギーが不正。");
        return;
      }
      if (x > next.energy) {
        next.logs.push("PHA: エネルギー不足。");
        return;
      }
      next.energy -= x;
      const per = Math.floor(x / next.klingons.length);
      const survivors = [];

      for (const k of next.klingons) {
        const d = Math.max(0.5, distance({ x: next.enterprise.sx, y: next.enterprise.sy }, k));
        const hit = Math.floor((per / d) * (2 + Math.random()));
        if (hit > 0.15 * k.hp) {
          k.hp -= hit;
          next.logs.push(`PHA: 敵艦 ${k.x + 1},${k.y + 1} へ ${hit} ヒット。`);
        } else {
          next.logs.push(`PHA: ${k.x + 1},${k.y + 1} に有効打なし。`);
        }

        if (k.hp <= 0) {
          next.logs.push("*** KLINGON DESTROYED ***");
          next.board[k.y][k.x] = "   ";
          next.totalK -= 1;
          next.galaxy[next.enterprise.qy][next.enterprise.qx].klingons -= 1;
        } else {
          survivors.push(k);
        }
      }

      next.klingons = survivors;
      if (next.totalK <= 0) {
        next.gameOver = true;
        next.won = true;
        next.logs.push("全クリンゴン艦を撃破。ミッション成功。");
        return;
      }
      fireBack(next, next.logs);
    });
  };

  const cmdTorpedo = () => {
    runCommand((next) => {
      if (next.torpedoes <= 0) {
        next.logs.push("TOR: 光子魚雷は尽きた。");
        return;
      }
      const c = Number(torCourse);
      if (!Number.isFinite(c) || c < 1 || c > 8) {
        next.logs.push("TOR: コースは 1-8 を指定。");
        return;
      }
      next.torpedoes -= 1;
      next.energy -= 2;
      const dir = DIR[Math.round(c)];
      let x = next.enterprise.sx;
      let y = next.enterprise.sy;
      next.logs.push("TORPEDO TRACK:");

      while (true) {
        x += dir.x;
        y += dir.y;
        if (!inRange(x, 0, SECTOR_SIZE - 1) || !inRange(y, 0, SECTOR_SIZE - 1)) {
          next.logs.push("TOR: MISSED");
          break;
        }
        next.logs.push(`  ${x + 1},${y + 1}`);
        const token = next.board[y][x];
        if (token === "   ") continue;

        if (token === "+K+") {
          next.logs.push("*** KLINGON DESTROYED ***");
          next.board[y][x] = "   ";
          next.klingons = next.klingons.filter((k) => !(k.x === x && k.y === y));
          next.totalK -= 1;
          next.galaxy[next.enterprise.qy][next.enterprise.qx].klingons -= 1;
          if (next.totalK <= 0) {
            next.gameOver = true;
            next.won = true;
            next.logs.push("全クリンゴン艦を撃破。ミッション成功。");
          }
          break;
        }

        if (token === " * ") {
          next.logs.push("STAR が魚雷を吸収した。");
          break;
        }

        if (token === ">!<") {
          next.logs.push("*** STARBASE DESTROYED ***");
          next.board[y][x] = "   ";
          next.base = null;
          next.totalB -= 1;
          next.galaxy[next.enterprise.qy][next.enterprise.qx].base = 0;
          break;
        }
      }

      if (!next.gameOver) fireBack(next, next.logs);
    });
  };

  const cmdNav = () => {
    runCommand((next) => {
      const c = Number(navCourse);
      const w = Number(navWarp);
      if (!Number.isFinite(c) || !Number.isFinite(w) || c < 1 || c > 8 || w <= 0 || w > 8) {
        next.logs.push("NAV: COURSE 1-8, WARP 0-8 の範囲で指定。", "NAV 失敗。");
        return;
      }
      const n = Math.floor(w * 8 + 0.5);
      const moveCost = n + 10;
      if (moveCost > next.energy + next.shields) {
        next.logs.push("NAV: エネルギー不足。");
        return;
      }
      if (moveCost > next.energy) {
        const d = moveCost - next.energy;
        next.energy = 0;
        next.shields = Math.max(0, next.shields - d);
      } else {
        next.energy -= moveCost;
      }

      const dir = DIR[Math.round(c)];
      let { qx, qy, sx, sy } = next.enterprise;
      let blocked = false;

      next.board[sy][sx] = "   ";
      for (let step = 0; step < n; step++) {
        sx += dir.x;
        sy += dir.y;

        if (sx < 0) {
          if (qx === 0) {
            sx = 0;
            blocked = true;
            break;
          }
          qx -= 1;
          sx = SECTOR_SIZE - 1;
        } else if (sx >= SECTOR_SIZE) {
          if (qx === GALAXY_SIZE - 1) {
            sx = SECTOR_SIZE - 1;
            blocked = true;
            break;
          }
          qx += 1;
          sx = 0;
        }

        if (sy < 0) {
          if (qy === 0) {
            sy = 0;
            blocked = true;
            break;
          }
          qy -= 1;
          sy = SECTOR_SIZE - 1;
        } else if (sy >= SECTOR_SIZE) {
          if (qy === GALAXY_SIZE - 1) {
            sy = SECTOR_SIZE - 1;
            blocked = true;
            break;
          }
          qy += 1;
          sy = 0;
        }

        if (qx === next.enterprise.qx && qy === next.enterprise.qy) {
          if (next.board[sy][sx] !== "   ") {
            sx -= dir.x;
            sy -= dir.y;
            blocked = true;
            break;
          }
        }
      }

      if (qx !== next.enterprise.qx || qy !== next.enterprise.qy) {
        const entered = enterQuadrant(next, qx, qy, sx, sy);
        Object.assign(next, entered.next);
        next.logs.push(...entered.logs);
      } else {
        next.enterprise = { ...next.enterprise, sx, sy };
        next.board[sy][sx] = "<*>";
        const dockInfo = resolveDocking(next);
        if (dockInfo.docked) {
          next.energy = INITIAL_ENERGY;
          next.torpedoes = INITIAL_TORPEDOES;
          next.shields = 0;
        }
        next.logs.push(`NAV: SECTOR ${sx + 1},${sy + 1} へ移動。`, ...dockInfo.logs);
      }

      if (blocked) next.logs.push("銀河境界により航行停止。");

      next.stardate += w >= 1 ? 1 : Math.max(0.1, Math.floor(w * 10) / 10);
      if (!next.gameOver) fireBack(next, next.logs);
    });
  };

  const resetGame = () => setState(gameInit());

  return (
    <div
      style={{
        height: "100dvh",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 20% 0%, #0f172a, #020617 60%), linear-gradient(160deg, #111827, #030712)",
        color: "#e2e8f0",
        fontFamily: "'Space Mono', 'Hiragino Sans', monospace",
        padding: "12px",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1180, margin: "0 auto", height: "100%", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 10 }}>
        <div>
          <h1 style={{ margin: "2px 0 2px", letterSpacing: "0.08em", fontSize: "1.35rem" }}>SUPER STAR TREK</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
          <a
            href="./index.html"
            style={{
              color: "#7dd3fc",
              textDecoration: "none",
              fontSize: "0.82rem",
              border: "1px solid #0ea5e9",
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            ← ゲーム一覧へ
          </a>
          {state.gameOver ? (
            <span style={{ color: state.won ? "#22c55e" : "#f87171", fontWeight: 700 }}>
              {state.won ? "MISSION COMPLETE" : "MISSION FAILED"}
            </span>
          ) : (
            <span style={{ color: "#facc15" }}>MISSION ACTIVE</span>
          )}
        </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 10, minHeight: 0 }}>
          <section style={{ border: "1px solid #334155", borderRadius: 12, padding: 10, background: "rgba(2,6,23,0.6)", minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(120px, 1fr)", gap: 8 }}>
            <div style={{ minHeight: 0 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: "0.95rem", color: "#cbd5e1" }}>SHORT RANGE SCAN</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${SECTOR_SIZE}, minmax(34px, 1fr))`,
                  gap: 4,
                  marginBottom: 8,
                }}
              >
                {state.board.map((row, y) =>
                  row.map((token, x) => (
                    <div
                      key={`${x}-${y}`}
                      style={{
                        height: 30,
                        borderRadius: 6,
                        border: "1px solid #334155",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.72rem",
                        background: token === "   " ? "rgba(15,23,42,0.5)" : "rgba(15,23,42,0.88)",
                        color: boardTokenColor(token),
                      }}
                    >
                      {token}
                    </div>
                  )),
                )}
              </div>
              <div style={{ fontSize: "0.82rem", lineHeight: 1.7, color: "#cbd5e1" }}>
                <div>STARDATE: {state.stardate.toFixed(1)}</div>
                <div>DEADLINE: {status.deadline}</div>
                <div>CONDITION: {status.condition}</div>
                <div>
                  QUADRANT: {state.enterprise.qx + 1},{state.enterprise.qy + 1} / SECTOR: {state.enterprise.sx + 1},
                  {state.enterprise.sy + 1}
                </div>
                <div>ENERGY: {Math.floor(state.energy)}</div>
                <div>SHIELDS: {Math.floor(state.shields)}</div>
                <div>TORPEDOES: {Math.floor(state.torpedoes)}</div>
                <div>KLINGONS LEFT: {state.totalK}</div>
                <div>STARBASES: {state.totalB}</div>
                <div>DAYS LEFT: {status.remainingDays}</div>
              </div>
            </div>
            <section
              ref={logRef}
              style={{
                border: "1px solid #334155",
                borderRadius: 10,
                background: "#020617",
                padding: 8,
                minHeight: 0,
                overflowY: "auto",
                fontSize: "0.78rem",
                lineHeight: 1.45,
              }}
            >
              <h3 style={{ margin: "0 0 6px", fontSize: "0.78rem", color: "#93c5fd", letterSpacing: "0.04em" }}>COMPUTER</h3>
              {state.logs.map((line, i) => (
                <div key={`${i}-${line.slice(0, 8)}`} style={{ color: line.includes("FAILED") || line.includes("撃沈") ? "#f87171" : line.includes("COMPLETE") || line.includes("成功") ? "#22c55e" : "#cbd5e1" }}>
                  {line}
                </div>
              ))}
            </section>
          </section>

          <section style={{ border: "1px solid #334155", borderRadius: 12, padding: 8, background: "rgba(2,6,23,0.6)", minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(120px, 1fr)", gap: 8 }}>
            <div style={{ minHeight: 0 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: "0.9rem", color: "#cbd5e1" }}>COMMAND CONSOLE</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(110px,1fr))", gap: 6, marginBottom: 6 }}>
              <button style={btnStyle} onClick={cmdSrs} disabled={state.gameOver}>SRS</button>
              <button style={btnStyle} onClick={cmdLrs} disabled={state.gameOver}>LRS</button>
              <button style={btnStyle} onClick={cmdDam} disabled={state.gameOver}>DAM</button>
              <button style={btnStyle} onClick={cmdCom} disabled={state.gameOver}>COM</button>
            </div>

            <div style={panelStyle}>
              <label style={labelStyle}>NAV COURSE (1-8)</label>
              <input style={inputStyle} value={navCourse} onChange={(e) => setNavCourse(e.target.value)} />
              {navCourse.trim() !== "" && <div style={courseInlineStyle}>1→ 2↗ 3↑ 4↖ 5← 6↙ 7↓ 8↘</div>}
              <label style={labelStyle}>WARP (0-8)</label>
              <input style={inputStyle} value={navWarp} onChange={(e) => setNavWarp(e.target.value)} />
              <button style={btnStyle} onClick={cmdNav} disabled={state.gameOver}>NAV 実行</button>
            </div>

            <div style={panelStyle}>
              <label style={labelStyle}>PHA ENERGY</label>
              <input style={inputStyle} value={phaserEnergy} onChange={(e) => setPhaserEnergy(e.target.value)} />
              <button style={btnStyle} onClick={cmdPhaser} disabled={state.gameOver}>PHA 実行</button>
            </div>

            <div style={panelStyle}>
              <label style={labelStyle}>TOR COURSE (1-8)</label>
              <input style={inputStyle} value={torCourse} onChange={(e) => setTorCourse(e.target.value)} />
              {torCourse.trim() !== "" && <div style={courseInlineStyle}>1→ 2↗ 3↑ 4↖ 5← 6↙ 7↓ 8↘</div>}
              <button style={btnStyle} onClick={cmdTorpedo} disabled={state.gameOver}>TOR 実行</button>
            </div>

            <div style={panelStyle}>
              <label style={labelStyle}>SHE TARGET</label>
              <input style={inputStyle} value={shieldTarget} onChange={(e) => setShieldTarget(e.target.value)} />
              <button style={btnStyle} onClick={cmdShield} disabled={state.gameOver}>SHE 実行</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button style={dangerBtnStyle} onClick={cmdResign} disabled={state.gameOver}>XXX 辞任</button>
              <button style={btnStyle} onClick={resetGame}>新規ミッション</button>
            </div>
            </div>
            <section style={{ border: "1px solid #334155", borderRadius: 10, background: "#020617", padding: 8, minHeight: 0, overflowY: "auto", fontSize: "0.72rem", lineHeight: 1.55, color: "#cbd5e1" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "0.78rem", color: "#93c5fd", letterSpacing: "0.04em" }}>GUIDE</h3>
              <div>移動: `NAV` で COURSE と WARP を指定。</div>
              <div>攻撃: `PHA` はエネルギー配分、`TOR` は直線軌道。</div>
              <div>防御: `SHE` でシールド値を設定。</div>
              <div>索敵: `SRS` は近距離、`LRS` は周辺3x3。</div>
              <div>情報: `COM` で既知銀河記録、`DAM` で状態確認。</div>
              <div>終了: `XXX` で辞任。</div>
              <div style={{ marginTop: 6, color: "#94a3b8" }}>目標: 期限内に全クリンゴン艦を撃破。</div>
            </section>
          </section>
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  border: "1px solid #0ea5e9",
  background: "#082f49",
  color: "#e0f2fe",
  borderRadius: 8,
  padding: "6px 8px",
  fontFamily: "inherit",
  fontSize: "0.75rem",
  cursor: "pointer",
};

const dangerBtnStyle = {
  ...btnStyle,
  border: "1px solid #ef4444",
  background: "#450a0a",
  color: "#fecaca",
};

const panelStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 4,
  border: "1px solid #1e293b",
  borderRadius: 10,
  padding: 8,
  marginBottom: 6,
  background: "rgba(15,23,42,0.6)",
};

const labelStyle = {
  fontSize: "0.68rem",
  color: "#94a3b8",
};

const inputStyle = {
  border: "1px solid #334155",
  background: "#020617",
  color: "#e2e8f0",
  borderRadius: 6,
  padding: "6px",
  fontFamily: "inherit",
  fontSize: "0.78rem",
};

const courseInlineStyle = {
  fontSize: "0.66rem",
  color: "#7dd3fc",
  lineHeight: 1.3,
};
