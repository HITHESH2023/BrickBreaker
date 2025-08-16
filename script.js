    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
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
    const paddle = { x: 0, height: 15, width: 240 };
    const brickConfig = { width: 65, height: 20, padding: 10, offsetTop: 50, offsetLeft: 40 };
    let bricks = [];

    function resizeCanvas() {
      const container = document.getElementById('canvas-container');
      const newWidth = container.clientWidth;
      const newHeight = Math.round(newWidth * (baseHeight / baseWidth));
      canvas.width = newWidth; canvas.height = newHeight;
      scaleFactor = newWidth / baseWidth;
      ball.radius = 10 * scaleFactor;
      paddle.width = 240 * scaleFactor;
      paddle.height = 15 * scaleFactor;
    }

    function generateLevelConfig(currentLevel) {
      return {
        rowCount: 4 + currentLevel,
        columnCount: 6 + currentLevel,
        speed: (2 + currentLevel * 0.4) * scaleFactor,
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
          bricks[c][r] = { x: 0, y: 0, status: 1 };
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
      lives = 3; // reset lives for each level
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

    function drawBricks() {
      const cfg = generateLevelConfig(level);
      const colors = ['#f87171','#fb923c','#facc15','#4ade80','#38bdf8','#a78bfa'];
      for (let c = 0; c < cfg.columnCount; c++) {
        for (let r = 0; r < cfg.rowCount; r++) {
          const b = bricks[c][r];
          if (b.status === 1) {
            const bx = (c * (brickConfig.width + brickConfig.padding)) + brickConfig.offsetLeft;
            const by = (r * (brickConfig.height + brickConfig.padding)) + brickConfig.offsetTop;
            b.x = bx; b.y = by;
            ctx.beginPath();
            ctx.roundRect(bx, by, brickConfig.width, brickConfig.height, 5);
            ctx.fillStyle = colors[(r+c) % colors.length];
            ctx.fill();
            ctx.closePath();
          }
        }
      }
    }

    function drawHUD() {
      ctx.fillStyle = '#fff';
      ctx.font = `${16 * scaleFactor}px 'Press Start 2P'`;
      ctx.fillText(`Score: ${score}`, 8, 20);
      ctx.fillText(`Lives: ${lives}`, canvas.width - 140, 20);
      ctx.fillText(`Level: ${level}`, canvas.width/2 - 60, 20);
    }

    function detectBrickCollisions() {
      const cfg = generateLevelConfig(level);
      for (let c = 0; c < cfg.columnCount; c++) {
        for (let r = 0; r < cfg.rowCount; r++) {
          const b = bricks[c][r];
          if (b.status === 1) {
            if (ball.x > b.x && ball.x < b.x + brickConfig.width && ball.y > b.y && ball.y < b.y + brickConfig.height) {
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

      if (ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) ball.dx = -ball.dx;
      if (ball.y + ball.dy < ball.radius) ball.dy = -ball.dy;

      const paddleTop = canvas.height - paddle.height;
      if (ball.y + ball.dy >= paddleTop - ball.radius) {
        if (ball.x > paddle.x - ball.radius && ball.x < paddle.x + paddle.width + ball.radius) {
          const hitPos = (ball.x - (paddle.x + paddle.width/2)) / (paddle.width/2);
          const angle = hitPos * Math.PI/3;
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

    function startGame(resume=false) {
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
      } catch { setupLevel(); }
    }

    startButton.addEventListener('click', () => {
      const hasSave = !!localStorage.getItem('brickBreakerState');
      startGame(hasSave);
    });
    retryButton.addEventListener('click', () => { gameOverModal.classList.add('hidden'); setupLevel(); isGameRunning=true; gameLoop(); });
    resetButton.addEventListener('click', () => { localStorage.removeItem('brickBreakerState'); location.reload(); });

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      paddle.x = Math.max(0, Math.min(x - paddle.width/2, canvas.width - paddle.width));
    });

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('beforeunload', saveGameState);

    resizeCanvas();