// --- Game Logic ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Polyfill roundRect for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r = 0) {
    const rr = typeof r === 'number' ? { tl: r, tr: r, br: r, bl: r } : Object.assign({ tl: 0, tr: 0, br: 0, bl: 0 }, r);
    this.beginPath();
    this.moveTo(x + rr.tl, y);
    this.lineTo(x + w - rr.tr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + rr.tr);
    this.lineTo(x + w, y + h - rr.br);
    this.quadraticCurveTo(x + w, y + h, x + w - rr.br, y + h);
    this.lineTo(x + rr.bl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - rr.bl);
    this.lineTo(x, y + rr.tl);
    this.quadraticCurveTo(x, y, x + rr.tl, y);
    return this;
  }
}

const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const messageEl = document.getElementById('message');
const gameOverModal = document.getElementById('gameOverModal');
const modalTitle = document.getElementById('modalTitle');
const modalScore = document.getElementById('modalScore');
const retryButton = document.getElementById('retryButton');
const levelCompleteBanner = document.getElementById('levelCompleteBanner');

let score = 0, lives = 3, level = 1;
let isGameRunning = false, animationFrameId = null;
let totalBricks = 0, remainingBricks = 0;

const baseWidth = 800, baseHeight = 600;
let scaleFactor = 1;

const ball = { x: 0, y: 0, dx: 0, dy: 0, radius: 10 };
const paddle = { x: 0, height: 15, width: 120 };
const brickConfig = { width: 65, height: 20, padding: 10, offsetTop: 50, offsetLeft: 40 };
let bricks = [];

function resizeCanvas() {
  const container = document.getElementById('canvas-container');
  let newWidth = container.clientWidth;

  // Mobile: taller/narrower
  if (window.innerWidth < 768) {
    newWidth = Math.min(newWidth, 420);
    const newHeight = Math.min(Math.round(newWidth * 1.8), Math.round(window.innerHeight * 0.86));
    canvas.width = newWidth; canvas.height = newHeight;
    canvas.style.width = newWidth + 'px';
    canvas.style.height = newHeight + 'px';
  } else {
    // Desktop: near 4:3
    const newHeight = Math.round(newWidth * (baseHeight / baseWidth));
    canvas.width = newWidth; canvas.height = newHeight;
    canvas.style.width = newWidth + 'px';
    canvas.style.height = newHeight + 'px';
  }

  // Scale by width (clamp)
  scaleFactor = Math.max(0.6, newWidth / baseWidth);
  ball.radius = Math.max(6, 10 * scaleFactor);
  paddle.width = Math.max(80, 120 * scaleFactor);
  paddle.height = Math.max(10, 15 * scaleFactor);
}

function generateLevelConfig(currentLevel) {
  return {
    rowCount: 4 + currentLevel,
    columnCount: 6 + currentLevel,
    // MODIFIED: Increased the multiplier from 0.5 to 0.8 for a faster speed increase per level
    speed: (2.5 + currentLevel * 0.8) * scaleFactor,
    scorePerBrick: 10 * currentLevel
  };
}

function initBricks() {
  const cfg = generateLevelConfig(level);
  bricks = [];
  totalBricks = cfg.rowCount * cfg.columnCount;
  remainingBricks = totalBricks;
  for (let c = 0; c < cfg.columnCount; c++) {
    bricks[c] = [];
    for (let r = 0; r < cfg.rowCount; r++) {
      bricks[c][r] = { x: 0, y: 0, status: 1, w: 0, h: 0 };
    }
  }
}

function setupLevel() {
  const cfg = generateLevelConfig(level);
  ball.x = canvas.width / 2;
  ball.y = canvas.height - 50;
  ball.dx = cfg.speed * (Math.random() < 0.5 ? 1 : -1);
  ball.dy = -cfg.speed;
  paddle.x = (canvas.width - paddle.width) / 2;
  initBricks();
  lives = 3; // reset lives each level
  saveGameState();
}

function resetBall() {
  const cfg = generateLevelConfig(level);
  ball.x = canvas.width / 2;
  ball.y = canvas.height - 50;
  ball.dx = cfg.speed * (Math.random() < 0.5 ? 1 : -1);
  ball.dy = -cfg.speed;
  saveGameState();
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#fde047';
  ctx.fill();
  ctx.closePath();
}

function drawPaddle() {
  ctx.beginPath();
  ctx.roundRect(paddle.x, canvas.height - paddle.height, paddle.width, paddle.height, 8);
  ctx.fillStyle = '#6366f1';
  ctx.fill();
  ctx.closePath();
}

// Dynamic-fit, centered brick layout that never overflows canvas width
function drawBricks() {
  const cfg = generateLevelConfig(level);
  const colors = ['#f87171','#fb923c','#facc15','#4ade80','#38bdf8','#a78bfa'];

  const pad = brickConfig.padding * scaleFactor;
  const offTop = brickConfig.offsetTop * scaleFactor;

  // Compute brick width to fit canvas with margins and padding, then center
  const cols = cfg.columnCount;
  const rows = cfg.rowCount;
  const minMarginX = 12 * scaleFactor;
  const totalPadding = pad * (cols - 1);

  // Fit width: bw is derived to ensure grid fits inside canvas with margins
  let bw = (canvas.width - 2 * minMarginX - totalPadding) / cols;
  // Clamp to a sensible minimum to avoid too-thin bricks on tiny screens
  const minBw = 22 * scaleFactor;
  if (bw < minBw) bw = minBw;

  // Now recompute left margin to perfectly center the grid
  const totalGridWidth = cols * bw + totalPadding;
  const startX = Math.max(minMarginX, (canvas.width - totalGridWidth) / 2);

  const bh = brickConfig.height * scaleFactor;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const b = bricks[c][r];
      if (b.status === 1) {
        const bx = startX + c * (bw + pad);
        const by = offTop + r * (bh + pad);
        b.x = bx; b.y = by; b.w = bw; b.h = bh;

        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 5 * scaleFactor);
        ctx.fillStyle = colors[(r + c) % colors.length];
        ctx.fill();
        ctx.closePath();
      }
    }
  }
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = `${16 * scaleFactor}px 'Press Start 2P'`;
  ctx.fillText(`Score: ${score}`, 8, 20 * scaleFactor);
  ctx.fillText(`Lives: ${lives}`, canvas.width - 140 * scaleFactor, 20 * scaleFactor);
  ctx.fillText(`Level: ${level}`, canvas.width / 2 - 60 * scaleFactor, 20 * scaleFactor);
}

function detectBrickCollisions() {
  const cfg = generateLevelConfig(level);
  for (let c = 0; c < cfg.columnCount; c++) {
    for (let r = 0; r < cfg.rowCount; r++) {
      const b = bricks[c][r];
      if (b.status === 1) {
        if (ball.x > b.x && ball.x < b.x + b.w && ball.y > b.y && ball.y < b.y + b.h) {
          ball.dy = -ball.dy;
          b.status = 0;
          score += cfg.scorePerBrick;
          remainingBricks--;
          if (remainingBricks === 0) { levelComplete(); }
          saveGameState();
        }
      }
    }
  }
}

function gameLoop() {
  if (!isGameRunning) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBricks();
  drawBall();
  drawPaddle();
  drawHUD();
  detectBrickCollisions();

  // Wall collisions
  if (ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) ball.dx = -ball.dx;
  if (ball.y + ball.dy < ball.radius) ball.dy = -ball.dy;

  // Paddle / bottom detection
  const paddleTop = canvas.height - paddle.height;
  if (ball.y + ball.dy >= paddleTop - ball.radius) {
    if (ball.x > paddle.x - ball.radius && ball.x < paddle.x + paddle.width + ball.radius) {
      const hitPos = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
      const angle = hitPos * Math.PI / 3;
      const speed = Math.hypot(ball.dx, ball.dy);
      ball.dx = speed * Math.sin(angle);
      ball.dy = -Math.abs(speed * Math.cos(angle));
    } else if (ball.y > canvas.height - ball.radius) {
      lives--;
      if (lives <= 0) { levelFailed(); return; }
      else resetBall();
    }
  }

  ball.x += ball.dx;
  ball.y += ball.dy;

  animationFrameId = requestAnimationFrame(gameLoop);
}

function startGame(resume = false) {
  isGameRunning = true;
  if (!resume) { score = 0; level = 1; setupLevel(); }
  else loadGameState();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  gameLoop();
  startButton.style.display = 'none';
  resetButton.style.display = 'none';
  messageEl.textContent = '';
}

function levelFailed() {
  isGameRunning = false;
  cancelAnimationFrame(animationFrameId);
  modalTitle.textContent = `Level ${level} Failed`;
  modalScore.textContent = `Score: ${score}`;
  gameOverModal.classList.remove('hidden');
  saveGameState();
}

function levelComplete() {
  isGameRunning = false;
  cancelAnimationFrame(animationFrameId);
  levelCompleteBanner.style.opacity = '1';
  levelCompleteBanner.style.animation = 'levelCompleteFlash 1.5s ease forwards';
  setTimeout(() => {
    levelCompleteBanner.style.opacity = '0';
    level++;
    setupLevel();
    isGameRunning = true;
    gameLoop();
  }, 1800);
}

function saveGameState() {
  const state = { score, level };
  localStorage.setItem('brickBreakerState', JSON.stringify(state));
}

function loadGameState() {
  const data = localStorage.getItem('brickBreakerState');
  if (!data) { setupLevel(); return; }
  try {
    const state = JSON.parse(data);
    score = state.score || 0;
    level = state.level || 1;
    setupLevel();
  } catch {
    setupLevel();
  }
}

function movePaddle(x) {
  paddle.x = Math.max(0, Math.min(x - paddle.width / 2, canvas.width - paddle.width));
}

// Input events
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  movePaddle(e.clientX - rect.left);
});

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  movePaddle(touch.clientX - rect.left);
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  movePaddle(touch.clientX - rect.left);
}, { passive: false });

startButton.addEventListener('click', () => {
  const hasSave = !!localStorage.getItem('brickBreakerState');
  startGame(hasSave);
});

retryButton.addEventListener('click', () => {
  gameOverModal.classList.add('hidden');
  setupLevel();
  isGameRunning = true;
  gameLoop();
});

resetButton.addEventListener('click', () => {
  localStorage.removeItem('brickBreakerState');
  location.reload();
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
window.addEventListener('beforeunload', saveGameState);

resizeCanvas();