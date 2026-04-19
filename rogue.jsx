import { useCallback, useEffect, useMemo, useState } from "react";

const W = 72;
const H = 26;
const MAX_DEPTH = 6;
const DIRS = {
  h: [-1, 0], j: [0, 1], k: [0, -1], l: [1, 0],
  y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
  ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1], ArrowRight: [1, 0],
};

const ITEM_NAMES = {
  "*": "金貨",
  ":": "食料",
  "!": "薬",
  "?": "巻物",
  ")": "武器",
  "]": "鎧",
  ",": "イェンダーの魔除け",
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function keyOf(x, y) {
  return `${x},${y}`;
}

function emptyTiles() {
  return Array.from({ length: H }, () => Array(W).fill(" "));
}

function rectsOverlap(a, b) {
  return !(a.x + a.w + 1 < b.x || b.x + b.w + 1 < a.x || a.y + a.h + 1 < b.y || b.y + b.h + 1 < a.y);
}

function carveRoom(tiles, room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (y === room.y || y === room.y + room.h - 1) tiles[y][x] = "-";
      else if (x === room.x || x === room.x + room.w - 1) tiles[y][x] = "|";
      else tiles[y][x] = ".";
    }
  }
}

function isRoomWall(ch) {
  return ch === "|" || ch === "-";
}

function carveCorridor(tiles, from, to) {
  let x = from.x;
  let y = from.y;
  while (x !== to.x) {
    x += Math.sign(to.x - x);
    tiles[y][x] = isRoomWall(tiles[y][x]) ? "+" : (tiles[y][x] === "." ? "." : "#");
  }
  while (y !== to.y) {
    y += Math.sign(to.y - y);
    tiles[y][x] = isRoomWall(tiles[y][x]) ? "+" : (tiles[y][x] === "." ? "." : "#");
  }
}

function isWalkableTile(ch) {
  return ch === "." || ch === "#" || ch === "+" || ch === "%" || ch === "^";
}

function randomFloorCell(tiles, occupied) {
  for (let tries = 0; tries < 1000; tries++) {
    const x = rand(1, W - 2);
    const y = rand(1, H - 2);
    if (tiles[y][x] === "." && !occupied.has(keyOf(x, y))) return { x, y };
  }
  return { x: 2, y: 2 };
}

function makeMonster(depth) {
  const options = [
    ["K", "Kestrel", 5, 2, 2],
    ["B", "Bat", 4, 2, 2],
    ["S", "Snake", 7, 3, 4],
    ["H", "Hobgoblin", 10, 4, 6],
    ["O", "Orc", 13, 5, 9],
    ["T", "Troll", 18, 6, 14],
  ];
  const pick = options[Math.min(options.length - 1, rand(0, Math.floor(depth * 1.2)))];
  return {
    glyph: pick[0],
    name: pick[1],
    hp: pick[2] + depth * 2,
    maxHp: pick[2] + depth * 2,
    atk: pick[3] + Math.floor(depth / 2),
    xp: pick[4] + depth * 2,
  };
}

function generateDungeon(depth, carryUp = false) {
  const tiles = emptyTiles();
  const rooms = [];
  for (let i = 0; i < 70 && rooms.length < 8; i++) {
    const room = { x: rand(2, W - 14), y: rand(2, H - 8), w: rand(8, 14), h: rand(5, 8) };
    if (room.x + room.w >= W - 1 || room.y + room.h >= H - 1) continue;
    if (rooms.every(r => !rectsOverlap(r, room))) {
      carveRoom(tiles, room);
      rooms.push({ ...room, cx: Math.floor(room.x + room.w / 2), cy: Math.floor(room.y + room.h / 2) });
    }
  }

  rooms.sort((a, b) => a.cx - b.cx);
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(tiles, rooms[i - 1], rooms[i]);
  }

  const occupied = new Set();
  const startRoom = carryUp ? rooms[rooms.length - 1] : rooms[0];
  const player = { x: startRoom.cx, y: startRoom.cy };
  occupied.add(keyOf(player.x, player.y));

  const down = randomFloorCell(tiles, occupied);
  tiles[down.y][down.x] = "%";
  occupied.add(keyOf(down.x, down.y));

  const up = randomFloorCell(tiles, occupied);
  tiles[up.y][up.x] = "%";
  occupied.add(keyOf(up.x, up.y));

  const items = {};
  const itemPool = ["*", "*", "*", ":", "!", "?", ")", "]"];
  const itemCount = rand(6, 9);
  for (let i = 0; i < itemCount; i++) {
    const pos = randomFloorCell(tiles, occupied);
    occupied.add(keyOf(pos.x, pos.y));
    items[keyOf(pos.x, pos.y)] = itemPool[rand(0, itemPool.length - 1)];
  }
  if (depth >= MAX_DEPTH) {
    const pos = randomFloorCell(tiles, occupied);
    occupied.add(keyOf(pos.x, pos.y));
    items[keyOf(pos.x, pos.y)] = ",";
  }

  for (let i = 0; i < rand(2, 3); i++) {
    const pos = randomFloorCell(tiles, occupied);
    occupied.add(keyOf(pos.x, pos.y));
    tiles[pos.y][pos.x] = "^";
  }

  const monsters = [];
  for (let i = 0; i < rand(4 + depth, 6 + depth); i++) {
    const pos = randomFloorCell(tiles, occupied);
    occupied.add(keyOf(pos.x, pos.y));
    monsters.push({ id: `${Date.now()}-${i}-${Math.random()}`, x: pos.x, y: pos.y, ...makeMonster(depth) });
  }

  return { tiles, rooms, player, up, down, items, monsters };
}

function initialGame() {
  const dungeon = generateDungeon(1);
  return {
    depth: 1,
    ...dungeon,
    hp: 24,
    maxHp: 24,
    level: 1,
    xp: 0,
    gold: 0,
    food: 3,
    potions: 1,
    scrolls: 0,
    weapon: 1,
    armor: 0,
    hasAmulet: false,
    turns: 0,
    status: "playing",
    showHelp: false,
    message: "運命の洞窟へ入った。イェンダーの魔除けを探せ。",
    log: ["h/j/k/l または矢印で移動。? でヘルプ。"],
  };
}

function addMessage(game, message) {
  return { ...game, message, log: [message, ...game.log].slice(0, 6) };
}

function monsterAt(game, x, y) {
  return game.monsters.find(m => m.x === x && m.y === y);
}

function gainXp(game, xp) {
  let next = { ...game, xp: game.xp + xp };
  const need = next.level * 14;
  if (next.xp >= need) {
    next.level += 1;
    next.xp -= need;
    next.maxHp += 5;
    next.hp = next.maxHp;
    next.message = `レベル ${next.level} に上がった。傷が癒えた。`;
    next.log = [next.message, ...next.log].slice(0, 6);
  }
  return next;
}

function attackMonster(game, monster) {
  const hit = rand(1, 20) + game.level >= 5;
  if (!hit) return addMessage(game, `${monster.name} に攻撃したが外れた。`);
  const damage = rand(1, 5) + game.weapon + Math.floor(game.level / 2);
  const monsters = game.monsters.map(m => m.id === monster.id ? { ...m, hp: m.hp - damage } : m);
  let next = { ...game, monsters };
  if (monster.hp - damage <= 0) {
    next.monsters = monsters.filter(m => m.id !== monster.id);
    next.gold += rand(2, 8) + game.depth;
    next = gainXp(next, monster.xp);
    return addMessage(next, `${monster.name} を倒した。`);
  }
  return addMessage(next, `${monster.name} に ${damage} ダメージ。`);
}

function pickup(game) {
  const at = keyOf(game.player.x, game.player.y);
  const item = game.items[at];
  if (!item) return game;
  const items = { ...game.items };
  delete items[at];
  let next = { ...game, items };
  if (item === "*") next.gold += rand(10, 40) * game.depth;
  if (item === ":") next.food += 1;
  if (item === "!") next.potions += 1;
  if (item === "?") next.scrolls += 1;
  if (item === ")") next.weapon += 1;
  if (item === "]") next.armor += 1;
  if (item === ",") next.hasAmulet = true;
  return addMessage(next, `${ITEM_NAMES[item]}を拾った。`);
}

function moveMonsters(game) {
  let next = { ...game, monsters: game.monsters.map(m => ({ ...m })) };
  const occupied = new Set(next.monsters.map(m => keyOf(m.x, m.y)));
  for (const m of next.monsters) {
    const dx = Math.sign(next.player.x - m.x);
    const dy = Math.sign(next.player.y - m.y);
    const dist = Math.max(Math.abs(next.player.x - m.x), Math.abs(next.player.y - m.y));
    if (dist <= 1) {
      const damage = Math.max(1, rand(1, m.atk) - next.armor);
      next.hp -= damage;
      next.log = [`${m.name} の攻撃。${damage} ダメージ。`, ...next.log].slice(0, 6);
      next.message = `${m.name} が迫っている。`;
      continue;
    }
    if (dist > 7 || Math.random() < 0.28) continue;
    const nx = m.x + dx;
    const ny = m.y + dy;
    const nk = keyOf(nx, ny);
    if (!occupied.has(nk) && isWalkableTile(next.tiles[ny]?.[nx]) && !next.items[nk]) {
      occupied.delete(keyOf(m.x, m.y));
      m.x = nx;
      m.y = ny;
      occupied.add(nk);
    }
  }
  if (next.hp <= 0) {
    next.status = "dead";
    next.message = "倒れた。金貨の9割が最終スコアになる。";
  }
  return next;
}

function descendOrAscend(game, goingDown) {
  const onStair = game.tiles[game.player.y][game.player.x] === "%";
  if (!onStair) return addMessage(game, "ここに階段はない。");
  if (!goingDown && game.depth === 1 && game.hasAmulet) {
    return addMessage({ ...game, status: "won" }, "魔除けを持ち帰った。戦士ギルドの試練に合格した。");
  }
  const depth = goingDown ? Math.min(MAX_DEPTH, game.depth + 1) : Math.max(1, game.depth - 1);
  if (depth === game.depth && goingDown) return addMessage(game, "洞窟はここで最深部のようだ。魔除けを探せ。");
  const dungeon = generateDungeon(depth, !goingDown);
  return addMessage({ ...game, depth, ...dungeon }, goingDown ? `地下${depth}階へ降りた。` : `地下${depth}階へ戻った。`);
}

function playerTurn(game, action) {
  if (game.status !== "playing") return game;
  let next = game;
  let consumesTurn = true;

  if (action.type === "move") {
    const [dx, dy] = action.dir;
    const x = game.player.x + dx;
    const y = game.player.y + dy;
    const monster = monsterAt(game, x, y);
    if (monster) {
      next = attackMonster(game, monster);
    } else if (isWalkableTile(game.tiles[y]?.[x])) {
      next = pickup(addMessage({ ...game, player: { x, y } }, "歩を進めた。"));
      if (next.tiles[y][x] === "^" && Math.random() < 0.55) {
        const damage = rand(3, 8);
        next = addMessage({ ...next, hp: next.hp - damage }, `罠が作動した。${damage} ダメージ。`);
      }
    } else {
      next = addMessage(game, "壁にぶつかった。");
      consumesTurn = false;
    }
  } else if (action.type === "stairs") {
    next = descendOrAscend(game, action.down);
  } else if (action.type === "wait") {
    next = addMessage(game, "耳を澄ませた。");
  } else if (action.type === "eat") {
    if (game.food <= 0) {
      next = addMessage(game, "食料を持っていない。");
      consumesTurn = false;
    } else {
      next = addMessage({ ...game, food: game.food - 1, hp: Math.min(game.maxHp, game.hp + 5) }, "食料を食べた。少し回復した。");
    }
  } else if (action.type === "potion") {
    if (game.potions <= 0) {
      next = addMessage(game, "薬を持っていない。");
      consumesTurn = false;
    } else {
      next = addMessage({ ...game, potions: game.potions - 1, hp: Math.min(game.maxHp, game.hp + rand(8, 14)) }, "薬を飲んだ。体が軽い。");
    }
  } else if (action.type === "scroll") {
    if (game.scrolls <= 0) {
      next = addMessage(game, "巻物を持っていない。");
      consumesTurn = false;
    } else {
      const hurt = game.monsters.map(m => Math.max(Math.abs(m.x - game.player.x), Math.abs(m.y - game.player.y)) <= 5 ? { ...m, hp: m.hp - 9 } : m);
      next = addMessage({ ...game, scrolls: game.scrolls - 1, monsters: hurt.filter(m => m.hp > 0) }, "巻物が光り、近くの敵を焼いた。");
    }
  } else if (action.type === "search") {
    next = addMessage(game, "周囲を探索した。");
  } else if (action.type === "quit") {
    return addMessage({ ...game, status: "quit" }, "探索を中断した。");
  }

  if (next.hp <= 0) return addMessage({ ...next, status: "dead" }, "倒れた。");
  if (!consumesTurn) return next;
  next = { ...next, turns: next.turns + 1 };
  return moveMonsters(next);
}

function visibleSet(game) {
  const seen = new Set();
  for (let y = game.player.y - 8; y <= game.player.y + 8; y++) {
    for (let x = game.player.x - 12; x <= game.player.x + 12; x++) {
      if (x >= 0 && y >= 0 && x < W && y < H) seen.add(keyOf(x, y));
    }
  }
  return seen;
}

function renderCell(game, x, y, visible) {
  if (!visible.has(keyOf(x, y))) return " ";
  if (game.player.x === x && game.player.y === y) return "@";
  const monster = monsterAt(game, x, y);
  if (monster) return monster.glyph;
  const item = game.items[keyOf(x, y)];
  if (item) return item;
  return game.tiles[y][x];
}

function Help({ onClose }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 style={styles.modalTitle}>Rogue 操作</h2>
        <div style={styles.helpGrid}>
          <span>移動</span><code>h j k l y u b n / 矢印</code>
          <span>階段</span><code>&lt; / &gt;</code>
          <span>待機・探索</span><code>. / s</code>
          <span>食べる</span><code>e</code>
          <span>薬・巻物</span><code>q / r</code>
          <span>中断</span><code>Q</code>
        </div>
        <p style={styles.helpText}>地下{MAX_DEPTH}階以降で「,」を拾い、地下1階の階段から地上へ戻ると勝利です。</p>
        <button type="button" style={styles.button} onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}

export default function Rogue() {
  const [game, setGame] = useState(initialGame);
  const visible = useMemo(() => visibleSet(game), [game]);
  const rows = useMemo(() => {
    return game.tiles.map((row, y) => row.map((_, x) => renderCell(game, x, y, visible)).join(""));
  }, [game, visible]);

  const dispatch = useCallback((action) => {
    setGame(current => playerTurn(current, action));
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "?") {
        e.preventDefault();
        setGame(current => ({ ...current, showHelp: !current.showHelp }));
        return;
      }
      if (e.key === "Escape") {
        setGame(current => ({ ...current, showHelp: false }));
        return;
      }
      if (game.showHelp) return;
      if (DIRS[e.key]) {
        e.preventDefault();
        dispatch({ type: "move", dir: DIRS[e.key] });
      } else if (e.key === ">") {
        e.preventDefault();
        dispatch({ type: "stairs", down: true });
      } else if (e.key === "<") {
        e.preventDefault();
        dispatch({ type: "stairs", down: false });
      } else if (e.key === ".") {
        e.preventDefault();
        dispatch({ type: "wait" });
      } else if (e.key === "e") {
        e.preventDefault();
        dispatch({ type: "eat" });
      } else if (e.key === "q") {
        e.preventDefault();
        dispatch({ type: "potion" });
      } else if (e.key === "r") {
        e.preventDefault();
        dispatch({ type: "scroll" });
      } else if (e.key === "s") {
        e.preventDefault();
        dispatch({ type: "search" });
      } else if (e.key === "Q") {
        e.preventDefault();
        dispatch({ type: "quit" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, game.showHelp]);

  const score = game.status === "dead" ? Math.floor(game.gold * 0.9) : game.gold;

  return (
    <main style={styles.page}>
      {game.showHelp && <Help onClose={() => setGame(current => ({ ...current, showHelp: false }))} />}
      <section style={styles.shell}>
        <div style={styles.top}>
          <div>
            <h1 style={styles.title}>Rogue</h1>
            <p style={styles.sub}>ASCII dungeon crawler</p>
          </div>
          <div style={styles.links}>
            <a style={styles.link} href="./index.html">一覧へ</a>
            <button type="button" style={styles.button} onClick={() => setGame(initialGame())}>新規</button>
            <button type="button" style={styles.button} onClick={() => setGame(current => ({ ...current, showHelp: true }))}>?</button>
          </div>
        </div>

        <div style={styles.terminal}>
          <div style={styles.message}>{game.message}</div>
          <pre style={styles.map} aria-label="dungeon map">{rows.join("\n")}</pre>
          <div style={styles.status}>
            <span>Depth:{game.depth}</span>
            <span>Gold:{game.gold}</span>
            <span>Hp:{Math.max(0, game.hp)}/{game.maxHp}</span>
            <span>Str:{game.weapon + game.level}</span>
            <span>Arm:{game.armor}</span>
            <span>Lv:{game.level}</span>
            <span>Food:{game.food}</span>
            <span>Turns:{game.turns}</span>
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.inventory}>
            <span>!</span> 薬 {game.potions}
            <span>?</span> 巻物 {game.scrolls}
            <span>,</span> 魔除け {game.hasAmulet ? "所持" : "未入手"}
          </div>
          <div style={styles.keys}>
            {["y", "k", "u", "h", ".", "l", "b", "j", "n"].map(key => (
              <button key={key} type="button" style={styles.key} onClick={() => key === "." ? dispatch({ type: "wait" }) : dispatch({ type: "move", dir: DIRS[key] })}>{key}</button>
            ))}
          </div>
          <div style={styles.actions}>
            <button type="button" style={styles.action} onClick={() => dispatch({ type: "stairs", down: false })}>&lt;</button>
            <button type="button" style={styles.action} onClick={() => dispatch({ type: "stairs", down: true })}>&gt;</button>
            <button type="button" style={styles.action} onClick={() => dispatch({ type: "eat" })}>e</button>
            <button type="button" style={styles.action} onClick={() => dispatch({ type: "potion" })}>q</button>
            <button type="button" style={styles.action} onClick={() => dispatch({ type: "scroll" })}>r</button>
          </div>
        </div>

        <ol style={styles.log}>
          {game.log.map((line, i) => <li key={`${line}-${i}`}>{line}</li>)}
        </ol>

        <section style={styles.keyGuide} aria-label="キー説明">
          <div style={styles.keyGuideTitle}>キー説明</div>
          <div style={styles.keyGuideGrid}>
            <span><kbd style={styles.kbd}>h</kbd><kbd style={styles.kbd}>j</kbd><kbd style={styles.kbd}>k</kbd><kbd style={styles.kbd}>l</kbd></span>
            <span>左右上下に移動</span>
            <span><kbd style={styles.kbd}>y</kbd><kbd style={styles.kbd}>u</kbd><kbd style={styles.kbd}>b</kbd><kbd style={styles.kbd}>n</kbd></span>
            <span>斜めに移動</span>
            <span><kbd style={styles.kbd}>←</kbd><kbd style={styles.kbd}>↓</kbd><kbd style={styles.kbd}>↑</kbd><kbd style={styles.kbd}>→</kbd></span>
            <span>上下左右に移動</span>
            <span><kbd style={styles.kbd}>.</kbd><kbd style={styles.kbd}>s</kbd></span>
            <span>待機 / 探索</span>
            <span><kbd style={styles.kbd}>&lt;</kbd><kbd style={styles.kbd}>&gt;</kbd></span>
            <span>階段を上る / 降りる</span>
            <span><kbd style={styles.kbd}>e</kbd><kbd style={styles.kbd}>q</kbd><kbd style={styles.kbd}>r</kbd></span>
            <span>食べる / 薬を飲む / 巻物を読む</span>
            <span><kbd style={styles.kbd}>?</kbd><kbd style={styles.kbd}>Q</kbd></span>
            <span>ヘルプ / 中断</span>
          </div>
        </section>

        {game.status !== "playing" && (
          <div style={styles.result}>
            <div style={styles.resultTitle}>{game.status === "won" ? "You escaped." : game.status === "quit" ? "Quit." : "You died."}</div>
            <div>Score: {score}</div>
            <button type="button" style={styles.resultButton} onClick={() => setGame(initialGame())}>もう一度</button>
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
    background: "#050505",
    color: "#d7f8c8",
    display: "flex",
    justifyContent: "center",
    padding: "22px 12px",
    fontFamily: mono,
  },
  shell: {
    width: "min(1120px, 100%)",
  },
  top: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  title: {
    margin: 0,
    fontSize: "1.6rem",
    letterSpacing: 0,
    color: "#f8ffe8",
  },
  sub: {
    margin: "2px 0 0",
    color: "#7ca46e",
    fontSize: "0.8rem",
  },
  links: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  link: {
    color: "#d7f8c8",
    textDecoration: "none",
    border: "1px solid #426b38",
    padding: "7px 10px",
    borderRadius: "4px",
    background: "#10200d",
    fontSize: "0.82rem",
  },
  button: {
    color: "#d7f8c8",
    border: "1px solid #426b38",
    padding: "7px 10px",
    borderRadius: "4px",
    background: "#10200d",
    fontFamily: mono,
    fontWeight: 700,
    cursor: "pointer",
  },
  terminal: {
    border: "1px solid #426b38",
    background: "#071006",
    boxShadow: "0 0 0 1px #0e210b inset",
    overflow: "auto",
  },
  message: {
    minHeight: "28px",
    color: "#f0ffd7",
    borderBottom: "1px solid #24481d",
    padding: "6px 10px",
    whiteSpace: "nowrap",
  },
  map: {
    margin: 0,
    padding: "10px",
    color: "#c3f9a7",
    lineHeight: 1.05,
    fontSize: "clamp(9px, 1.35vw, 16px)",
    letterSpacing: 0,
  },
  status: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    borderTop: "1px solid #24481d",
    padding: "7px 10px",
    color: "#f0ffd7",
    fontSize: "0.88rem",
  },
  panel: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: "12px",
    alignItems: "center",
    marginTop: "12px",
  },
  inventory: {
    border: "1px solid #24481d",
    padding: "10px",
    color: "#b9eaa8",
    minHeight: "44px",
  },
  keys: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 36px)",
    gap: "4px",
  },
  key: {
    width: "36px",
    height: "34px",
    borderRadius: "4px",
    border: "1px solid #426b38",
    background: "#10200d",
    color: "#d7f8c8",
    fontFamily: mono,
    fontWeight: 800,
    cursor: "pointer",
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 36px)",
    gap: "4px",
  },
  action: {
    width: "36px",
    height: "34px",
    borderRadius: "4px",
    border: "1px solid #426b38",
    background: "#10200d",
    color: "#d7f8c8",
    fontFamily: mono,
    fontWeight: 800,
    cursor: "pointer",
  },
  log: {
    margin: "12px 0 0",
    padding: "10px 10px 10px 32px",
    border: "1px solid #24481d",
    color: "#8fc780",
    fontSize: "0.82rem",
  },
  keyGuide: {
    marginTop: "12px",
    border: "1px solid #24481d",
    padding: "12px",
    color: "#b9eaa8",
    background: "#071006",
  },
  keyGuideTitle: {
    color: "#f0ffd7",
    fontWeight: 800,
    marginBottom: "10px",
  },
  keyGuideGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(130px, auto) 1fr minmax(130px, auto) 1fr",
    gap: "8px 12px",
    alignItems: "center",
    fontSize: "0.82rem",
  },
  kbd: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "24px",
    height: "24px",
    marginRight: "4px",
    border: "1px solid #426b38",
    borderRadius: "4px",
    background: "#10200d",
    color: "#f0ffd7",
    fontFamily: mono,
    fontSize: "0.78rem",
    fontWeight: 800,
  },
  result: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    zIndex: 20,
  },
  resultTitle: {
    color: "#f8ffe8",
    fontSize: "1.8rem",
    fontWeight: 800,
  },
  resultButton: {
    color: "#071006",
    border: "1px solid #d7f8c8",
    padding: "10px 18px",
    borderRadius: "4px",
    background: "#d7f8c8",
    fontFamily: mono,
    fontWeight: 800,
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    zIndex: 30,
  },
  modal: {
    width: "min(520px, 100%)",
    border: "1px solid #426b38",
    background: "#071006",
    color: "#d7f8c8",
    padding: "20px",
    borderRadius: "6px",
  },
  modalTitle: {
    margin: "0 0 14px",
    fontSize: "1.1rem",
  },
  helpGrid: {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: "8px",
    fontSize: "0.9rem",
  },
  helpText: {
    color: "#9ed18f",
    lineHeight: 1.6,
    margin: "16px 0",
  },
};
