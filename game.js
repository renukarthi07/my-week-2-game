const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const restartBtn = document.getElementById("restartBtn");

const keys = { ArrowUp: false, Space: false };
let bestScore = Number(localStorage.getItem("cosmic-dart-best") || 0);

const state = {
  running: true,
  player: {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: 28,
    height: 22,
    vy: 0,
    tilt: 0,
  },
  obstacles: [],
  portals: [],
  stars: [],
  trail: [],
  saws: [],
  boss: null,
  bossStartScore: 3300,
  bossEndScore: 5500,
  distance: 0,
  speed: 4.4,
  spawnTimer: 0,
  portalSpawnTimer: 0,
  speedMultiplier: 1,
  speedMultiplierTimer: 0,
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
  state.player.x = canvas.width / 2;
  state.player.y = canvas.height / 2;
  state.player.vy = 0;
  state.player.tilt = 0;
  state.obstacles = [];
  state.portals = [];
  state.trail = [];
  state.saws = [];
  state.boss = null;
  state.bossStartScore = 3300;
  state.bossEndScore = 5500;
  state.distance = 0;
  state.speed = 3.8;
  state.spawnTimer = 36;
  state.portalSpawnTimer = 92;
  state.speedMultiplier = 1;
  state.speedMultiplierTimer = 0;
  state.score = 0;
  lastFrame = 0;
  scoreEl.textContent = "Score: 0";
  bestEl.textContent = `Best: ${bestScore}`;
}

function spawnObstacle() {
  const chance = Math.random();
  if (chance < 0.16) {
    spawnSaw(canvas.width + 20, 30 + Math.random() * (canvas.height - 60));
    return;
  }

  const type = chance < 0.3 ? "block" : chance < 0.6 ? "spike" : chance < 0.85 ? "combo" : "row";

  if (type === "row") {
    const rowWidth = 18 + Math.random() * 8;
    const rowHeight = 16 + Math.random() * 8;
    const topY = 24 + Math.random() * 70;
    const bottomY = canvas.height - 70 - Math.random() * 70;
    const segments = [];
    const count = 3 + Math.floor(Math.random() * 2);

    for (let i = 0; i < count; i += 1) {
      segments.push({
        type: "spike",
        x: canvas.width + 20 + i * (rowWidth + 10),
        y: topY,
        width: rowWidth,
        height: rowHeight,
        color: "#ffd166",
      });
      segments.push({
        type: "spike",
        x: canvas.width + 20 + i * (rowWidth + 10),
        y: bottomY,
        width: rowWidth,
        height: rowHeight,
        color: "#ffd166",
      });
    }

    const blockY = (topY + bottomY) / 2 - 10;
    segments.push({
      type: "block",
      x: canvas.width + 20 + count * (rowWidth + 10) + 4,
      y: blockY,
      width: rowWidth + 6,
      height: rowHeight + 6,
      color: "#ff7b72",
    });

    state.obstacles.push({
      type: "row",
      x: canvas.width + 20,
      y: 0,
      width: count * (rowWidth + 10) + rowWidth + 20,
      height: canvas.height,
      segments,
    });
    return;
  }

  let width = 20 + Math.random() * 10;
  let height = 20 + Math.random() * 26;
  let y = 24 + Math.random() * (canvas.height - height - 48);

  if (type === "combo") {
    width = 24 + Math.random() * 8;
    height = 30 + Math.random() * 18;
    y = 24 + Math.random() * (canvas.height - height - 48);
  }

  state.obstacles.push({
    type,
    x: canvas.width + 20,
    y,
    width,
    height,
    color: type === "block" ? "#ff7b72" : "#ffd166",
  });
}

function spawnGroundSpike() {
  state.obstacles.push({
    type: "groundSpike",
    x: canvas.width + 24,
    y: canvas.height - 24,
    width: 18 + Math.random() * 10,
    height: 24,
    color: "#f43f5e",
  });
}

function spawnSaw(x, y, speed = 5.2) {
  state.saws.push({
    x,
    y,
    radius: 8 + Math.random() * 6,
    speed,
    spin: 0.14 + Math.random() * 0.1,
    rotation: Math.random() * Math.PI * 2,
  });
}

function spawnPortal() {
  const multiplier = 1 + Math.floor(Math.random() * 3);
  const portalWidth = 34 + Math.random() * 12;
  const portalHeight = 30 + Math.random() * 10;
  const y = 28 + Math.random() * (canvas.height - portalHeight - 56);

  state.portals.push({
    x: canvas.width + 24,
    y,
    width: portalWidth,
    height: portalHeight,
    multiplier,
    pulse: Math.random() * Math.PI * 2,
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

function collidesWithBoss(playerBox, boss) {
  return (
    playerBox.x < boss.x + boss.width &&
    playerBox.x + playerBox.width > boss.x &&
    playerBox.y < boss.y + boss.height &&
    playerBox.y + playerBox.height > boss.y
  );
}

function collidesWithSaw(playerBox, saw) {
  const dx = Math.max(playerBox.x, Math.min(saw.x, playerBox.x + playerBox.width)) - saw.x;
  const dy = Math.max(playerBox.y, Math.min(saw.y, playerBox.y + playerBox.height)) - saw.y;
  return dx * dx + dy * dy <= saw.radius * saw.radius;
}

function collidesWithObstacle(playerBox, obstacle) {
  if (obstacle.type === "row") {
    return obstacle.segments.some((segment) =>
      playerBox.x < segment.x + segment.width &&
      playerBox.x + playerBox.width > segment.x &&
      playerBox.y < segment.y + segment.height &&
      playerBox.y + playerBox.height > segment.y
    );
  }

  return (
    playerBox.x < obstacle.x + obstacle.width &&
    playerBox.x + playerBox.width > obstacle.x &&
    playerBox.y < obstacle.y + obstacle.height &&
    playerBox.y + playerBox.height > obstacle.y
  );
}

function collidesWithPortal(playerBox, portal) {
  return (
    playerBox.x < portal.x + portal.width &&
    playerBox.x + playerBox.width > portal.x &&
    playerBox.y < portal.y + portal.height &&
    playerBox.y + playerBox.height > portal.y
  );
}

function spawnBoss() {
  state.boss = {
    x: canvas.width + 100,
    y: canvas.height / 2,
    width: 92,
    height: 74,
    phase: "enter",
    sawTimer: 0.22,
    wobble: 0,
    blastTimer: 0,
    trumpetPulse: 0,
  };
}

function update(delta) {
  if (!state.running) {
    return;
  }

  const isThrusting = keys.ArrowUp || keys.Space;
  state.player.vy = isThrusting ? -1.6 : 1.25;
  state.player.x = canvas.width / 2;
  state.player.y += state.player.vy * delta;
  state.player.tilt = isThrusting ? -0.35 : 0.2;

  if (state.player.y < 28) {
    state.player.y = 28;
    state.player.vy = 0;
  }

  if (state.player.y > canvas.height - 28) {
    state.player.y = canvas.height - 28;
    state.player.vy = 0;
  }

  state.trail.push({ x: state.player.x, y: state.player.y, tilt: state.player.tilt });
  if (state.trail.length > 24) {
    state.trail.shift();
  }

  const baseSpeed = 3.8 + state.distance / 2200;
  const activeSpeed = baseSpeed * state.speedMultiplier;

  state.distance += delta * (1.1 + activeSpeed * 0.14);
  state.speed = 3.8 + state.distance / 2200;
  state.score = Math.floor(state.distance);

  scoreEl.textContent = `Score: ${state.score}`;
  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem("cosmic-dart-best", String(bestScore));
  }
  bestEl.textContent = `Best: ${bestScore}`;

  if (state.score >= state.bossStartScore && state.score <= state.bossEndScore && !state.boss) {
    spawnBoss();
  }

  if (state.boss && state.score > state.bossEndScore) {
    state.boss = null;
  }

  state.spawnTimer -= delta;
  if (state.spawnTimer <= 0) {
    const spawnChance = Math.random();
    if (spawnChance < 0.14) {
      spawnGroundSpike();
    } else {
      spawnObstacle();
    }
    state.spawnTimer = Math.max(18, 38 - state.distance / 22);
  }

  state.portalSpawnTimer -= delta;
  if (state.portalSpawnTimer <= 0) {
    spawnPortal();
    state.portalSpawnTimer = 92 + Math.random() * 40;
  }

  if (state.speedMultiplierTimer > 0) {
    state.speedMultiplierTimer -= delta;
    if (state.speedMultiplierTimer <= 0) {
      state.speedMultiplier = 1;
    }
  }

  for (let i = state.obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = state.obstacles[i];
    const moveAmount = (activeSpeed + 1.1) * delta;
    obstacle.x -= moveAmount;

    if (obstacle.type === "row") {
      obstacle.segments.forEach((segment) => {
        segment.x -= moveAmount;
      });
    }

    if (collidesWithObstacle(getPlayerBox(), obstacle)) {
      state.running = false;
      break;
    }

    if (obstacle.x + obstacle.width < -20) {
      state.obstacles.splice(i, 1);
    }
  }

  if (state.boss) {
    const boss = state.boss;
    if (boss.phase === "enter") {
      boss.x -= (2.6 + state.speed * 0.08) * delta;
      if (boss.x <= canvas.width - 180) {
        boss.phase = "fight";
        boss.x = canvas.width - 180;
      }
    } else {
      boss.wobble += delta * 0.09;
      boss.y = canvas.height / 2 + Math.sin(boss.wobble) * 110;
      boss.sawTimer -= delta;
      boss.blastTimer -= delta;
      boss.trumpetPulse += delta * 2.6;

      if (boss.sawTimer <= 0) {
        const burstCount = 3;
        for (let i = 0; i < burstCount; i += 1) {
          const angle = (i / burstCount) * Math.PI * 0.9 - Math.PI * 0.45;
          const speed = 5.8 + Math.random() * 1.2;
          const sawX = boss.x - 24;
          const sawY = boss.y + Math.sin(angle) * 28 + (i - 1) * 10;
          const saw = { x: sawX, y: sawY, radius: 8 + Math.random() * 4, speed, spin: 0.16 + Math.random() * 0.1, rotation: Math.random() * Math.PI * 2 };
          state.saws.push(saw);
        }
        boss.sawTimer = 0.18;
      }

      if (boss.blastTimer <= 0) {
        const blastCount = 4;
        for (let i = 0; i < blastCount; i += 1) {
          const spread = (i / (blastCount - 1)) * 2 - 1;
          const sawY = boss.y + spread * 38;
          spawnSaw(boss.x - 30, sawY, 6.4 + Math.abs(spread) * 0.8);
        }
        boss.blastTimer = 0.65;
      }
    }

    if (collidesWithBoss(getPlayerBox(), boss)) {
      state.running = false;
    }
  }

  for (let i = state.saws.length - 1; i >= 0; i -= 1) {
    const saw = state.saws[i];
    saw.x -= (activeSpeed + 1.8) * delta;
    saw.rotation += saw.spin * delta;

    if (collidesWithSaw(getPlayerBox(), saw)) {
      state.running = false;
      break;
    }

    if (saw.x + saw.radius < -10) {
      state.saws.splice(i, 1);
    }
  }

  for (let i = state.portals.length - 1; i >= 0; i -= 1) {
    const portal = state.portals[i];
    portal.x -= (activeSpeed + 1.1) * delta;

    if (collidesWithPortal(getPlayerBox(), portal)) {
      state.speedMultiplier = portal.multiplier;
      state.speedMultiplierTimer = 4;
      state.portals.splice(i, 1);
      continue;
    }

    if (portal.x + portal.width < -20) {
      state.portals.splice(i, 1);
    }
  }

  for (const star of state.stars) {
    star.x -= star.speed * (0.8 + activeSpeed * 0.08) * delta;
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

  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(canvas.width, 0);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.stroke();
}

function drawPlayer() {
  if (state.trail.length > 1) {
    ctx.save();
    ctx.strokeStyle = "rgba(254, 243, 199, 0.95)";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    state.trail.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.rotate(state.player.tilt);
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

function drawPortals() {
  for (const portal of state.portals) {
    const pulse = (Math.sin(Date.now() * 0.003 + portal.pulse) + 1) / 2;
    const color = portal.multiplier >= 3 ? "#a78bfa" : portal.multiplier === 2 ? "#22d3ee" : "#34d399";

    ctx.save();
    ctx.translate(portal.x + portal.width / 2, portal.y + portal.height / 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 + pulse * 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, portal.width / 2 - 4, portal.height / 2 - 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, portal.width / 2 - 12, portal.height / 2 - 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.arc(0, 0, portal.width / 2 - 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fef3c7";
    ctx.font = "bold 15px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(`${portal.multiplier}x`, 0, 5);
    ctx.restore();
  }
}

function drawSaws() {
  for (const saw of state.saws) {
    ctx.save();
    ctx.translate(saw.x, saw.y);
    ctx.rotate(saw.rotation);
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, saw.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#fb7185";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-saw.radius, 0);
    ctx.lineTo(saw.radius, 0);
    ctx.moveTo(0, -saw.radius);
    ctx.lineTo(0, saw.radius);
    ctx.moveTo(-saw.radius * 0.7, -saw.radius * 0.7);
    ctx.lineTo(saw.radius * 0.7, saw.radius * 0.7);
    ctx.moveTo(-saw.radius * 0.7, saw.radius * 0.7);
    ctx.lineTo(saw.radius * 0.7, -saw.radius * 0.7);
    ctx.stroke();
    ctx.restore();
  }
}

function drawObstacles() {
  for (const obstacle of state.obstacles) {
    ctx.save();

    if (obstacle.type === "row") {
      obstacle.segments.forEach((segment) => {
        ctx.fillStyle = segment.color;
        if (segment.type === "block") {
          ctx.fillRect(segment.x, segment.y, segment.width, segment.height);
        } else {
          ctx.beginPath();
          ctx.moveTo(segment.x, segment.y + segment.height);
          ctx.lineTo(segment.x + segment.width / 2, segment.y);
          ctx.lineTo(segment.x + segment.width, segment.y + segment.height);
          ctx.closePath();
          ctx.fill();
        }
      });
    } else {
      ctx.fillStyle = obstacle.color;

      if (obstacle.type === "block") {
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      } else if (obstacle.type === "groundSpike") {
        ctx.beginPath();
        ctx.moveTo(obstacle.x, obstacle.y);
        ctx.lineTo(obstacle.x + obstacle.width / 2, obstacle.y - obstacle.height);
        ctx.lineTo(obstacle.x + obstacle.width, obstacle.y);
        ctx.closePath();
        ctx.fill();
      } else if (obstacle.type === "combo") {
        ctx.fillRect(obstacle.x, obstacle.y + 8, obstacle.width, obstacle.height - 10);
        ctx.beginPath();
        ctx.moveTo(obstacle.x, obstacle.y + 6);
        ctx.lineTo(obstacle.x + obstacle.width / 2, obstacle.y);
        ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + 6);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(obstacle.x, obstacle.y + obstacle.height);
        ctx.lineTo(obstacle.x + obstacle.width / 2, obstacle.y);
        ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

function drawBoss() {
  if (!state.boss) {
    return;
  }

  const boss = state.boss;
  ctx.save();
  ctx.translate(boss.x, boss.y);

  ctx.fillStyle = "#2563eb";
  ctx.fillRect(-boss.width / 2, -boss.height / 2, boss.width, boss.height);

  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(-boss.width / 2 + 12, -boss.height / 2 + 12, boss.width - 24, 18);

  ctx.fillStyle = "#f3c88f";
  ctx.beginPath();
  ctx.ellipse(0, -8, 28, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f9d423";
  ctx.beginPath();
  ctx.moveTo(-24, -8);
  ctx.quadraticCurveTo(-16, -36, -4, -24);
  ctx.quadraticCurveTo(0, -40, 6, -22);
  ctx.quadraticCurveTo(16, -36, 24, -8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(-8, -10, 2.2, 0, Math.PI * 2);
  ctx.arc(8, -10, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0.2, 1.2);
  ctx.stroke();

  ctx.fillStyle = "#dc2626";
  ctx.fillRect(-14, 16, 28, 30);
  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(-10, 12, 20, 8);

  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.moveTo(-12, 18);
  ctx.lineTo(0, 8);
  ctx.lineTo(12, 18);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
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
  drawPortals();
  drawObstacles();
  drawSaws();
  drawBoss();
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

  if (event.code === "Space") {
    keys.Space = true;
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

  if (event.code === "Space") {
    keys.Space = false;
  }
});

restartBtn.addEventListener("click", resetGame);

initStars();
bestEl.textContent = `Best: ${bestScore}`;
resetGame();
requestAnimationFrame(loop);
