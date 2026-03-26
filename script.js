const GRID = 8;
const LEVEL_MIN = 0;
const LEVEL_MAX = 9;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const levelEl = document.getElementById("level");
const movesEl = document.getElementById("moves");
const scoreEl = document.getElementById("score");
const messageEl = document.getElementById("message");

const state = {
  heights: [],
  cursor: { x: 0, y: 0 },
  hero: { x: 0, y: 0, handAngle: -0.1 },
  worker: {
    active: false,
    progress: 0,
    fromLeft: true,
    target: { x: 0, y: 0 }
  },
  moves: 0,
  score: 200,
  level: 1,
  animT: 0,
  lastActionAt: 0,
  freezeInput: false
};

function createValidTerrain() {
  const heights = Array.from({ length: GRID }, () => Array(GRID).fill(0));
  heights[0][0] = randInt(2, 5);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (x === 0 && y === 0) continue;
      const options = [];
      if (x > 0) {
        const left = heights[y][x - 1];
        options.push(left - 1, left + 1);
      }
      if (y > 0) {
        const up = heights[y - 1][x];
        options.push(up - 1, up + 1);
      }
      const valid = [...new Set(options)].filter(v => v >= LEVEL_MIN && v <= LEVEL_MAX);
      heights[y][x] = valid.length ? valid[randInt(0, valid.length - 1)] : randInt(LEVEL_MIN, LEVEL_MAX);

      if (x > 0 && Math.abs(heights[y][x] - heights[y][x - 1]) !== 1) {
        heights[y][x] = clamp(
          heights[y][x - 1] + (Math.random() > 0.5 ? 1 : -1),
          LEVEL_MIN,
          LEVEL_MAX
        );
      }
      if (y > 0 && Math.abs(heights[y][x] - heights[y - 1][x]) !== 1) {
        heights[y][x] = clamp(
          heights[y - 1][x] + (Math.random() > 0.5 ? 1 : -1),
          LEVEL_MIN,
          LEVEL_MAX
        );
      }
    }
  }

  if (isFlat(heights)) {
    heights[GRID - 1][GRID - 1] = clamp(heights[GRID - 1][GRID - 2] + 1, LEVEL_MIN, LEVEL_MAX);
  }

  return heights;
}

function resetLevel() {
  state.heights = createValidTerrain();
  state.cursor = { x: 0, y: 0 };
  state.hero = { x: 0, y: 0, handAngle: -0.1 };
  state.moves = 0;
  state.score = 200;
  state.worker.active = false;
  state.freezeInput = false;
  updateHud();
}

function updateHud() {
  levelEl.textContent = String(state.level);
  movesEl.textContent = String(state.moves);
  scoreEl.textContent = String(state.score);
}

function isoPoint(x, y, h = 0) {
  const originX = canvas.width / 2;
  const originY = 170;
  const tileW = 64;
  const tileH = 30;
  const lift = 18;

  return {
    x: originX + (x - y) * (tileW / 2),
    y: originY + (x + y) * (tileH / 2) - h * lift
  };
}

function drawGround() {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const h = state.heights[y][x];
      const p = isoPoint(x, y, h);

      const right = isoPoint(x + 1, y, h);
      const down = isoPoint(x, y + 1, h);
      const diag = isoPoint(x + 1, y + 1, h);

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(diag.x, diag.y);
      ctx.lineTo(down.x, down.y);
      ctx.closePath();

      const colorIdx = (h * 9 + (x + y) * 3) % 4;
      const palette = ["#2f6f2f", "#3f7c35", "#4b8a3d", "#286128"];
      ctx.fillStyle = palette[colorIdx];
      ctx.fill();
      ctx.strokeStyle = "#133713";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#9af79a";
      ctx.font = "10px 'Courier New'";
      ctx.fillText(String(h), p.x - 4, p.y - 5);
    }
  }
}

function drawGridNodes() {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const h = state.heights[y][x];
      const p = isoPoint(x, y, h);

      ctx.fillStyle = "#d2ffb8";
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
  }
}

function drawCursor() {
  const { x, y } = state.cursor;
  const h = state.heights[y][x];
  const p = isoPoint(x, y, h);

  ctx.strokeStyle = "#ffd95d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHero() {
  const hx = state.hero.x;
  const hy = state.hero.y;
  const h = state.heights[hy][hx];
  const p = isoPoint(hx, hy, h);

  const bob = Math.sin(state.animT * 5) * 2;
  const baseX = p.x + 18;
  const baseY = p.y - 22 + bob;

  ctx.fillStyle = "#fbe5c5";
  ctx.fillRect(baseX - 4, baseY - 16, 8, 8);

  ctx.fillStyle = "#67a9ff";
  ctx.fillRect(baseX - 4, baseY - 8, 8, 12);

  ctx.strokeStyle = "#fbe5c5";
  ctx.lineWidth = 2;
  const target = isoPoint(state.cursor.x, state.cursor.y, state.heights[state.cursor.y][state.cursor.x]);
  const dx = target.x - baseX;
  const dy = target.y - (baseY - 2);
  const len = Math.max(1, Math.hypot(dx, dy));
  const armX = baseX + (dx / len) * 16;
  const armY = (baseY - 2) + (dy / len) * 16;

  ctx.beginPath();
  ctx.moveTo(baseX, baseY - 2);
  ctx.lineTo(armX, armY);
  ctx.stroke();

  ctx.strokeStyle = "#2d72bf";
  ctx.beginPath();
  ctx.moveTo(baseX - 2, baseY + 4);
  ctx.lineTo(baseX - 6, baseY + 13);
  ctx.moveTo(baseX + 2, baseY + 4);
  ctx.lineTo(baseX + 6, baseY + 13);
  ctx.stroke();
}

function drawWheelbarrowWorker() {
  if (!state.worker.active) return;

  const targetP = isoPoint(state.worker.target.x, state.worker.target.y, state.heights[state.worker.target.y][state.worker.target.x]);
  const startX = state.worker.fromLeft ? -80 : canvas.width + 80;
  const endX = targetP.x - 45;
  const x = lerp(startX, endX, state.worker.progress);
  const y = targetP.y - 20;

  ctx.fillStyle = "#f8d7ae";
  ctx.fillRect(x - 4, y - 24, 8, 8);
  ctx.fillStyle = "#d66e5a";
  ctx.fillRect(x - 4, y - 16, 8, 14);

  ctx.strokeStyle = "#f8d7ae";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 3, y - 7);
  ctx.lineTo(x + 16, y - 12);
  ctx.stroke();

  ctx.fillStyle = "#8a5932";
  ctx.fillRect(x + 14, y - 17, 22, 12);

  ctx.strokeStyle = "#d8a26e";
  ctx.beginPath();
  ctx.arc(x + 38, y - 4, 5, 0, Math.PI * 2);
  ctx.stroke();

  if (state.worker.progress > 0.78 && state.worker.progress < 0.95) {
    ctx.fillStyle = "#6b4328";
    const spill = (state.worker.progress - 0.78) * 40;
    ctx.beginPath();
    ctx.moveTo(targetP.x + 2, targetP.y - 8);
    ctx.lineTo(targetP.x - 8, targetP.y + spill * 0.6);
    ctx.lineTo(targetP.x + 10, targetP.y + spill);
    ctx.closePath();
    ctx.fill();
  }
}

function drawScanlines() {
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = "#c6dfff";
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, "#3856ac");
  grd.addColorStop(1, "#101e57");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGround();
  drawGridNodes();
  drawCursor();
  drawHero();
  drawWheelbarrowWorker();
  drawScanlines();
}

function isFlat(heights = state.heights) {
  const first = heights[0][0];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (heights[y][x] !== first) return false;
    }
  }
  return true;
}

function startDumpAction(x, y) {
  if (state.freezeInput) return;
  state.moves += 1;
  state.score = Math.max(0, state.score - 3);
  state.freezeInput = true;
  state.worker.active = true;
  state.worker.progress = 0;
  state.worker.fromLeft = Math.random() > 0.5;
  state.worker.target = { x, y };
  state.lastActionAt = performance.now();

  messageEl.textContent = "Panáček označil uzel. Přijíždí dělník s kolečkem...";
  updateHud();
}

function finishDumpAction() {
  const { x, y } = state.worker.target;
  state.heights[y][x] = clamp(state.heights[y][x] + 1, LEVEL_MIN, LEVEL_MAX);
  state.worker.active = false;
  state.freezeInput = false;

  if (isFlat()) {
    const bonus = Math.max(0, 320 - state.moves * 5);
    state.score += bonus;
    updateHud();
    messageEl.textContent = `Hotovo! Terén je rovný. Bonus ${bonus} bodů. Stiskni R pro novou mapu.`;
  } else {
    messageEl.textContent = "Hlína vysypána. Pokračuj ve srovnávání.";
  }
}

function moveCursor(dx, dy) {
  if (state.freezeInput) return;
  state.cursor.x = clamp(state.cursor.x + dx, 0, GRID - 1);
  state.cursor.y = clamp(state.cursor.y + dy, 0, GRID - 1);
  state.hero.x = state.cursor.x;
  state.hero.y = state.cursor.y;
}

function animate(now) {
  state.animT = now / 1000;

  if (state.worker.active) {
    state.worker.progress += 0.018;
    if (state.worker.progress >= 1) {
      finishDumpAction();
    }
  }

  render();
  requestAnimationFrame(animate);
}

function pickNodeFromClick(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (canvas.width / rect.width);
  const y = (clientY - rect.top) * (canvas.height / rect.height);

  let best = null;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const p = isoPoint(gx, gy, state.heights[gy][gx]);
      const d = Math.hypot(x - p.x, y - p.y);
      if (!best || d < best.d) best = { x: gx, y: gy, d };
    }
  }

  if (best) {
    state.cursor.x = best.x;
    state.cursor.y = best.y;
    state.hero.x = best.x;
    state.hero.y = best.y;
    startDumpAction(best.x, best.y);
  }
}

window.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowUp":
    case "w":
    case "W":
      moveCursor(0, -1);
      break;
    case "ArrowDown":
    case "s":
    case "S":
      moveCursor(0, 1);
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      moveCursor(-1, 0);
      break;
    case "ArrowRight":
    case "d":
    case "D":
      moveCursor(1, 0);
      break;
    case " ":
    case "Enter":
      startDumpAction(state.cursor.x, state.cursor.y);
      break;
    case "r":
    case "R":
      resetLevel();
      messageEl.textContent = "Nová mapa. Srovnej terén do roviny.";
      break;
    default:
      break;
  }
});

canvas.addEventListener("click", (e) => {
  pickNodeFromClick(e.clientX, e.clientY);
});

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

resetLevel();
requestAnimationFrame(animate);
