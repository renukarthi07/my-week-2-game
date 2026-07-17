const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const restartBtn = document.getElementById("restartBtn");

const keys = { ArrowUp: false };
let bestScore = Number(localStorage.getItem("cosmic-dart-best") || 0);

const state = {
  running: true,
  player: {
    x: 140,
    y: canvas.height / 2,
    width: 28,
    height: 22,
    vy: 0,
  },
  obstacles: [],
  stars: [],
  distance: 0,
  speed: 4.4,
  spawnTimer: 0,
  score: 0,
};

let lastFrame = 0;

function initStars() {
  state.stars = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: Math.random() * 1.5 + 0.6,
    alpha: Math.random() * 0.7 + 0.2,
    speed: Math.random() * 0.7 + 0.2,
  }));
}

function resetGame() {
  state.running = true;
  state.player.y = canvas.height / 2;
  state.player.vy = 0;
  state.obstacles = [];
  state.distance = 0;
  state.speed = 4.4;
  state.spawnTimer = 35;
  state.score = 0;
  lastFrame = 0;
  scoreEl.textContent = "Score: 0";
  bestEl.textContent = `Best: ${bestScore}`;
}

function spawnObstacle() {
  const type = Math.random() > 0.5 ? "block" : "spike";
  const width = 46 + Math.random() * 32;
  const height = 72 + Math.random() * 110;
  const y = 30 + Math.random() * (canvas.height - height - 60);

  state.obstacles.push({
    type,
    x: canvas.width + 20,
    y,
    width,
    height,
    color: type === "block" ? "#ff6f61" : "#ffd166",
  });
}

function getPlayerBox() {
  return {
    x: state.player.x - 12,
    y: state.player.y - 10,
    width: 24,
    height: 20,
  };
}

function collidesWithObstacle(playerBox, obstacle) {
  return (
    playerBox.x < obstacle.x + obstacle.width &&
    playerBox.x + playerBox.width > obstacle.x &&
    playerBox.y < obstacle.y + obstacle.height &&
    playerBox.y + playerBox.height > obstacle.y
  );
}

function update(delta) {
  if (!state.running) {
    return;
  }

  if (keys.ArrowUp) {
    state.player.vy -= 0.28 * delta;
  } else {
    state.player.vy += 0.24 * delta;
  }

  state.player.vy = Math.max(-6.5, Math.min(6.5, state.player.vy));
  state.player.y += state.player.vy * delta;

  if (state.player.y < 24) {
    state.player.y = 24;
    state.player.vy = 0;
  }

  if (state.player.y > canvas.height - 24) {
    state.player.y = canvas.height - 24;
    state.player.vy = 0;
  }

  state.distance += delta * (1.4 + state.speed * 0.18);
  state.speed = 4.4 + state.distance / 1800;
  state.score = Math.floor(state.distance);

  scoreEl.textContent = `Score: ${state.score}`;
  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem("cosmic-dart-best", String(bestScore));
  }
  bestEl.textContent = `Best: ${bestScore}`;

  state.spawnTimer -= delta;
  if (state.spawnTimer <= 0) {
    spawnObstacle();
    state.spawnTimer = Math.max(16, 36 - state.distance / 24);
  }

  for (let i = state.obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = state.obstacles[i];
    obstacle.x -= (state.speed + 1.4) * delta;

    if (collidesWithObstacle(getPlayerBox(), obstacle)) {
      state.running = false;
      break;
    }

    if (obstacle.x + obstacle.width < -20) {
      state.obstacles.splice(i, 1);
    }
  }

  for (const star of state.stars) {
    star.x -= star.speed * (0.8 + state.speed * 0.08) * delta;
    if (star.x < -4) {
      star.x = canvas.width + 4;
      star.y = Math.random() * canvas.height;
    }
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#060817");
  gradient.addColorStop(0.6, "#10163c");
  gradient.addColorStop(1, "#02040d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(canvas.width * 0.82, canvas.height * 0.22, 110, 0, Math.PI * 2);
  ctx.fill();

  for (const star of state.stars) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.fillStyle = "#fef3c7";
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-4, -6);
  ctx.lineTo(-4, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawObstacles() {
  for (const obstacle of state.obstacles) {
    ctx.save();
    ctx.fillStyle = obstacle.color;

    if (obstacle.type === "block") {
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    } else {
      ctx.beginPath();
      ctx.moveTo(obstacle.x, obstacle.y + obstacle.height);
      ctx.lineTo(obstacle.x + obstacle.width / 2, obstacle.y);
      ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawOverlay() {
  if (state.running) {
    return;
  }

  ctx.fillStyle = "rgba(2, 4, 13, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff7d6";
  ctx.font = "bold 44px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = "24px Trebuchet MS";
  ctx.fillText(`Score: ${state.score}`, canvas.width / 2, canvas.height / 2 + 18);
  ctx.fillText("Press Enter or Restart", canvas.width / 2, canvas.height / 2 + 54);
}

function draw() {
  drawBackground();
  drawObstacles();
  drawPlayer();
  drawOverlay();
}

function loop(timestamp) {
  if (!lastFrame) {
    lastFrame = timestamp;
  }

  const delta = Math.min(2.2, (timestamp - lastFrame) / 16.67);
  lastFrame = timestamp;

  update(delta);
  draw();

  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    keys.ArrowUp = true;
    event.preventDefault();
  }

  if (event.key === "Enter" && !state.running) {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowUp") {
    keys.ArrowUp = false;
  }
});

restartBtn.addEventListener("click", resetGame);

initStars();
bestEl.textContent = `Best: ${bestScore}`;
resetGame();
requestAnimationFrame(loop);
