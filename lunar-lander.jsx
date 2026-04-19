import { useCallback, useEffect, useRef, useState } from "react";

const GRAVITY = 1.62;
const MAX_THRUST = 4.2;
const DT = 0.16;
const PAD_X = 50;
const PAD_HALF = 9;
const SAFE_VERTICAL = 2.4;
const SAFE_HORIZONTAL = 1.4;
const SAFE_TILT = 8;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function initialState() {
  return {
    x: 18,
    y: 94,
    vx: 4.4,
    vy: -1.2,
    fuel: 100,
    angle: 0,
    thrust: 0,
    time: 0,
    score: 0,
    status: "flying",
    message: "月面へ接近中。着陸脚を壊さずパッドへ降りろ。",
    input: "0",
    log: ["数値入力なら 0-9 で推力、Enter で1ステップ進行。"],
  };
}

function evaluateLanding(s) {
  const onPad = Math.abs(s.x - PAD_X) <= PAD_HALF;
  const goodVy = Math.abs(s.vy) <= SAFE_VERTICAL;
  const goodVx = Math.abs(s.vx) <= SAFE_HORIZONTAL;
  const goodTilt = Math.abs(s.angle) <= SAFE_TILT;
  if (onPad && goodVy && goodVx && goodTilt) {
    const score = Math.max(0, Math.round(s.fuel * 12 + (100 - s.time) * 4 + 300));
    return {
      ...s,
      y: 0,
      vy: 0,
      vx: 0,
      thrust: 0,
      score,
      status: "landed",
      message: "着陸成功。静かな月面に機体が立った。",
      log: [`着陸成功。Score ${score}`, ...s.log].slice(0, 6),
    };
  }
  return {
    ...s,
    y: 0,
    vy: 0,
    vx: 0,
    thrust: 0,
    status: "crashed",
    message: "衝突。速度・横ずれ・傾きのどれかが大きすぎた。",
    log: ["衝突。もう一度、低速でパッド中央を狙え。", ...s.log].slice(0, 6),
  };
}

function stepPhysics(s, thrustPercent = s.thrust) {
  if (s.status !== "flying") return s;
  const thrust = clamp(thrustPercent, 0, 100);
  const fuelUse = thrust > 0 ? thrust * 0.018 : 0;
  const usableThrust = s.fuel > 0 ? thrust : 0;
  const radians = (s.angle * Math.PI) / 180;
  const accel = (usableThrust / 100) * MAX_THRUST;
  const ax = -Math.sin(radians) * accel;
  const ay = Math.cos(radians) * accel - GRAVITY;
  const vx = s.vx + ax * DT;
  const vy = s.vy + ay * DT;
  const x = clamp(s.x + vx * DT, 0, 100);
  const y = s.y + vy * DT;
  const fuel = clamp(s.fuel - fuelUse, 0, 100);
  const next = {
    ...s,
    x,
    y,
    vx: x === 0 || x === 100 ? -vx * 0.35 : vx,
    vy,
    fuel,
    thrust,
    time: s.time + DT,
    message: thrust > 0 && fuel > 0 ? `推力 ${Math.round(thrust)}%。燃料を消費中。` : "自由落下中。",
  };
  if (next.y <= 0) return evaluateLanding(next);
  return next;
}

function makeTerrainRows(state) {
  const width = 64;
  const height = 18;
  const rows = Array.from({ length: height }, () => Array(width).fill(" "));
  const landerX = clamp(Math.round((state.x / 100) * (width - 1)), 0, width - 1);
  const landerY = clamp(height - 2 - Math.round((state.y / 100) * (height - 3)), 0, height - 2);
  const padStart = Math.round(((PAD_X - PAD_HALF) / 100) * (width - 1));
  const padEnd = Math.round(((PAD_X + PAD_HALF) / 100) * (width - 1));

  for (let x = 0; x < width; x++) {
    rows[height - 1][x] = x >= padStart && x <= padEnd ? "=" : x % 7 === 0 ? "^" : "_";
  }
  rows[landerY][landerX] = state.status === "crashed" ? "*" : state.status === "landed" ? "A" : "^";
  if (state.status === "flying" && state.thrust > 0 && landerY + 1 < height - 1) {
    rows[landerY + 1][landerX] = state.thrust > 60 ? "|" : ".";
  }
  return rows.map(r => r.join(""));
}

const LANDER_PIXELS = [
  "0011100",
  "0111110",
  "1101011",
  "1111111",
  "0111110",
  "0011100",
  "0100010",
  "1000001",
];

function PixelSprite({ pattern, colors, pixel = 5 }) {
  return (
    <div
      style={{
        ...styles.sprite,
        gridTemplateColumns: `repeat(${pattern[0].length}, ${pixel}px)`,
        gridAutoRows: `${pixel}px`,
      }}
    >
      {pattern.flatMap((row, y) =>
        row.split("").map((cell, x) => (
          <span
            key={`${x}-${y}`}
            style={{
              width: pixel,
              height: pixel,
              background: colors[cell] || "transparent",
              boxShadow: colors[cell] ? "0 0 0 1px rgba(255,255,255,0.06) inset" : "none",
            }}
          />
        )),
      )}
    </div>
  );
}

function PixelScene({ state, safe, descentSpeed, horizontalSpeed }) {
  const left = clamp(state.x, 4, 96);
  const bottom = clamp(17 + state.y * 0.72, 18, 88);
  const padLeft = PAD_X - PAD_HALF;
  const padWidth = PAD_HALF * 2;
  const danger = !safe && (descentSpeed > SAFE_VERTICAL || horizontalSpeed > SAFE_HORIZONTAL || Math.abs(state.angle) > SAFE_TILT);

  return (
    <div style={styles.pixelScene}>
      <div style={styles.pixelSky}>
        {Array.from({ length: 34 }, (_, i) => (
          <span
            key={i}
            style={{
              ...styles.star,
              left: `${(i * 29 + 11) % 100}%`,
              top: `${(i * 17 + 7) % 64}%`,
              opacity: i % 3 === 0 ? 0.92 : 0.48,
            }}
          />
        ))}
      </div>

      <div style={styles.horizonGlow} />
      <div style={styles.planet} />

      <div style={{ ...styles.landerWrap, left: `${left}%`, bottom: `${bottom}%`, transform: `translate(-50%, 50%) rotate(${state.angle}deg)` }}>
        <PixelSprite
          pattern={LANDER_PIXELS}
          colors={{
            1: state.status === "crashed" ? "#ff5c7a" : "#dff7ff",
            0: "transparent",
          }}
        />
        {state.status === "flying" && state.thrust > 0 && state.fuel > 0 && (
          <div style={styles.flame}>
            <span style={{ ...styles.flamePixel, background: "#fff1a8" }} />
            <span style={{ ...styles.flamePixel, background: "#ff9d38" }} />
            <span style={{ ...styles.flamePixel, background: "#ff5b33" }} />
          </div>
        )}
      </div>

      {state.status === "crashed" && (
        <div style={{ ...styles.explosion, left: `${left}%`, bottom: `${bottom}%` }}>
          <span style={{ ...styles.explosionPixel, left: "-14px", top: "-10px", background: "#fff1a8" }} />
          <span style={{ ...styles.explosionPixel, left: "8px", top: "-18px", background: "#ff9d38" }} />
          <span style={{ ...styles.explosionPixel, left: "-4px", top: "8px", background: "#ff5b33" }} />
          <span style={{ ...styles.explosionPixel, left: "18px", top: "4px", background: "#ffdf6b" }} />
        </div>
      )}

      <div style={styles.terrain}>
        <div style={styles.ridgeA} />
        <div style={styles.ridgeB} />
        <div style={{ ...styles.pad, left: `${padLeft}%`, width: `${padWidth}%` }}>
          <span />
          <span />
          <span />
        </div>
        <div style={{ ...styles.crater, left: "11%", width: "80px", height: "18px" }} />
        <div style={{ ...styles.crater, left: "72%", width: "112px", height: "22px" }} />
        <div style={{ ...styles.crater, left: "32%", width: "48px", height: "12px", opacity: 0.55 }} />
      </div>

      <div style={styles.sceneHud}>
        <div style={danger ? styles.hudBadgeDanger : styles.hudBadge}>
          {safe ? "LANDING WINDOW" : danger ? "UNSTABLE APPROACH" : "APPROACH"}
        </div>
        <div style={styles.miniStats}>
          <span>ALT {Math.round(state.y)}</span>
          <span>THR {Math.round(state.thrust)}%</span>
          <span>FUEL {Math.round(state.fuel)}</span>
        </div>
      </div>
    </div>
  );
}

function format(value, digits = 1) {
  return value.toFixed(digits).padStart(5, " ");
}

function Gauge({ label, value, max, dangerAt, unit = "" }) {
  const pct = clamp((value / max) * 100, 0, 100);
  const danger = dangerAt !== undefined && value >= dangerAt;
  return (
    <div style={styles.gauge}>
      <div style={styles.gaugeTop}>
        <span>{label}</span>
        <span>{Math.round(value)}{unit}</span>
      </div>
      <div style={styles.gaugeTrack}>
        <div style={{ ...styles.gaugeFill, width: `${pct}%`, background: danger ? "#ef4444" : "#77f284" }} />
      </div>
    </div>
  );
}

export default function LunarLander() {
  const [state, setState] = useState(initialState);
  const [running, setRunning] = useState(false);
  const raf = useRef(null);
  const last = useRef(0);

  const descentSpeed = Math.abs(Math.min(0, state.vy));
  const horizontalSpeed = Math.abs(state.vx);
  const safe = Math.abs(state.x - PAD_X) <= PAD_HALF && descentSpeed <= SAFE_VERTICAL && horizontalSpeed <= SAFE_HORIZONTAL && Math.abs(state.angle) <= SAFE_TILT;

  const tick = useCallback((now) => {
    if (!last.current) last.current = now;
    const elapsed = now - last.current;
    if (elapsed >= 90) {
      setState(current => stepPhysics(current));
      last.current = now;
    }
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (running && state.status === "flying") {
      raf.current = requestAnimationFrame(tick);
    }
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      last.current = 0;
    };
  }, [running, state.status, tick]);

  const applyInputStep = () => {
    const thrust = clamp(Number.parseInt(state.input, 10) || 0, 0, 100);
    setRunning(false);
    setState(current => stepPhysics({ ...current, thrust }, thrust));
  };

  const changeThrust = (delta) => {
    setState(current => ({ ...current, thrust: clamp(current.thrust + delta, 0, 100), input: String(clamp(current.thrust + delta, 0, 100)) }));
  };

  const rotate = (delta) => {
    setState(current => ({ ...current, angle: clamp(current.angle + delta, -35, 35) }));
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === " ") {
        e.preventDefault();
        setRunning(current => !current);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        changeThrust(10);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        changeThrust(-10);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        rotate(-3);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        rotate(3);
      } else if (e.key === "Enter") {
        e.preventDefault();
        applyInputStep();
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        setRunning(false);
        setState(initialState());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Lunar Lander</h1>
            <p style={styles.sub}>1960s/70s style terminal landing simulator</p>
          </div>
          <div style={styles.headerActions}>
            <a style={styles.link} href="./index.html">一覧へ</a>
            <button type="button" style={styles.button} onClick={() => { setRunning(false); setState(initialState()); }}>新規</button>
          </div>
        </header>

        <section style={styles.screen}>
          <div style={styles.message}>{state.message}</div>
          <PixelScene state={state} safe={safe} descentSpeed={descentSpeed} horizontalSpeed={horizontalSpeed} />
          <div style={styles.readout}>
            <span>ALT {format(state.y)}</span>
            <span>VSPD {format(descentSpeed)}</span>
            <span>HSPD {format(horizontalSpeed)}</span>
            <span>FUEL {format(state.fuel, 0)}</span>
            <span>ANGLE {format(state.angle, 0)}</span>
            <span>TIME {format(state.time)}</span>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.controls}>
            <button type="button" style={styles.bigButton} onClick={() => setRunning(current => !current)} disabled={state.status !== "flying"}>
              {running ? "PAUSE" : "RUN"}
            </button>
            <button type="button" style={styles.button} onClick={() => rotate(-3)} disabled={state.status !== "flying"}>← TILT</button>
            <button type="button" style={styles.button} onClick={() => rotate(3)} disabled={state.status !== "flying"}>TILT →</button>
            <button type="button" style={styles.button} onClick={() => changeThrust(-10)} disabled={state.status !== "flying"}>- THR</button>
            <button type="button" style={styles.button} onClick={() => changeThrust(10)} disabled={state.status !== "flying"}>+ THR</button>
          </div>

          <div style={styles.inputRow}>
            <label style={styles.label}>
              推力入力
              <input
                style={styles.input}
                value={state.input}
                inputMode="numeric"
                onChange={e => setState(current => ({ ...current, input: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                onKeyDown={e => {
                  if (e.key === "Enter") applyInputStep();
                }}
                disabled={state.status !== "flying"}
              />
            </label>
            <button type="button" style={styles.button} onClick={applyInputStep} disabled={state.status !== "flying"}>1 STEP</button>
          </div>

          <div style={styles.gauges}>
            <Gauge label="DESCENT" value={descentSpeed} max={8} dangerAt={SAFE_VERTICAL} />
            <Gauge label="HORIZONTAL" value={horizontalSpeed} max={8} dangerAt={SAFE_HORIZONTAL} />
            <Gauge label="FUEL" value={state.fuel} max={100} />
          </div>
        </section>

        <section style={styles.guide}>
          <div style={styles.guideTitle}>キー説明</div>
          <div style={styles.guideGrid}>
            <span><kbd style={styles.kbd}>Space</kbd></span><span>自動進行の開始 / 停止</span>
            <span><kbd style={styles.kbd}>↑</kbd><kbd style={styles.kbd}>↓</kbd></span><span>推力を増減</span>
            <span><kbd style={styles.kbd}>←</kbd><kbd style={styles.kbd}>→</kbd></span><span>機体を傾ける</span>
            <span><kbd style={styles.kbd}>0-9</kbd><kbd style={styles.kbd}>Enter</kbd></span><span>数値推力で1ステップ進行</span>
            <span><kbd style={styles.kbd}>R</kbd></span><span>最初からやり直す</span>
          </div>
        </section>

        <section style={safe ? styles.safeBox : styles.warnBox}>
          目標: 着陸パッド中央に、降下速度 {SAFE_VERTICAL} 以下・横速度 {SAFE_HORIZONTAL} 以下・傾き {SAFE_TILT} 度以内で接地。
        </section>

        {state.status !== "flying" && (
          <div style={styles.result}>
            <div style={styles.resultTitle}>{state.status === "landed" ? "LANDING SUCCESS" : "CRASH"}</div>
            <div>Score: {state.score}</div>
            <button type="button" style={styles.resultButton} onClick={() => { setRunning(false); setState(initialState()); }}>もう一度</button>
          </div>
        )}
      </section>
    </main>
  );
}

const mono = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

const styles = {
  page: {
    minHeight: "100vh",
    background: "#08111f",
    color: "#e5f0ff",
    fontFamily: mono,
    padding: "22px 12px",
  },
  shell: {
    width: "min(1080px, 100%)",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
  },
  title: {
    margin: 0,
    fontSize: "1.6rem",
    letterSpacing: 0,
  },
  sub: {
    margin: "3px 0 0",
    color: "#8aa4c8",
    fontSize: "0.8rem",
  },
  headerActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  link: {
    display: "inline-flex",
    alignItems: "center",
    color: "#e5f0ff",
    textDecoration: "none",
    border: "1px solid #355277",
    background: "#0a1730",
    borderRadius: "4px",
    padding: "8px 10px",
    fontSize: "0.84rem",
  },
  button: {
    color: "#e5f0ff",
    border: "1px solid #355277",
    background: "#0a1730",
    borderRadius: "4px",
    padding: "8px 10px",
    fontFamily: mono,
    fontWeight: 800,
    cursor: "pointer",
  },
  bigButton: {
    color: "#07111f",
    border: "1px solid #9fd3ff",
    background: "#9fd3ff",
    borderRadius: "4px",
    padding: "8px 14px",
    fontFamily: mono,
    fontWeight: 900,
    cursor: "pointer",
  },
  screen: {
    border: "1px solid #355277",
    background: "#07111f",
    boxShadow: "0 0 0 1px #0f2442 inset, 0 22px 60px rgba(0,0,0,0.24)",
    overflow: "hidden",
  },
  message: {
    minHeight: "30px",
    padding: "7px 10px",
    borderBottom: "1px solid #203a5e",
    color: "#d8ecff",
    whiteSpace: "nowrap",
  },
  pixelScene: {
    position: "relative",
    height: "min(58vw, 520px)",
    minHeight: "340px",
    overflow: "hidden",
    background: "linear-gradient(180deg, #0c1b38 0%, #132a4f 48%, #20335a 72%, #1c2536 100%)",
    imageRendering: "pixelated",
  },
  pixelSky: {
    position: "absolute",
    inset: 0,
  },
  star: {
    position: "absolute",
    width: "3px",
    height: "3px",
    background: "#e9f7ff",
    boxShadow: "6px 0 #9fd3ff",
  },
  horizonGlow: {
    position: "absolute",
    left: "8%",
    right: "8%",
    bottom: "23%",
    height: "90px",
    background: "linear-gradient(180deg, rgba(122,214,255,0), rgba(122,214,255,0.18))",
  },
  planet: {
    position: "absolute",
    right: "10%",
    top: "12%",
    width: "78px",
    height: "78px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #dde9f5, #7b90ad)",
    boxShadow: "inset -16px -12px #52627d, 0 0 0 5px rgba(255,255,255,0.06)",
  },
  landerWrap: {
    position: "absolute",
    zIndex: 5,
    transformOrigin: "50% 52%",
    transition: "left 0.08s linear, bottom 0.08s linear, transform 0.08s linear",
    filter: "drop-shadow(0 8px 0 rgba(0,0,0,0.22))",
  },
  sprite: {
    display: "grid",
  },
  flame: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 6px)",
    gridAutoRows: "6px",
    justifyContent: "center",
    gap: "0",
    marginTop: "2px",
    animation: "none",
  },
  flamePixel: {
    display: "block",
    width: "6px",
    height: "6px",
  },
  explosion: {
    position: "absolute",
    zIndex: 8,
    transform: "translate(-50%, 50%)",
  },
  explosionPixel: {
    position: "absolute",
    width: "12px",
    height: "12px",
    boxShadow: "0 0 18px currentColor",
  },
  terrain: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "24%",
    background: "linear-gradient(180deg, #5e6880 0%, #32384a 42%, #202635 100%)",
    borderTop: "5px solid #a9b4c8",
  },
  ridgeA: {
    position: "absolute",
    left: "-4%",
    right: "-4%",
    top: "-26px",
    height: "36px",
    background: "linear-gradient(135deg, transparent 0 18px, #8d99ad 18px 28px, transparent 28px), linear-gradient(45deg, transparent 0 24px, #727d91 24px 34px, transparent 34px)",
    backgroundSize: "96px 36px, 132px 36px",
  },
  ridgeB: {
    position: "absolute",
    inset: "22px 0 auto",
    height: "20px",
    background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 18px, transparent 18px 54px)",
  },
  pad: {
    position: "absolute",
    top: "-11px",
    height: "12px",
    background: "#9fd3ff",
    boxShadow: "0 0 0 4px rgba(159,211,255,0.18), inset 0 -4px #4f8ec6",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
  },
  crater: {
    position: "absolute",
    bottom: "20%",
    borderRadius: "50%",
    background: "rgba(7, 17, 31, 0.48)",
    boxShadow: "inset 0 4px rgba(255,255,255,0.08)",
  },
  sceneHud: {
    position: "absolute",
    left: "12px",
    right: "12px",
    top: "12px",
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
  },
  hudBadge: {
    background: "#102942",
    color: "#a9f7c0",
    border: "1px solid #2f7d4f",
    padding: "6px 9px",
    borderRadius: "4px",
    fontWeight: 900,
    fontSize: "0.72rem",
  },
  hudBadgeDanger: {
    background: "#34121d",
    color: "#ffc6d0",
    border: "1px solid #934055",
    padding: "6px 9px",
    borderRadius: "4px",
    fontWeight: 900,
    fontSize: "0.72rem",
  },
  miniStats: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    color: "#dff7ff",
    fontSize: "0.72rem",
    fontWeight: 800,
  },
  readout: {
    display: "flex",
    gap: "14px",
    flexWrap: "wrap",
    padding: "8px 10px",
    borderTop: "1px solid #203a5e",
    color: "#f6fbff",
    fontSize: "0.86rem",
  },
  panel: {
    display: "grid",
    gridTemplateColumns: "1.1fr minmax(220px, 0.8fr) 1fr",
    gap: "12px",
    alignItems: "start",
    marginTop: "12px",
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    alignItems: "end",
  },
  label: {
    display: "grid",
    gap: "5px",
    color: "#aec8e9",
    fontSize: "0.8rem",
  },
  input: {
    width: "88px",
    color: "#e5f0ff",
    background: "#07111f",
    border: "1px solid #355277",
    borderRadius: "4px",
    padding: "8px",
    fontFamily: mono,
    fontSize: "1rem",
  },
  gauges: {
    display: "grid",
    gap: "8px",
  },
  gauge: {
    border: "1px solid #203a5e",
    padding: "7px",
    background: "#07111f",
  },
  gaugeTop: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.76rem",
    color: "#aec8e9",
    marginBottom: "5px",
  },
  gaugeTrack: {
    height: "8px",
    background: "#0f2442",
  },
  gaugeFill: {
    height: "100%",
  },
  guide: {
    marginTop: "12px",
    border: "1px solid #203a5e",
    background: "#07111f",
    padding: "12px",
  },
  guideTitle: {
    fontWeight: 900,
    marginBottom: "10px",
  },
  guideGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(150px, auto) 1fr minmax(150px, auto) 1fr",
    gap: "8px 12px",
    alignItems: "center",
    color: "#aec8e9",
    fontSize: "0.82rem",
  },
  kbd: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "26px",
    height: "24px",
    marginRight: "4px",
    border: "1px solid #355277",
    borderRadius: "4px",
    background: "#0a1730",
    color: "#e5f0ff",
    fontFamily: mono,
    fontSize: "0.76rem",
    fontWeight: 900,
    padding: "0 5px",
  },
  safeBox: {
    marginTop: "12px",
    border: "1px solid #2f7d4f",
    background: "#082114",
    color: "#a9f7c0",
    padding: "10px",
    fontSize: "0.84rem",
  },
  warnBox: {
    marginTop: "12px",
    border: "1px solid #6c4f20",
    background: "#201707",
    color: "#ffd993",
    padding: "10px",
    fontSize: "0.84rem",
  },
  result: {
    position: "fixed",
    inset: 0,
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px",
    background: "rgba(5, 8, 22, 0.78)",
  },
  resultTitle: {
    fontSize: "1.8rem",
    fontWeight: 900,
  },
  resultButton: {
    color: "#07111f",
    border: "1px solid #e5f0ff",
    background: "#e5f0ff",
    borderRadius: "4px",
    padding: "10px 16px",
    fontFamily: mono,
    fontWeight: 900,
    cursor: "pointer",
  },
};
