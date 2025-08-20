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

/* ========= Sliding brick window state =========
   We only render a "window" of rows that fit on screen.
   As the top visible row is fully cleared, we slide the window down by 1 row,
   bringing the next hidden row into view with a short animation.
*/
let visibleRowStart = 0; // inclusive
let visibleRowEnd = 0;   // exclusive
let sliding = false;     // if a slide animation is in progress
let slideOffset = 0;     // current pixel offset for slide
let slideStepPx = 0;     // per-frame pixels to move during slide (derived from scale)
let lastFrameTime = 0;   // for time-based slide speed (smoother across devices)

/* Utility: compute how many rows can fit in the current canvas.
   We keep bricks in roughly the top ~55% of the playfield to avoid overlap with
   paddle and to leave room for the HUD. */
function computeRowsFit() {
  const pad = brickConfig.padding * scaleFactor;
  const bh = brickConfig.height * scaleFactor;
  const offTop = brickConfig.offsetTop * scaleFactor;

  // Available vertical area for bricks
  const available = Math.max(0, canvas.height * 0.55 - offTop);
  const perRow = bh + pad;
  const maxRows = Math.max(1, Math.floor(available / perRow));
  return { maxRows, perRow, offTop, bh, pad };
}

function ensureVisibleWindowWithinBounds() {
  const cfg = generateLevelConfig(level);
  const { maxRows } = computeRowsFit();

  // Clamp window size to what fits
  const desiredSize = Math.min(maxRows, cfg.rowCount);
  const currentSize = Math.max(0, visibleRowEnd - visibleRowStart);

  if (currentSize !== desiredSize) {
    // Try to anchor on current start, expand or shrink end
    visibleRowEnd = Math.min(cfg.rowCount, visibleRowStart + desiredSize);
    // If we ran past end, shift start back
    visibleRowStart = Math.max(0, visibleRowEnd - desiredSize);
  }

  // Safety clamps
  if (visibleRowStart < 0) visibleRowStart = 0;
  if (visibleRowEnd > cfg.rowCount) visibleRowEnd = cfg.rowCount;
  if (visibleRowStart > visibleRowEnd) visibleRowStart = visibleRowEnd;
}

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

  // Make paddle taller so it's easier to hit on touch devices
  if (window.innerWidth < 768) {
    paddle.height = Math.max(18, 26 * scaleFactor);  // mobile: 18–26px
  } else {
    paddle.height = Math.max(12, 18 * scaleFactor);  // desktop: 12–18px
  }


  // Recompute slide speed to feel consistent across sizes
  slideStepPx = Math.max(6, 18 * scaleFactor);

  // Make sure visible window still valid after resize
  ensureVisibleWindowWithinBounds();
}

function generateLevelConfig(currentLevel) {
  return {
    rowCount: 4 + currentLevel,
    columnCount: 6 + currentLevel,
    // Speed increases per level, scaled
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

  // Initial visible window based on what fits
  const { maxRows } = computeRowsFit();
  visibleRowStart = 0;
  visibleRowEnd = Math.min(cfg.rowCount, maxRows);
  sliding = false;
  slideOffset = 0;
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

/* Dynamic-fit, centered brick layout that never overflows canvas width
   + sliding window support (with small animation) */
function drawBricks() {
  const cfg = generateLevelConfig(level);
  const colors = ['#f87171','#fb923c','#facc15','#4ade80','#38bdf8','#a78bfa'];

  const { pad, offTop, bh } = computeRowsFit();

  // Width calc to fit columns within canvas with nice margins
  const cols = cfg.columnCount;
  const rows = cfg.rowCount;
  const minMarginX = 12 * scaleFactor;
  const totalPadding = pad * (cols - 1);

  // Brick width to fit
  let bw = (canvas.width - 2 * minMarginX - totalPadding) / cols;
  const minBw = 22 * scaleFactor;
  if (bw < minBw) bw = minBw;

  // Center horizontally
  const totalGridWidth = cols * bw + totalPadding;
  const startX = Math.max(minMarginX, (canvas.width - totalGridWidth) / 2);

  // Draw current visible rows, shifted by slideOffset
  const start = visibleRowStart;
  const endExclusive = visibleRowEnd;

  // Draw rows currently in the window
  for (let c = 0; c < cols; c++) {
    for (let r = start; r < endExclusive; r++) {
      const b = bricks[c][r];
      if (b.status === 1) {
        const localIndex = r - start;
        // During slide, move the whole visible block downward by slideOffset
        const bx = startX + c * (bw + pad);
        const by = offTop + localIndex * (bh + pad) + slideOffset;
        b.x = bx; b.y = by; b.w = bw; b.h = bh;

        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 5 * scaleFactor);
        ctx.fillStyle = colors[(r + c) % colors.length];
        ctx.fill();
        ctx.closePath();
      }
    }
  }

  // While sliding, also render the incoming next row above, so it "slides in"
  if (sliding && endExclusive < rows) {
    const nextRow = endExclusive;
    for (let c = 0; c < cols; c++) {
      const b = bricks[c][nextRow];
      if (b.status === 1) {
        const bx = startX + c * (bw + pad);
        // Incoming row starts above offTop and moves down with slideOffset
        const by = offTop - ((bh + pad) - slideOffset);
        // We DO NOT update b.x/b.y persistent positions for incoming row yet,
        // to avoid collisions before the slide completes.
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 5 * scaleFactor);
        ctx.fillStyle = colors[(nextRow + c) % colors.length];
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

/* After any brick break, check if the top visible row is fully cleared.
   If yes (and there are hidden rows), start a slide animation to bring
   the next hidden row into view. */
function maybeStartSlide() {
  if (sliding) return;
  const cfg = generateLevelConfig(level);
  if (visibleRowEnd >= cfg.rowCount) return; // nothing to slide in

  // Is the top visible row cleared?
  let cleared = true;
  for (let c = 0; c < cfg.columnCount; c++) {
    if (bricks[c][visibleRowStart].status === 1) { cleared = false; break; }
  }
  if (!cleared) return;

  // Begin slide
  slideOffset = 0;
  sliding = true;
}

function updateSlide(deltaMs) {
  if (!sliding) return;

  const { perRow } = computeRowsFit();
  // time-based movement for smoother feel
  const step = slideStepPx * (deltaMs / 16.6667); // normalize to ~60fps base
  slideOffset += step;

  if (slideOffset >= perRow) {
    // Slide complete: commit window shift by one row
    slideOffset = 0;
    sliding = false;
    visibleRowStart += 1;
    visibleRowEnd += 1;
    ensureVisibleWindowWithinBounds();
  }
}

function detectBrickCollisions() {
  const cfg = generateLevelConfig(level);
  // Only collide with rows currently solidly in the window (not the incoming one mid-slide)
  for (let c = 0; c < cfg.columnCount; c++) {
    for (let r = visibleRowStart; r < visibleRowEnd; r++) {
      const b = bricks[c][r];
      if (b.status === 1) {
        if (ball.x > b.x && ball.x < b.x + b.w && ball.y > b.y && ball.y < b.y + b.h) {
          ball.dy = -ball.dy;
          b.status = 0;
          score += cfg.scorePerBrick;
          remainingBricks--;

          // Check if we should slide in the next row
          maybeStartSlide();

          if (remainingBricks === 0) { levelComplete(); }
          saveGameState();
          return; // avoid multiple hits in one frame
        }
      }
    }
  }
}

function gameLoop(timestamp) {
  if (!isGameRunning) return;

  const deltaMs = lastFrameTime ? (timestamp - lastFrameTime) : 16.7;
  lastFrameTime = timestamp;

  // Progress any slide animation
  updateSlide(deltaMs);

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
  lastFrameTime = 0;
  gameLoop(performance.now());
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
    lastFrameTime = 0;
    gameLoop(performance.now());
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
  lastFrameTime = 0;
  gameLoop(performance.now());
});

resetButton.addEventListener('click', () => {
  localStorage.removeItem('brickBreakerState');
  location.reload();
});

window.addEventListener('resize', () => {
  resizeCanvas();
  // Keep ball inside bounds after resize
  ball.x = Math.min(Math.max(ball.radius, ball.x), canvas.width - ball.radius);
  ball.y = Math.min(Math.max(ball.radius, ball.y), canvas.height - ball.radius);
});
window.addEventListener('orientationchange', () => {
  resizeCanvas();
  ball.x = Math.min(Math.max(ball.radius, ball.x), canvas.width - ball.radius);
  ball.y = Math.min(Math.max(ball.radius, ball.y), canvas.height - ball.radius);
});
window.addEventListener('beforeunload', saveGameState);

// Initial layout
resizeCanvas();
