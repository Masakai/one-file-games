import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/controls/OrbitControls.js";
import * as CANNON from "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js";

const GAME_TIME = 75;
const TARGET_DELIVERIES = 5;
const ROOM_HALF_W = 13;
const ROOM_HALF_D = 9;
const TRUCK_ZONE = {
  minX: 10.5,
  maxX: 15.6,
  minZ: -4.2,
  maxZ: 4.2,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4ead7);
scene.fog = new THREE.Fog(0xf4ead7, 24, 44);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(-10, 16, 18);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(2.5, 1.5, 0);
controls.enablePan = false;
controls.enableDamping = true;
controls.minDistance = 12;
controls.maxDistance = 34;
controls.maxPolarAngle = Math.PI * 0.46;
controls.enabled = false;

const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -18, 0),
  allowSleep: true,
});
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.35;
world.defaultContactMaterial.restitution = 0.08;

const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const deliveredEl = document.getElementById("delivered");
const messageEl = document.getElementById("message");
const goalFillEl = document.getElementById("goal-fill");
const bannerEl = document.getElementById("banner");
const bannerTitleEl = document.getElementById("banner-title");
const bannerTextEl = document.getElementById("banner-text");

const keys = new Set();
let score = 0;
let deliveredCount = 0;
let gameTimeLeft = GAME_TIME;
let gameOver = false;
let cameraMode = "follow";
let activeBannerTimer = null;
let player;
let playerMesh;
let lastTimestamp = 0;

const actors = [];
const debrisActors = [];

const palette = {
  wall: 0xc4b39f,
  floor: 0xebe3d4,
  truck: 0x0f766e,
  target: 0x34d399,
  player: 0x7c2d12,
};

function setBanner(title, text, persist = false) {
  bannerTitleEl.textContent = title;
  bannerTextEl.textContent = text;
  bannerEl.classList.add("show");
  if (activeBannerTimer) {
    clearTimeout(activeBannerTimer);
    activeBannerTimer = null;
  }
  if (!persist) {
    activeBannerTimer = window.setTimeout(() => {
      bannerEl.classList.remove("show");
    }, 1800);
  }
}

function clearBanner() {
  bannerEl.classList.remove("show");
  if (activeBannerTimer) {
    clearTimeout(activeBannerTimer);
    activeBannerTimer = null;
  }
}

function updateHud() {
  scoreEl.textContent = String(score);
  timeEl.textContent = gameTimeLeft.toFixed(1);
  deliveredEl.textContent = `${deliveredCount} / 7`;
  goalFillEl.style.width = `${Math.min(deliveredCount / TARGET_DELIVERIES, 1) * 100}%`;
  if (!gameOver) {
    messageEl.textContent = deliveredCount >= TARGET_DELIVERIES
      ? "ノルマ達成。残り時間は追加スコア稼ぎ。"
      : `あと ${Math.max(TARGET_DELIVERIES - deliveredCount, 0)} 個でクリア。`;
  }
}

function makeLights() {
  const hemi = new THREE.HemisphereLight(0xfff4d6, 0xb08968, 1.15);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2cc, 1.7);
  sun.position.set(12, 24, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  scene.add(sun);
}

function addStaticBox({ position, size, color }) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 2, size.y * 2, size.z * 2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.02 }),
  );
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const shape = new CANNON.Box(new CANNON.Vec3(size.x, size.y, size.z));
  const body = new CANNON.Body({ mass: 0, shape, position: new CANNON.Vec3(position.x, position.y, position.z) });
  world.addBody(body);
}

function addFloor() {
  const floorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(34, 1, 22),
    new THREE.MeshStandardMaterial({ color: palette.floor, roughness: 1 }),
  );
  floorMesh.position.set(1.5, -0.5, 0);
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  const floorBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(17, 0.5, 11)),
    position: new CANNON.Vec3(1.5, -0.5, 0),
  });
  world.addBody(floorBody);
}

function addRoom() {
  addFloor();
  addStaticBox({ position: new THREE.Vector3(-13.5, 2.5, 0), size: new THREE.Vector3(0.5, 2.5, 10), color: palette.wall });
  addStaticBox({ position: new THREE.Vector3(0, 2.5, -10.5), size: new THREE.Vector3(14, 2.5, 0.5), color: palette.wall });
  addStaticBox({ position: new THREE.Vector3(0, 2.5, 10.5), size: new THREE.Vector3(14, 2.5, 0.5), color: palette.wall });
  addStaticBox({ position: new THREE.Vector3(4.5, 2.5, -10.5), size: new THREE.Vector3(9, 2.5, 0.5), color: palette.wall });
  addStaticBox({ position: new THREE.Vector3(4.5, 2.5, 10.5), size: new THREE.Vector3(9, 2.5, 0.5), color: palette.wall });
  addStaticBox({ position: new THREE.Vector3(8.3, 2.5, -6.4), size: new THREE.Vector3(0.5, 2.5, 3.6), color: palette.wall });
  addStaticBox({ position: new THREE.Vector3(8.3, 2.5, 6.4), size: new THREE.Vector3(0.5, 2.5, 3.6), color: palette.wall });

  const truckBase = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 0.7, 10),
    new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.95 }),
  );
  truckBase.position.set(13.3, 0.15, 0);
  truckBase.receiveShadow = true;
  scene.add(truckBase);

  const targetPad = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.05, 8.2),
    new THREE.MeshStandardMaterial({ color: palette.target, transparent: true, opacity: 0.45 }),
  );
  targetPad.position.set((TRUCK_ZONE.minX + TRUCK_ZONE.maxX) / 2, 0.08, 0);
  targetPad.receiveShadow = true;
  scene.add(targetPad);

  addStaticBox({ position: new THREE.Vector3(13.3, 1.0, -4.7), size: new THREE.Vector3(3.2, 1.0, 0.3), color: palette.truck });
  addStaticBox({ position: new THREE.Vector3(13.3, 1.0, 4.7), size: new THREE.Vector3(3.2, 1.0, 0.3), color: palette.truck });
  addStaticBox({ position: new THREE.Vector3(16.25, 1.0, 0), size: new THREE.Vector3(0.3, 1.0, 5), color: palette.truck });

  const arrowGroup = new THREE.Group();
  const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0xea580c, emissive: 0x7c2d12 });
  for (let i = 0; i < 3; i += 1) {
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 4), arrowMaterial);
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(8.9 + i * 1.1, 0.55, 0);
    arrow.castShadow = true;
    arrowGroup.add(arrow);
  }
  scene.add(arrowGroup);
}

function createPlayer() {
  const radius = 0.8;
  playerMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 28, 28),
    new THREE.MeshStandardMaterial({ color: palette.player, roughness: 0.5, metalness: 0.1 }),
  );
  playerMesh.castShadow = true;
  playerMesh.receiveShadow = true;
  scene.add(playerMesh);

  player = new CANNON.Body({
    mass: 5,
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(-8, 1.2, 0),
    linearDamping: 0.24,
    angularDamping: 0.38,
  });
  world.addBody(player);
}

function makeFurnitureMesh(kind, size, color) {
  if (kind === "cylinder") {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(size.x * 0.9, size.x, size.y, 18),
      new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02 }),
    );
  }

  return new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 2, size.y * 2, size.z * 2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02 }),
  );
}

function createActor(definition) {
  const size = definition.size;
  const mesh = makeFurnitureMesh(definition.kind, size, definition.color);
  mesh.position.set(definition.position.x, definition.position.y, definition.position.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const shape = definition.kind === "cylinder"
    ? new CANNON.Cylinder(size.x, size.x * 0.9, size.y * 2, 18)
    : new CANNON.Box(new CANNON.Vec3(size.x, size.y, size.z));

  const body = new CANNON.Body({
    mass: definition.mass,
    shape,
    position: new CANNON.Vec3(definition.position.x, definition.position.y, definition.position.z),
    angularDamping: 0.4,
    linearDamping: 0.1,
    sleepTimeLimit: 0.6,
  });

  if (definition.kind === "cylinder") {
    const q = new CANNON.Quaternion();
    q.setFromEuler(Math.PI / 2, 0, 0);
    body.quaternion.copy(q);
  }

  body.velocity.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.4);
  world.addBody(body);

  const actor = {
    id: crypto.randomUUID(),
    name: definition.name,
    mesh,
    body,
    baseColor: new THREE.Color(definition.color),
    hp: definition.hp,
    delivered: false,
    isDebris: false,
  };

  body.addEventListener("collide", (event) => {
    if (actor.delivered || actor.isDebris || gameOver) return;
    const impact = Math.abs(event.contact.getImpactVelocityAlongNormal());
    if (impact < 3.2) return;
    damageActor(actor, impact * 7.5);
  });

  actors.push(actor);
  return actor;
}

function damageActor(actor, amount) {
  actor.hp -= amount;
  const ratio = Math.max(actor.hp / 100, 0);
  actor.mesh.material.color.copy(actor.baseColor).lerp(new THREE.Color(0x3f1d0d), 1 - ratio);

  if (actor.hp > 0) {
    return;
  }

  breakActor(actor);
}

function removeActor(actor, collection = actors) {
  const index = collection.indexOf(actor);
  if (index >= 0) {
    collection.splice(index, 1);
  }
  world.removeBody(actor.body);
  scene.remove(actor.mesh);
}

function breakActor(actor) {
  if (actor.delivered) return;

  setBanner("家具が粉砕", `${actor.name} が四散。小口配送で回収し直しです。`);
  removeActor(actor);

  const fragmentSize = new THREE.Vector3(0.38, 0.34, 0.38);
  for (let i = 0; i < 4; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(fragmentSize.x * 2, fragmentSize.y * 2, fragmentSize.z * 2),
      new THREE.MeshStandardMaterial({
        color: actor.baseColor.clone().offsetHSL(0, 0, -0.08 + i * 0.02),
        roughness: 0.9,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const body = new CANNON.Body({
      mass: 0.75,
      shape: new CANNON.Box(new CANNON.Vec3(fragmentSize.x, fragmentSize.y, fragmentSize.z)),
      position: actor.body.position.vadd(new CANNON.Vec3((Math.random() - 0.5) * 0.8, 0.4 + i * 0.1, (Math.random() - 0.5) * 0.8)),
      angularDamping: 0.3,
      linearDamping: 0.06,
    });
    body.velocity.set((Math.random() - 0.5) * 8, 3 + Math.random() * 2, (Math.random() - 0.5) * 8);
    world.addBody(body);

    debrisActors.push({
      id: crypto.randomUUID(),
      name: `${actor.name}の破片`,
      mesh,
      body,
      delivered: false,
      isDebris: true,
      scoreValue: 25,
    });
  }
}

function populateFurniture() {
  const furniture = [
    { name: "ソファ", kind: "box", size: new THREE.Vector3(1.5, 0.75, 0.85), color: 0x92400e, position: new THREE.Vector3(-2.5, 0.8, -4.2), mass: 4.5, hp: 100 },
    { name: "冷蔵庫", kind: "box", size: new THREE.Vector3(0.7, 1.5, 0.7), color: 0xe5e7eb, position: new THREE.Vector3(-0.4, 1.55, 1.5), mass: 5.4, hp: 100 },
    { name: "本棚", kind: "box", size: new THREE.Vector3(0.7, 1.7, 0.45), color: 0x7c3f00, position: new THREE.Vector3(2.8, 1.75, -1.6), mass: 4.4, hp: 100 },
    { name: "テレビ台", kind: "box", size: new THREE.Vector3(1.1, 0.55, 0.6), color: 0x57534e, position: new THREE.Vector3(-4.6, 0.58, 3.8), mass: 3.2, hp: 100 },
    { name: "植木鉢", kind: "cylinder", size: new THREE.Vector3(0.45, 0.8, 0.45), color: 0x0f766e, position: new THREE.Vector3(4.6, 0.84, 3.6), mass: 2.1, hp: 100 },
    { name: "テーブル", kind: "box", size: new THREE.Vector3(1.1, 0.5, 1.1), color: 0xb45309, position: new THREE.Vector3(0.5, 0.55, -0.3), mass: 3.9, hp: 100 },
    { name: "段ボール山", kind: "box", size: new THREE.Vector3(0.95, 0.7, 0.7), color: 0xd97706, position: new THREE.Vector3(4.9, 0.75, -4.8), mass: 2.7, hp: 100 },
  ];

  furniture.forEach(createActor);
}

function resetDynamicActors() {
  for (const actor of [...actors]) {
    removeActor(actor);
  }
  for (const debris of [...debrisActors]) {
    removeActor(debris, debrisActors);
  }
  populateFurniture();
}

function scoreDelivery(actor, intact) {
  if (actor.delivered) return;
  actor.delivered = true;
  deliveredCount += 1;
  score += intact ? 120 : actor.scoreValue;
  setBanner(
    intact ? "積み込み成功" : "破片を回収",
    intact ? `${actor.name} を無事に荷台へ積み込み。` : `${actor.name} を荷台へ回収。`,
  );
  removeActor(actor, actor.isDebris ? debrisActors : actors);
  updateHud();
}

function inTruckZone(body) {
  const { x, z, y } = body.position;
  return x > TRUCK_ZONE.minX && x < TRUCK_ZONE.maxX && z > TRUCK_ZONE.minZ && z < TRUCK_ZONE.maxZ && y < 2.8;
}

function syncMeshes() {
  actors.forEach((actor) => {
    actor.mesh.position.copy(actor.body.position);
    actor.mesh.quaternion.copy(actor.body.quaternion);
    if (!actor.delivered && inTruckZone(actor.body) && actor.body.velocity.lengthSquared() < 6) {
      scoreDelivery(actor, true);
    }
  });

  debrisActors.forEach((actor) => {
    actor.mesh.position.copy(actor.body.position);
    actor.mesh.quaternion.copy(actor.body.quaternion);
    if (!actor.delivered && inTruckZone(actor.body) && actor.body.velocity.lengthSquared() < 8) {
      scoreDelivery(actor, false);
    }
  });

  playerMesh.position.copy(player.position);
  playerMesh.quaternion.copy(player.quaternion);
}

function handlePlayerInput(delta) {
  const move = new CANNON.Vec3(0, 0, 0);
  if (keys.has("w") || keys.has("arrowup")) move.z -= 1;
  if (keys.has("s") || keys.has("arrowdown")) move.z += 1;
  if (keys.has("a") || keys.has("arrowleft")) move.x -= 1;
  if (keys.has("d") || keys.has("arrowright")) move.x += 1;

  if (move.lengthSquared() === 0) return;

  move.normalize();
  const boost = keys.has("shift") ? 24 : 16;
  player.applyForce(new CANNON.Vec3(move.x * boost, 0, move.z * boost), player.position);

  const forward = new THREE.Vector3(move.x, 0, move.z).normalize();
  const facing = Math.atan2(forward.x, forward.z);
  playerMesh.rotation.y = facing;

  const cappedSpeed = keys.has("shift") ? 11.5 : 8.5;
  const speedSq = player.velocity.lengthSquared();
  if (speedSq > cappedSpeed * cappedSpeed) {
    player.velocity.scale(cappedSpeed / Math.sqrt(speedSq), player.velocity);
  }

  player.applyForce(new CANNON.Vec3(-player.velocity.x * 0.28 * delta, 0, -player.velocity.z * 0.28 * delta), player.position);
}

function updateCamera() {
  if (cameraMode === "overview") {
    camera.position.lerp(new THREE.Vector3(6, 25, 0), 0.08);
    controls.target.lerp(new THREE.Vector3(3, 0, 0), 0.08);
  } else {
    const desired = new THREE.Vector3(player.position.x - 8.5, 13, player.position.z + 10.5);
    camera.position.lerp(desired, 0.08);
    controls.target.lerp(new THREE.Vector3(player.position.x + 3.5, 1, player.position.z), 0.12);
  }
  camera.lookAt(controls.target);
}

function restartGame() {
  score = 0;
  deliveredCount = 0;
  gameTimeLeft = GAME_TIME;
  gameOver = false;
  player.position.set(-8, 1.2, 0);
  player.velocity.setZero();
  player.angularVelocity.setZero();
  player.quaternion.set(0, 0, 0, 1);
  resetDynamicActors();
  clearBanner();
  updateHud();
}

function endGame() {
  gameOver = true;
  player.velocity.setZero();
  player.angularVelocity.setZero();

  if (deliveredCount >= TARGET_DELIVERIES) {
    const bonus = Math.round(gameTimeLeft * 8);
    score += bonus;
    updateHud();
    messageEl.textContent = `クリア。残り時間ボーナス +${bonus}`;
    setBanner("引っ越し成功", `ノルマ達成。最終スコア ${score} 点。`, true);
  } else {
    messageEl.textContent = "時間切れ。家具が部屋に散乱したままです。";
    setBanner("時間切れ", `配送 ${deliveredCount} 個。あと ${TARGET_DELIVERIES - deliveredCount} 個必要でした。`, true);
  }
}

function animate(timestamp) {
  const delta = Math.min((timestamp - lastTimestamp) / 1000 || 0.016, 0.033);
  lastTimestamp = timestamp;

  if (!gameOver) {
    gameTimeLeft = Math.max(gameTimeLeft - delta, 0);
    if (gameTimeLeft === 0) {
      endGame();
    } else {
      handlePlayerInput(delta);
    }
  }

  world.step(1 / 60, delta, 3);
  syncMeshes();
  updateCamera();
  controls.update();
  renderer.render(scene, camera);

  if (!gameOver) {
    updateHud();
  }

  requestAnimationFrame(animate);
}

function toggleCamera() {
  cameraMode = cameraMode === "follow" ? "overview" : "follow";
  messageEl.textContent = cameraMode === "follow" ? "追従カメラ" : "俯瞰カメラ";
}

function makeDecor() {
  const rug = new THREE.Mesh(
    new THREE.BoxGeometry(8.5, 0.06, 5.5),
    new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.95 }),
  );
  rug.position.set(-1.6, 0.03, 0);
  rug.receiveShadow = true;
  scene.add(rug);

  for (let i = 0; i < 5; i += 1) {
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 4.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x9a3412, metalness: 0.3, roughness: 0.4 }),
    );
    lamp.position.set(-10.5 + i * 5.7, 2.4, -8.8);
    lamp.castShadow = true;
    scene.add(lamp);
  }
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }
  if (key === "r") restartGame();
  if (key === "c") toggleCamera();
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById("restart-button").addEventListener("click", restartGame);
document.getElementById("camera-button").addEventListener("click", toggleCamera);

makeLights();
addRoom();
makeDecor();
createPlayer();
populateFurniture();
updateHud();
setBanner("引っ越し開始", "右側の荷台へ 5 個以上押し込め。壊すと破片になって得点効率は落ちます。");
requestAnimationFrame(animate);
