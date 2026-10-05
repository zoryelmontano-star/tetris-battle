const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const COLS = 10, ROWS = 20, BLOCK = 30;
canvas.width = COLS * BLOCK;
canvas.height = ROWS * BLOCK;

const COLORS = {
  I: "#4dd7ff", J: "#5b6dff", L: "#ff9b43", O: "#ffd84d",
  S: "#5ee07d", T: "#b56cff", Z: "#ff5d70"
};

const SHAPES = {
  I: [[1,1,1,1]],
  J: [[1,0,0],[1,1,1]],
  L: [[0,0,1],[1,1,1]],
  O: [[1,1],[1,1]],
  S: [[0,1,1],[1,1,0]],
  T: [[0,1,0],[1,1,1]],
  Z: [[1,1,0],[0,1,1]]
};

let board = createBoard();
let current = null;
let dropCounter = 0;
let lastTime = 0;
let gameRunning = false;
let score = 0;
let combo = 0;
let timeLeft = 60;
let timerInterval = null;
let animationId = null;
let roomCode = "";
let deferredPrompt = null;

const $ = id => document.getElementById(id);
const lobby = $("lobby");
const game = $("game");
const overlay = $("overlay");
const roomStatus = $("roomStatus");
const installBtn = $("installBtn");

function createBoard() {
  return Array.from({length: ROWS}, () => Array(COLS).fill(""));
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random()*types.length)];
  const shape = SHAPES[type].map(row => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS/2) - Math.ceil(shape[0].length/2),
    y: 0
  };
}

function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.strokeRect(x*BLOCK+.5, y*BLOCK+.5, BLOCK-1, BLOCK-1);
  ctx.fillStyle = "rgba(255,255,255,.12)";
  ctx.fillRect(x*BLOCK+3, y*BLOCK+3, BLOCK-6, 4);
}

function draw() {
  ctx.fillStyle = "#080b10";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,.035)";
  for (let x=0;x<=COLS;x++) {
    ctx.beginPath(); ctx.moveTo(x*BLOCK,0); ctx.lineTo(x*BLOCK,canvas.height); ctx.stroke();
  }
  for (let y=0;y<=ROWS;y++) {
    ctx.beginPath(); ctx.moveTo(0,y*BLOCK); ctx.lineTo(canvas.width,y*BLOCK); ctx.stroke();
  }
  board.forEach((row,y) => row.forEach((cell,x) => {
    if (cell) drawCell(x,y,COLORS[cell]);
  }));
  if (current) {
    current.shape.forEach((row,py) => row.forEach((value,px) => {
      if (value) drawCell(current.x+px,current.y+py,COLORS[current.type]);
    }));
  }
}

function collide(piece, dx=0, dy=0, testShape=piece.shape) {
  for (let y=0;y<testShape.length;y++) {
    for (let x=0;x<testShape[y].length;x++) {
      if (!testShape[y][x]) continue;
      const nx = piece.x + x + dx;
      const ny = piece.y + y + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function merge() {
  current.shape.forEach((row,y) => row.forEach((value,x) => {
    if (value && current.y+y >= 0) board[current.y+y][current.x+x] = current.type;
  }));
}

function clearLines() {
  let lines = 0;
  outer: for (let y=ROWS-1;y>=0;y--) {
    for (let x=0;x<COLS;x++) if (!board[y][x]) continue outer;
    board.splice(y,1);
    board.unshift(Array(COLS).fill(""));
    lines++;
    y++;
  }
  if (lines > 0) {
    combo++;
    const base = [0,100,300,500,800][lines] || 1200;
    score += base + Math.max(0, combo-1)*50;
  } else {
    combo = 0;
  }
  updateHud();
}

function spawn() {
  current = randomPiece();
  if (collide(current)) endGame("Game Over");
}

function move(dir) {
  if (!gameRunning) return;
  if (!collide(current, dir, 0)) current.x += dir;
}

function softDrop() {
  if (!gameRunning) return;
  if (!collide(current,0,1)) {
    current.y++;
    score += 1;
  } else lockPiece();
  dropCounter = 0;
  updateHud();
}

function hardDrop() {
  if (!gameRunning) return;
  let distance = 0;
  while (!collide(current,0,1)) { current.y++; distance++; }
  score += distance*2;
  lockPiece();
  updateHud();
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
}

function rotate() {
  if (!gameRunning) return;
  const rotated = rotateMatrix(current.shape);
  const kicks = [0,-1,1,-2,2];
  for (const kick of kicks) {
    if (!collide(current,kick,0,rotated)) {
      current.x += kick;
      current.shape = rotated;
      return;
    }
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function updateHud() {
  $("score").textContent = score;
  $("combo").textContent = combo;
  $("timer").textContent = timeLeft;
}

function update(time=0) {
  if (!gameRunning) return;
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > 700) softDrop();
  draw();
  animationId = requestAnimationFrame(update);
}

function startGame() {
  cancelAnimationFrame(animationId);
  clearInterval(timerInterval);
  board = createBoard();
  current = null;
  score = 0;
  combo = 0;
  timeLeft = 60;
  gameRunning = true;
  $("playerState").textContent = "Playing";
  $("championBanner").classList.add("hidden");
  overlay.classList.add("hidden");
  updateHud();
  spawn();
  lastTime = performance.now();
  animationId = requestAnimationFrame(update);

  timerInterval = setInterval(() => {
    timeLeft--;
    updateHud();
    if (timeLeft <= 0) endGame("Time!");
  }, 1000);
}

function endGame(reason) {
  if (!gameRunning) return;
  gameRunning = false;
  clearInterval(timerInterval);
  cancelAnimationFrame(animationId);
  $("playerState").textContent = "Finished";

  const prevBest = Number(localStorage.getItem("tb_best") || 0);
  let wins = Number(localStorage.getItem("tb_wins") || 0);
  let isChampion = false;
  if (score > prevBest) {
    localStorage.setItem("tb_best", String(score));
    wins += 1;
    localStorage.setItem("tb_wins", String(wins));
    isChampion = true;
  }
  refreshRecord();

  $("overlayTitle").textContent = reason;
  $("overlayText").textContent = `Final score: ${score}`;
  overlay.classList.remove("hidden");
  if (isChampion) $("championBanner").classList.remove("hidden");
}

function refreshRecord() {
  $("bestScore").textContent = localStorage.getItem("tb_best") || "0";
  $("wins").textContent = localStorage.getItem("tb_wins") || "0";
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
}

function openGame(code) {
  roomCode = code.toUpperCase();
  $("roomCodeDisplay").textContent = roomCode;
  $("playerLabel").textContent = $("playerName").value.trim() || "Player 1";
  lobby.classList.add("hidden");
  game.classList.remove("hidden");
  $("overlayTitle").textContent = "Ready?";
  $("overlayText").textContent = "Tap Start Battle.";
  overlay.classList.remove("hidden");
  $("playerState").textContent = "Waiting";
  refreshRecord();
  draw();
}

$("createRoomBtn").addEventListener("click", () => {
  const code = generateCode();
  $("roomCode").value = code;
  roomStatus.textContent = `Room ${code} created. This offline build starts a local battle on this device.`;
  openGame(code);
});

$("joinRoomBtn").addEventListener("click", () => {
  const code = $("roomCode").value.trim().toUpperCase();
  if (code.length < 4) {
    roomStatus.textContent = "Enter a room code first.";
    return;
  }
  roomStatus.textContent = `Room ${code} selected. Real cross-device joining will be activated when we connect the free backend.`;
  openGame(code);
});

$("startBtn").addEventListener("click", startGame);

$("leaveBtn").addEventListener("click", () => {
  if (gameRunning) endGame("Battle ended");
  game.classList.add("hidden");
  lobby.classList.remove("hidden");
});

document.addEventListener("keydown", e => {
  if (!gameRunning) return;
  if (["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"," "].includes(e.key)) e.preventDefault();
  if (e.key === "ArrowLeft") move(-1);
  else if (e.key === "ArrowRight") move(1);
  else if (e.key === "ArrowDown") softDrop();
  else if (e.key === "ArrowUp") rotate();
  else if (e.key === " ") hardDrop();
});

document.querySelectorAll("[data-action]").forEach(btn => {
  btn.addEventListener("pointerdown", e => {
    e.preventDefault();
    const action = btn.dataset.action;
    if (action === "left") move(-1);
    if (action === "right") move(1);
    if (action === "down") softDrop();
    if (action === "rotate") rotate();
    if (action === "drop") hardDrop();
    draw();
  });
});

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove("hidden");
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add("hidden");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}

refreshRecord();
draw();
