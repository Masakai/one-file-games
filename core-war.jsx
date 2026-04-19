import { useEffect, useMemo, useRef, useState } from "react";

const CORE_SIZE = 160;
const MAX_CYCLES = 1200;

const WARRIORS = [
  {
    name: "Imp",
    color: "#60a5fa",
    code: [
      { op: "MOV", a: 0, b: 1 },
    ],
  },
  {
    name: "Dwarf",
    color: "#f87171",
    code: [
      { op: "ADD", a: 4, b: 3 },
      { op: "MOV", a: 2, b: 2 },
      { op: "JMP", a: -2, b: 0 },
      { op: "DAT", a: 0, b: 0 },
    ],
  },
  {
    name: "Scanner",
    color: "#34d399",
    code: [
      { op: "MOV", a: 3, b: 8 },
      { op: "ADD", a: 2, b: -1 },
      { op: "JMP", a: -2, b: 0 },
      { op: "DAT", a: 0, b: 0 },
    ],
  },
];

function mod(n) {
  return ((n % CORE_SIZE) + CORE_SIZE) % CORE_SIZE;
}

function cloneInstruction(inst) {
  return { op: inst.op, a: inst.a, b: inst.b, owner: inst.owner ?? null, age: 0 };
}

function emptyCore() {
  return Array.from({ length: CORE_SIZE }, () => ({ op: "DAT", a: 0, b: 0, owner: null, age: 0 }));
}

function place(core, warrior, start, owner) {
  warrior.code.forEach((inst, i) => {
    core[mod(start + i)] = { ...cloneInstruction(inst), owner, age: 10 };
  });
}

function initialBattle(leftIndex = 0, rightIndex = 1) {
  const core = emptyCore();
  const left = WARRIORS[leftIndex];
  const right = WARRIORS[rightIndex];
  place(core, left, 12, 0);
  place(core, right, 92, 1);
  return {
    core,
    warriors: [leftIndex, rightIndex],
    queues: [[12], [92]],
    turn: 0,
    cycle: 0,
    status: "running",
    message: `${left.name} vs ${right.name}`,
    log: ["Redcode風の簡易 Core War。DATを実行したプロセスは消滅。"],
  };
}

function describe(inst) {
  return `${inst.op} ${inst.a}, ${inst.b}`;
}

function step(state) {
  if (state.status !== "running") return state;
  const active = state.turn;
  const queues = state.queues.map(q => [...q]);
  if (queues[active].length === 0) {
    return { ...state, status: "finished", message: `${WARRIORS[state.warriors[1 - active]].name} wins.` };
  }

  const core = state.core.map(cell => ({ ...cell, age: Math.max(0, cell.age - 1) }));
  const pc = queues[active].shift();
  const inst = core[pc];
  let nextPc = mod(pc + 1);
  let message = `${WARRIORS[state.warriors[active]].name}: ${describe(inst)} @${pc}`;

  if (inst.op === "DAT") {
    message = `${WARRIORS[state.warriors[active]].name} process died @${pc}`;
  } else if (inst.op === "MOV") {
    const src = mod(pc + inst.a);
    const dst = mod(pc + inst.b);
    core[dst] = { ...cloneInstruction(core[src]), owner: active, age: 16 };
    queues[active].push(nextPc);
  } else if (inst.op === "ADD") {
    const src = core[mod(pc + inst.a)];
    const dstAddr = mod(pc + inst.b);
    const dst = core[dstAddr];
    core[dstAddr] = { ...dst, a: dst.a + src.a, b: dst.b + src.b, owner: active, age: 16 };
    queues[active].push(nextPc);
  } else if (inst.op === "JMP") {
    queues[active].push(mod(pc + inst.a));
  } else if (inst.op === "SPL") {
    queues[active].push(nextPc, mod(pc + inst.a));
  }

  let status = "running";
  let finalMessage = message;
  if (queues[0].length === 0 || queues[1].length === 0) {
    const winner = queues[0].length > 0 ? 0 : 1;
    status = "finished";
    finalMessage = `${WARRIORS[state.warriors[winner]].name} wins.`;
  } else if (state.cycle + 1 >= MAX_CYCLES) {
    status = "finished";
    finalMessage = "Max cycles reached. Draw.";
  }

  return {
    ...state,
    core,
    queues,
    turn: 1 - active,
    cycle: state.cycle + 1,
    status,
    message: finalMessage,
    log: [message, ...state.log].slice(0, 7),
  };
}

function CoreGrid({ state }) {
  const queueMarks = new Map();
  state.queues.forEach((queue, owner) => {
    queue.forEach(pc => queueMarks.set(pc, owner));
  });
  return (
    <div style={styles.coreGrid}>
      {state.core.map((cell, i) => {
        const pcOwner = queueMarks.get(i);
        const owner = pcOwner ?? cell.owner;
        const color = owner === null || owner === undefined ? "#111827" : WARRIORS[state.warriors[owner]].color;
        return (
          <span
            key={i}
            title={`${i}: ${describe(cell)}`}
            style={{
              ...styles.coreCell,
              background: cell.owner === null ? "#111827" : color,
              opacity: cell.owner === null ? 0.45 : 0.45 + cell.age / 30,
              outline: pcOwner !== undefined ? `2px solid ${color}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

export default function CoreWar() {
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(1);
  const [state, setState] = useState(() => initialBattle(0, 1));
  const [running, setRunning] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (running && state.status === "running") {
      timer.current = window.setInterval(() => setState(current => step(current)), 95);
    }
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [running, state.status]);

  const ownership = useMemo(() => {
    const counts = [0, 0, 0];
    state.core.forEach(cell => {
      if (cell.owner === 0) counts[0] += 1;
      else if (cell.owner === 1) counts[1] += 1;
      else counts[2] += 1;
    });
    return counts;
  }, [state.core]);

  const reset = (nextLeft = leftIndex, nextRight = rightIndex) => {
    setRunning(false);
    setLeftIndex(nextLeft);
    setRightIndex(nextRight);
    setState(initialBattle(nextLeft, nextRight));
  };

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Core War</h1>
            <p style={styles.sub}>Redcode inspired core memory duel</p>
          </div>
          <div style={styles.actions}>
            <a style={styles.link} href="./index.html">一覧へ</a>
            <button type="button" style={styles.button} onClick={() => reset()}>RESET</button>
          </div>
        </header>

        <section style={styles.matchPanel}>
          <label style={styles.label}>
            BLUE
            <select style={styles.select} value={leftIndex} onChange={e => reset(Number(e.target.value), rightIndex)}>
              {WARRIORS.map((w, i) => <option key={w.name} value={i}>{w.name}</option>)}
            </select>
          </label>
          <label style={styles.label}>
            RED
            <select style={styles.select} value={rightIndex} onChange={e => reset(leftIndex, Number(e.target.value))}>
              {WARRIORS.map((w, i) => <option key={w.name} value={i}>{w.name}</option>)}
            </select>
          </label>
          <button type="button" style={styles.bigButton} onClick={() => setRunning(current => !current)} disabled={state.status !== "running"}>
            {running ? "PAUSE" : "RUN"}
          </button>
          <button type="button" style={styles.button} onClick={() => setState(current => step(current))} disabled={state.status !== "running"}>STEP</button>
        </section>

        <section style={styles.status}>
          <span>CYCLE {state.cycle}/{MAX_CYCLES}</span>
          <span>{WARRIORS[state.warriors[0]].name} PROC {state.queues[0].length}</span>
          <span>{WARRIORS[state.warriors[1]].name} PROC {state.queues[1].length}</span>
          <span>CORE {ownership[0]} / {ownership[1]} / {ownership[2]}</span>
        </section>

        <section style={styles.coreWrap}>
          <CoreGrid state={state} />
        </section>

        <section style={styles.message}>{state.message}</section>

        <section style={styles.codePanel}>
          {[0, 1].map(side => (
            <div key={side} style={styles.codeCard}>
              <h2 style={{ ...styles.codeTitle, color: WARRIORS[state.warriors[side]].color }}>{WARRIORS[state.warriors[side]].name}</h2>
              <pre style={styles.code}>
                {WARRIORS[state.warriors[side]].code.map((inst, i) => `${String(i).padStart(2, "0")}  ${describe(inst)}`).join("\n")}
              </pre>
            </div>
          ))}
        </section>

        <ol style={styles.log}>
          {state.log.map((line, i) => <li key={`${line}-${i}`}>{line}</li>)}
        </ol>
      </section>
    </main>
  );
}

const mono = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';

const styles = {
  page: {
    minHeight: "100vh",
    background: "#050505",
    color: "#d1fae5",
    fontFamily: mono,
    padding: "22px 12px",
  },
  shell: {
    width: "min(1040px, 100%)",
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
    color: "#6ee7b7",
    fontSize: "0.82rem",
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  link: {
    color: "#d1fae5",
    textDecoration: "none",
    border: "1px solid #166534",
    background: "#06140b",
    borderRadius: "4px",
    padding: "8px 10px",
    fontWeight: 800,
  },
  button: {
    color: "#d1fae5",
    border: "1px solid #166534",
    background: "#06140b",
    borderRadius: "4px",
    padding: "8px 10px",
    fontFamily: mono,
    fontWeight: 900,
    cursor: "pointer",
  },
  bigButton: {
    color: "#031008",
    border: "1px solid #6ee7b7",
    background: "#6ee7b7",
    borderRadius: "4px",
    padding: "8px 14px",
    fontFamily: mono,
    fontWeight: 900,
    cursor: "pointer",
  },
  matchPanel: {
    display: "flex",
    alignItems: "end",
    gap: "10px",
    flexWrap: "wrap",
    border: "1px solid #166534",
    background: "#06140b",
    padding: "12px",
    marginBottom: "12px",
  },
  label: {
    display: "grid",
    gap: "5px",
    color: "#86efac",
    fontSize: "0.76rem",
    fontWeight: 900,
  },
  select: {
    color: "#d1fae5",
    border: "1px solid #166534",
    background: "#020805",
    borderRadius: "4px",
    padding: "8px",
    fontFamily: mono,
  },
  status: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    border: "1px solid #166534",
    padding: "10px",
    marginBottom: "12px",
    color: "#bbf7d0",
    background: "#020805",
    fontWeight: 900,
  },
  coreWrap: {
    border: "1px solid #166534",
    background: "#020805",
    padding: "12px",
    overflow: "auto",
  },
  coreGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(20, minmax(13px, 1fr))",
    gap: "4px",
  },
  coreCell: {
    aspectRatio: "1",
    minWidth: "13px",
    borderRadius: "2px",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
  },
  message: {
    border: "1px solid #166534",
    background: "#06140b",
    padding: "10px",
    marginTop: "12px",
    color: "#d1fae5",
  },
  codePanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "12px",
    marginTop: "12px",
  },
  codeCard: {
    border: "1px solid #166534",
    background: "#06140b",
    padding: "12px",
  },
  codeTitle: {
    margin: "0 0 8px",
    fontSize: "1rem",
  },
  code: {
    margin: 0,
    color: "#bbf7d0",
    lineHeight: 1.5,
  },
  log: {
    margin: "12px 0 0",
    padding: "10px 10px 10px 32px",
    border: "1px solid #166534",
    background: "#020805",
    color: "#86efac",
    fontSize: "0.82rem",
  },
};
