(() => {
  const STORAGE_KEY = "aircraft_mechanic_tycoon_save_v1";
  const SETTINGS_KEY = "aircraft_mechanic_tycoon_settings_v1";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const moneyValue = document.getElementById("moneyValue");
  const levelValue = document.getElementById("levelValue");
  const xpText = document.getElementById("xpText");
  const xpFill = document.getElementById("xpFill");
  const comboValue = document.getElementById("comboValue");
  const toast = document.getElementById("toast");

  const interactBtn = document.getElementById("interactBtn");
  const upgradeBtn = document.getElementById("upgradeBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");

  const upgradeModal = document.getElementById("upgradeModal");
  const settingsModal = document.getElementById("settingsModal");
  const dailyModal = document.getElementById("dailyModal");
  const tutorialModal = document.getElementById("tutorialModal");

  const soundToggle = document.getElementById("soundToggle");
  const vibrationToggle = document.getElementById("vibrationToggle");
  const claimDailyBtn = document.getElementById("claimDailyBtn");
  const dailyText = document.getElementById("dailyText");

  const joystickArea = document.getElementById("joystickArea");
  const joystickBase = document.getElementById("joystickBase");
  const joystickThumb = document.getElementById("joystickThumb");

  const upgradeList = document.getElementById("upgradeList");

  const WORLD_BASE = { width: 1400, height: 900 };
  const PLAYER_RADIUS = 20;
  const INTERACT_RANGE = 90;
  const MAX_WORKERS = 5;

  const AIRCRAFT_TYPES = {
    small: {
      name: "Small Plane",
      color: "#63d2ff",
      wait: 42,
      difficulty: 1,
      payment: 130,
      size: 1
    },
    helicopter: {
      name: "Helicopter",
      color: "#8de64f",
      wait: 34,
      difficulty: 1.35,
      payment: 205,
      size: 1.08
    },
    jet: {
      name: "Jet",
      color: "#ff9f4d",
      wait: 28,
      difficulty: 1.8,
      payment: 340,
      size: 1.16
    }
  };

  const REPAIR_TYPES = ["Engine", "Tires", "Electrical"];

  const game = {
    width: WORLD_BASE.width,
    height: WORLD_BASE.height,
    viewWidth: 0,
    viewHeight: 0,
    cameraX: 0,
    cameraY: 0,
    time: 0,
    elapsed: 0,
    spawnTimer: 0,
    spawnBase: 8,
    saveTimer: 0,
    idleTimer: 0,
    workers: [],
    aircraft: [],
    particles: [],
    settings: {
      sound: true,
      vibration: true
    },
    state: {
      money: 260,
      level: 1,
      xp: 0,
      xpToNext: 100,
      combo: 1,
      comboTimer: 0,
      speedLevel: 1,
      valueLevel: 1,
      repairLevel: 1,
      hangarLevel: 1,
      workerLevel: 0,
      unlockHelicopter: false,
      unlockJet: false,
      tutorialDone: false,
      lastDailyClaim: "",
      totalRepairs: 0
    },
    input: {
      keys: {},
      actionHeld: false,
      joystickActive: false,
      joyX: 0,
      joyY: 0,
      tapTarget: null,
      pointerDown: false
    },
    player: {
      x: 320,
      y: 380,
      vx: 0,
      vy: 0,
      dir: 1,
      step: 0
    }
  };

  let audioCtx = null;
  let toastTimeout = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function fmtMoney(amount) {
    return `$${Math.floor(amount).toLocaleString()}`;
  }

  function vibrate(ms) {
    if (!game.settings.vibration) return;
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  function playSound(type) {
    if (!game.settings.sound) return;
    ensureAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    let f1 = 220;
    let f2 = 220;
    let dur = 0.09;

    if (type === "cash") {
      f1 = 620;
      f2 = 900;
      dur = 0.08;
    } else if (type === "repair") {
      f1 = 180;
      f2 = 340;
      dur = 0.12;
    } else if (type === "upgrade") {
      f1 = 260;
      f2 = 760;
      dur = 0.16;
    } else if (type === "alert") {
      f1 = 300;
      f2 = 130;
      dur = 0.13;
    }

    osc.type = "triangle";
    osc.frequency.setValueAtTime(f1, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(80, f2), now + dur);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: sx + game.cameraX,
      y: sy + game.cameraY
    };
  }

  function worldToScreen(x, y) {
    return {
      x: x - game.cameraX,
      y: y - game.cameraY
    };
  }

  function getXpNeeded(level) {
    return Math.floor(85 + level * level * 18);
  }

  function addXP(amount) {
    game.state.xp += amount;
    while (game.state.xp >= game.state.xpToNext) {
      game.state.xp -= game.state.xpToNext;
      game.state.level += 1;
      game.state.xpToNext = getXpNeeded(game.state.level);
      showToast(`Level Up! ${game.state.level}`);
      playSound("upgrade");
      game.state.money += 80 + game.state.level * 12;
    }
  }

  function getHangarSlots() {
    return 4 + (game.state.hangarLevel - 1) * 2;
  }

  function getMaxAircraft() {
    return getHangarSlots();
  }

  function getWorldSize() {
    return {
      width: WORLD_BASE.width + (game.state.hangarLevel - 1) * 220,
      height: WORLD_BASE.height + (game.state.hangarLevel - 1) * 120
    };
  }

  function computeSlots() {
    const slots = [];
    const size = getWorldSize();
    const count = getHangarSlots();
    const cols = Math.min(4 + game.state.hangarLevel, count);
    const rows = Math.ceil(count / cols);
    const startX = 280;
    const startY = 190;
    const xGap = Math.max(150, (size.width - 460) / Math.max(cols - 1, 1));
    const yGap = Math.max(160, (size.height - 340) / Math.max(rows - 1, 1));

    for (let i = 0; i < count; i += 1) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      slots.push({ x: startX + c * xGap, y: startY + r * yGap });
    }

    return slots;
  }

  function getOpenSlot() {
    const slots = computeSlots();
    const occupied = new Set(game.aircraft.map((a) => a.slot));
    for (let i = 0; i < slots.length; i += 1) {
      if (!occupied.has(i)) {
        return { slotIndex: i, pos: slots[i] };
      }
    }
    return null;
  }

  function chooseAircraftType() {
    const pool = ["small"];
    if (game.state.unlockHelicopter || game.elapsed > 130) pool.push("helicopter");
    if (game.state.unlockJet || game.elapsed > 320) pool.push("jet");
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  }

  function spawnAircraft() {
    if (game.aircraft.length >= getMaxAircraft()) return;
    const slotInfo = getOpenSlot();
    if (!slotInfo) return;

    const key = chooseAircraftType();
    const def = AIRCRAFT_TYPES[key];
    const repairType = REPAIR_TYPES[Math.floor(Math.random() * REPAIR_TYPES.length)];
    const hardScale = 1 + game.elapsed * 0.0025;
    const waitScale = clamp(1 - game.elapsed * 0.0007, 0.62, 1);

    game.aircraft.push({
      id: crypto.randomUUID(),
      key,
      def,
      typeName: def.name,
      repairType,
      x: -140,
      y: slotInfo.pos.y,
      targetX: slotInfo.pos.x,
      targetY: slotInfo.pos.y,
      slot: slotInfo.slotIndex,
      state: "arriving",
      wait: def.wait * waitScale,
      waitMax: def.wait * waitScale,
      diagnoseTimer: 0,
      repairProgress: 0,
      repairNeed: (3.2 + Math.random() * 1.8) * def.difficulty * hardScale,
      doneTimer: 0,
      spawnedAt: game.elapsed,
      reservedBy: null,
      flash: 0
    });
  }

  function getRepairRate() {
    return 1.2 + game.state.repairLevel * 0.3;
  }

  function getMoveSpeed() {
    return 165 + game.state.speedLevel * 28;
  }

  function getValueMultiplier() {
    return 1 + (game.state.valueLevel - 1) * 0.18;
  }

  function getComboMultiplier() {
    return 1 + (game.state.combo - 1) * 0.08;
  }

  function startDiagnose(aircraft, actor = "player") {
    if (aircraft.state !== "waiting") return;
    aircraft.state = "diagnosing";
    aircraft.diagnoseTimer = 1 + Math.random() * 0.7;
    aircraft.reservedBy = actor;
    aircraft.flash = 0.4;
    showToast(`${aircraft.repairType} issue detected`);
  }

  function finishRepair(aircraft, byWorker = false) {
    aircraft.state = "done";
    aircraft.doneTimer = 16;
    aircraft.flash = 0.6;
    if (byWorker) {
      collectPayment(aircraft, true);
    } else {
      playSound("repair");
      showToast("Repair complete! Collect payment");
      vibrate(25);
    }
  }

  function collectPayment(aircraft, auto = false) {
    if (aircraft.state !== "done") return;

    const base = aircraft.def.payment;
    const speedBonus = clamp((aircraft.wait / aircraft.waitMax) * 0.5, 0, 0.5);
    const payoutRaw = base * getValueMultiplier() * getComboMultiplier() * (1 + speedBonus);
    const payout = Math.floor(auto ? payoutRaw * 0.9 : payoutRaw);

    game.state.money += payout;
    game.state.totalRepairs += 1;

    const repairDuration = game.elapsed - aircraft.spawnedAt;
    if (repairDuration < 24) {
      game.state.combo = clamp(game.state.combo + 0.25, 1, 6);
      game.state.comboTimer = 12;
    } else {
      game.state.combo = Math.max(1, game.state.combo - 0.1);
    }

    addXP(Math.floor(26 * aircraft.def.difficulty));
    playSound("cash");
    showToast(`+${fmtMoney(payout)}`);
    vibrate(18);

    aircraft.state = "departing";
  }

  function failAircraft(aircraft) {
    aircraft.state = "departing";
    game.state.combo = 1;
    showToast(`${aircraft.typeName} left unhappy`);
    playSound("alert");
  }

  function nearestInteractable() {
    let target = null;
    let best = Infinity;
    for (const a of game.aircraft) {
      if (!["waiting", "diagnosing", "repairing", "done"].includes(a.state)) continue;
      const d = dist(game.player, a);
      if (d < best) {
        best = d;
        target = a;
      }
    }
    return { target, distance: best };
  }

  function tryInteract() {
    const nearest = nearestInteractable();
    if (!nearest.target || nearest.distance > INTERACT_RANGE) return;
    const a = nearest.target;

    if (a.state === "waiting") {
      startDiagnose(a, "player");
    } else if (a.state === "done") {
      collectPayment(a, false);
    }
  }

  function tapAircraftInteraction(point) {
    let hit = null;
    for (const a of game.aircraft) {
      if (!["waiting", "diagnosing", "repairing", "done"].includes(a.state)) continue;
      if (Math.abs(a.x - point.x) < 54 && Math.abs(a.y - point.y) < 44) {
        hit = a;
      }
    }
    if (!hit) return false;
    game.input.tapTarget = { x: hit.x, y: hit.y };
    if (dist(game.player, hit) < INTERACT_RANGE + 30) {
      if (hit.state === "waiting") startDiagnose(hit, "player");
      if (hit.state === "done") collectPayment(hit, false);
    }
    return true;
  }

  function showToast(text) {
    toast.textContent = text;
    toast.classList.remove("hidden");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.add("hidden");
    }, 1200);
  }

  function updateWorkers(dt) {
    const needed = game.state.workerLevel;

    while (game.workers.length < needed) {
      game.workers.push({
        x: rand(130, 260),
        y: rand(500, 730),
        targetId: null,
        pulse: Math.random() * Math.PI * 2
      });
    }

    if (game.workers.length > needed) {
      game.workers.length = needed;
    }

    for (const worker of game.workers) {
      worker.pulse += dt * 3;

      let target = game.aircraft.find((a) => a.id === worker.targetId && ["waiting", "diagnosing", "repairing", "done"].includes(a.state));
      if (!target) {
        let best = null;
        let bestScore = Infinity;
        for (const a of game.aircraft) {
          if (!["waiting", "diagnosing", "repairing", "done"].includes(a.state)) continue;
          const score = dist(worker, a);
          if (score < bestScore) {
            bestScore = score;
            best = a;
          }
        }
        target = best;
        worker.targetId = target ? target.id : null;
      }

      if (!target) continue;

      const dx = target.x - worker.x;
      const dy = target.y - worker.y;
      const d = Math.hypot(dx, dy);
      const speed = 120;

      if (d > 26) {
        worker.x += (dx / d) * speed * dt;
        worker.y += (dy / d) * speed * dt;
      } else {
        if (target.state === "waiting") {
          startDiagnose(target, "worker");
        } else if (target.state === "diagnosing") {
          target.diagnoseTimer -= dt * 0.8;
        } else if (target.state === "repairing") {
          target.repairProgress += dt * 0.7;
        } else if (target.state === "done") {
          collectPayment(target, true);
        }
      }
    }
  }

  function updateAircraft(dt) {
    for (let i = game.aircraft.length - 1; i >= 0; i -= 1) {
      const a = game.aircraft[i];
      if (a.flash > 0) a.flash -= dt;

      if (a.state === "arriving") {
        const dx = a.targetX - a.x;
        const step = dt * 180;
        if (Math.abs(dx) <= step) {
          a.x = a.targetX;
          a.state = "waiting";
        } else {
          a.x += Math.sign(dx) * step;
        }
      }

      if (["waiting", "diagnosing", "repairing"].includes(a.state)) {
        a.wait -= dt;
        if (a.wait <= 0) {
          failAircraft(a);
        }
      }

      if (a.state === "diagnosing") {
        a.diagnoseTimer -= dt;
        if (a.diagnoseTimer <= 0) {
          a.state = "repairing";
        }
      }

      if (a.state === "repairing") {
        const close = dist(game.player, a) < INTERACT_RANGE;
        if (close && game.input.actionHeld) {
          a.repairProgress += dt * getRepairRate();
        }

        if (a.repairProgress >= a.repairNeed) {
          finishRepair(a, false);
        }
      }

      if (a.state === "done") {
        a.doneTimer -= dt;
        if (a.doneTimer <= 0) {
          collectPayment(a, true);
        }
      }

      if (a.state === "departing") {
        a.x += dt * 220;
        if (a.x > game.width + 140) {
          game.aircraft.splice(i, 1);
        }
      }
    }
  }

  function updatePlayer(dt) {
    const input = game.input;
    const keys = input.keys;
    let dx = 0;
    let dy = 0;

    if (keys.w || keys.arrowup) dy -= 1;
    if (keys.s || keys.arrowdown) dy += 1;
    if (keys.a || keys.arrowleft) dx -= 1;
    if (keys.d || keys.arrowright) dx += 1;

    if (input.joystickActive) {
      dx += input.joyX;
      dy += input.joyY;
    }

    if (input.tapTarget && Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
      const tx = input.tapTarget.x;
      const ty = input.tapTarget.y;
      const mdx = tx - game.player.x;
      const mdy = ty - game.player.y;
      const d = Math.hypot(mdx, mdy);
      if (d > 8) {
        dx += mdx / d;
        dy += mdy / d;
      } else {
        input.tapTarget = null;
      }
    }

    if (dx !== 0 || dy !== 0) {
      const m = Math.hypot(dx, dy);
      dx /= m;
      dy /= m;
    }

    const speed = getMoveSpeed();
    game.player.x = clamp(game.player.x + dx * speed * dt, 44, game.width - 44);
    game.player.y = clamp(game.player.y + dy * speed * dt, 44, game.height - 44);

    game.player.vx = dx;
    game.player.vy = dy;
    if (dx > 0.1) game.player.dir = 1;
    if (dx < -0.1) game.player.dir = -1;
    if (Math.abs(dx) + Math.abs(dy) > 0.06) game.player.step += dt * 9;
  }

  function updateCamera() {
    game.cameraX = clamp(game.player.x - game.viewWidth * 0.5, 0, Math.max(0, game.width - game.viewWidth));
    game.cameraY = clamp(game.player.y - game.viewHeight * 0.5, 0, Math.max(0, game.height - game.viewHeight));
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, game.viewWidth, game.viewHeight);
    g.addColorStop(0, "#2f5266");
    g.addColorStop(0.55, "#21374e");
    g.addColorStop(1, "#111d31");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, game.viewWidth, game.viewHeight);

    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    for (let i = -120; i < game.viewWidth + 120; i += 160) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 120, game.viewHeight);
      ctx.lineTo(i + 80, game.viewHeight);
      ctx.lineTo(i - 40, 0);
      ctx.closePath();
      ctx.fill();
    }

    ctx.save();
    ctx.translate(-game.cameraX, -game.cameraY);

    const floorGrad = ctx.createLinearGradient(60, 60, game.width - 60, game.height - 60);
    floorGrad.addColorStop(0, "#2f495f");
    floorGrad.addColorStop(1, "#203449");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(60, 60, game.width - 120, game.height - 120);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    for (let x = 80; x < game.width - 80; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, game.height - 80);
      ctx.stroke();
    }
    for (let y = 80; y < game.height - 80; y += 56) {
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(game.width - 80, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#657487";
    ctx.fillRect(88, 88, 54, game.height - 176);
    ctx.fillRect(game.width - 142, 88, 54, game.height - 176);

    ctx.fillStyle = "rgba(12, 20, 30, 0.4)";
    ctx.fillRect(142, 88, 20, game.height - 176);
    ctx.fillRect(game.width - 162, 88, 20, game.height - 176);

    ctx.fillStyle = "rgba(255, 204, 88, 0.24)";
    for (let y = 130; y < game.height - 130; y += 180) {
      fillRoundedRect(178, y, game.width - 356, 10, 5);
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(80, 80, game.width - 160, 24);
    ctx.fillRect(80, game.height - 104, game.width - 160, 24);

    ctx.restore();
  }

  function drawAircraft(a) {
    const p = worldToScreen(a.x, a.y);
    const size = 54 * a.def.size;

    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 26, size * 1.04, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    const flashAlpha = a.flash > 0 ? 0.22 * Math.sin(a.flash * 16) + 0.25 : 0;
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.abs(flashAlpha)})`;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.05, 0, Math.PI * 2);
      ctx.fill();
    }

    const bodyGrad = ctx.createLinearGradient(-size, -size * 0.7, size, size * 0.7);
    bodyGrad.addColorStop(0, "#f4fbff");
    bodyGrad.addColorStop(0.45, a.def.color);
    bodyGrad.addColorStop(1, "#1d3248");

    if (a.key === "small") {
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.94);
      ctx.lineTo(size * 0.22, -size * 0.35);
      ctx.lineTo(size * 0.95, size * 0.2);
      ctx.lineTo(size * 0.12, size * 0.85);
      ctx.lineTo(-size * 0.12, size * 0.85);
      ctx.lineTo(-size * 0.95, size * 0.2);
      ctx.lineTo(-size * 0.22, -size * 0.35);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#1f3246";
      ctx.fillRect(-size * 0.95, -size * 0.02, size * 1.9, size * 0.15);
      ctx.fillRect(-size * 0.07, -size * 0.5, size * 0.14, size * 1.2);
    }

    if (a.key === "helicopter") {
      ctx.fillStyle = bodyGrad;
      fillRoundedRect(-size * 0.5, -size * 0.42, size, size * 0.95, size * 0.2);
      ctx.fillRect(-size * 0.9, -size * 0.06, size * 1.8, size * 0.18);
      ctx.fillStyle = "#152735";
      ctx.fillRect(-size * 0.08, -size * 0.86, size * 0.16, size * 0.48);
      ctx.fillRect(-size * 1.04, -size * 0.9, size * 2.08, size * 0.08);
      ctx.fillStyle = "#95a9b8";
      ctx.fillRect(-size * 0.9, size * 0.56, size * 1.8, size * 0.08);
    }

    if (a.key === "jet") {
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.26, -size * 0.2);
      ctx.lineTo(size * 0.82, size * 0.2);
      ctx.lineTo(size * 0.2, size * 0.84);
      ctx.lineTo(-size * 0.2, size * 0.84);
      ctx.lineTo(-size * 0.82, size * 0.2);
      ctx.lineTo(-size * 0.26, -size * 0.2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#192a3a";
      ctx.fillRect(-size * 1.02, -size * 0.06, size * 2.04, size * 0.16);
      ctx.fillRect(-size * 0.1, -size * 0.54, size * 0.2, size * 1.28);
      ctx.fillStyle = "#ffb156";
      ctx.fillRect(-size * 0.16, size * 0.56, size * 0.32, size * 0.2);
    }

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    fillRoundedRect(-size * 0.24, -size * 0.52, size * 0.48, size * 0.2, size * 0.08);

    ctx.restore();

    const barW = 96;
    const barX = p.x - barW / 2;
    const barY = p.y - size - 30;

    ctx.fillStyle = "rgba(0,0,0,0.42)";
    fillRoundedRect(barX, barY, barW, 12, 6);

    if (a.state === "repairing") {
      const ratio = clamp(a.repairProgress / a.repairNeed, 0, 1);
      ctx.fillStyle = "#56d8c5";
      fillRoundedRect(barX, barY, barW * ratio, 12, 6);
      ctx.fillStyle = "#dff6ff";
      ctx.font = "12px Manrope";
      ctx.fillText(`Repair ${Math.floor(ratio * 100)}%`, barX, barY - 5);
    } else {
      const ratio = clamp(a.wait / a.waitMax, 0, 1);
      ctx.fillStyle = ratio < 0.3 ? "#ff7e6b" : "#ffc94d";
      fillRoundedRect(barX, barY, barW * ratio, 12, 6);
      ctx.fillStyle = "#dff6ff";
      ctx.font = "12px Manrope";
      if (a.state === "waiting") {
        ctx.fillText(`${a.repairType} check`, barX, barY - 5);
      } else if (a.state === "diagnosing") {
        ctx.fillText("Diagnosing...", barX, barY - 5);
      } else if (a.state === "done") {
        ctx.fillText("Ready for payment", barX, barY - 5);
      }
    }
  }

  function drawPlayer() {
    const p = worldToScreen(game.player.x, game.player.y);
    const bob = Math.sin(game.player.step) * 2.4;

    ctx.save();
    ctx.translate(p.x, p.y + bob);

    ctx.fillStyle = "rgba(0, 0, 0, 0.33)";
    ctx.beginPath();
    ctx.ellipse(0, 30, 23, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffdb84";
    ctx.beginPath();
    ctx.arc(0, -18, 12, 0, Math.PI * 2);
    ctx.fill();

    const suitGrad = ctx.createLinearGradient(-16, -10, 16, 28);
    suitGrad.addColorStop(0, "#49b6ff");
    suitGrad.addColorStop(1, "#2f7bc0");
    ctx.fillStyle = suitGrad;
    fillRoundedRect(-16, -6, 32, 30, 8);

    ctx.fillStyle = "#1f2f42";
    const armOffset = Math.sin(game.player.step * 1.2) * 6;
    fillRoundedRect(-22, 2 + armOffset, 8, 17, 4);
    fillRoundedRect(14, 2 - armOffset, 8, 17, 4);

    ctx.fillStyle = "#182634";
    fillRoundedRect(-13, 24, 10, 14, 4);
    fillRoundedRect(3, 24, 10, 14, 4);

    ctx.fillStyle = "#d8e6ff";
    fillRoundedRect(game.player.dir > 0 ? 10 : -17, -2, 8, 6, 3);

    ctx.restore();
  }

  function drawWorkers() {
    for (const worker of game.workers) {
      const p = worldToScreen(worker.x, worker.y);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = "rgba(0,0,0,0.24)";
      ctx.beginPath();
      ctx.ellipse(0, 20, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#83f0cf";
      ctx.beginPath();
      ctx.arc(0, -8 + Math.sin(worker.pulse) * 1.8, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#12303f";
      fillRoundedRect(-10, 5, 20, 15, 5);
      ctx.restore();
    }
  }

  function fillRoundedRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    ctx.fill();
  }

  function drawInteractionHint() {
    const nearest = nearestInteractable();
    if (!nearest.target || nearest.distance > INTERACT_RANGE + 30) return;

    const a = nearest.target;
    const p = worldToScreen(a.x, a.y - 72);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(9, 16, 24, 0.72)";
    fillRoundedRect(p.x - 58, p.y - 18, 116, 26, 10);
    ctx.fillStyle = "#eff7ff";
    ctx.font = "12px Manrope";
    const msg = a.state === "done" ? "Hold to collect" : "Hold to repair";
    ctx.fillText(msg, p.x - 42, p.y);
    ctx.restore();
  }

  function drawHUDMarkers() {
    ctx.save();
    ctx.translate(-game.cameraX, -game.cameraY);
    const slots = computeSlots();
    for (let i = 0; i < slots.length; i += 1) {
      const s = slots[i];
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(s.x - 68, s.y - 50, 136, 100);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawScene() {
    drawBackground();
    drawHUDMarkers();
    for (const a of game.aircraft) drawAircraft(a);
    drawWorkers();
    drawPlayer();
    drawInteractionHint();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    game.viewWidth = canvas.clientWidth;
    game.viewHeight = canvas.clientHeight;
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function updateUI() {
    moneyValue.textContent = fmtMoney(game.state.money);
    levelValue.textContent = `${game.state.level}`;
    xpText.textContent = `${Math.floor(game.state.xp)} / ${game.state.xpToNext} XP`;
    xpFill.style.width = `${(game.state.xp / game.state.xpToNext) * 100}%`;
    comboValue.textContent = `x${getComboMultiplier().toFixed(1)}`;
  }

  function updateUpgradeUI() {
    const defs = [
      {
        id: "speed",
        title: "Mechanic Speed",
        desc: `Move faster across the hangar (Lv ${game.state.speedLevel})`,
        cost: Math.floor(120 * Math.pow(1.55, game.state.speedLevel - 1)),
        onBuy: () => {
          game.state.speedLevel += 1;
        },
        available: true
      },
      {
        id: "repair",
        title: "Tool Upgrade",
        desc: `Boost repair speed (Lv ${game.state.repairLevel})`,
        cost: Math.floor(140 * Math.pow(1.6, game.state.repairLevel - 1)),
        onBuy: () => {
          game.state.repairLevel += 1;
        },
        available: true
      },
      {
        id: "value",
        title: "Premium Parts",
        desc: `Increase payout per repair (Lv ${game.state.valueLevel})`,
        cost: Math.floor(160 * Math.pow(1.62, game.state.valueLevel - 1)),
        onBuy: () => {
          game.state.valueLevel += 1;
        },
        available: true
      },
      {
        id: "hangar",
        title: "Expand Hangar",
        desc: `More parking slots (Lv ${game.state.hangarLevel})`,
        cost: Math.floor(320 * Math.pow(1.78, game.state.hangarLevel - 1)),
        onBuy: () => {
          game.state.hangarLevel += 1;
        },
        available: true
      },
      {
        id: "worker",
        title: "Hire Worker",
        desc: `Auto-repair nearby aircraft (${game.state.workerLevel}/${MAX_WORKERS})`,
        cost: Math.floor(440 * Math.pow(1.86, game.state.workerLevel)),
        onBuy: () => {
          game.state.workerLevel += 1;
        },
        available: game.state.workerLevel < MAX_WORKERS
      },
      {
        id: "unlockHelicopter",
        title: "Unlock Helicopters",
        desc: "Higher challenge and payout.",
        cost: 900,
        onBuy: () => {
          game.state.unlockHelicopter = true;
        },
        available: !game.state.unlockHelicopter
      },
      {
        id: "unlockJet",
        title: "Unlock Jets",
        desc: "Top-tier contracts and big money.",
        cost: 2200,
        onBuy: () => {
          game.state.unlockJet = true;
        },
        available: !game.state.unlockJet && game.state.unlockHelicopter
      }
    ];

    upgradeList.innerHTML = "";
    for (const def of defs) {
      const item = document.createElement("div");
      item.className = "upgrade-item";
      const details = document.createElement("div");
      details.innerHTML = `<strong>${def.title}</strong><small>${def.desc}</small>`;
      const btn = document.createElement("button");
      btn.textContent = def.available ? `Buy ${fmtMoney(def.cost)}` : "Maxed";
      btn.disabled = !def.available || game.state.money < def.cost;
      btn.addEventListener("click", () => {
        if (!def.available || game.state.money < def.cost) return;
        game.state.money -= def.cost;
        def.onBuy();
        playSound("upgrade");
        showToast(`${def.title} upgraded`);
        updateUpgradeUI();
      });
      item.appendChild(details);
      item.appendChild(btn);
      upgradeList.appendChild(item);
    }
  }

  function saveGame() {
    const payload = {
      state: game.state,
      elapsed: game.elapsed,
      settings: game.settings
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(game.settings));
  }

  function loadGame() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.state) {
        game.state = {
          ...game.state,
          ...data.state
        };
      }
      if (typeof data.elapsed === "number") {
        game.elapsed = data.elapsed;
      }
      if (data.settings) {
        game.settings = {
          ...game.settings,
          ...data.settings
        };
      }
    } catch (_err) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function claimDailyReward() {
    const key = todayKey();
    if (game.state.lastDailyClaim === key) return;
    const reward = 180 + game.state.level * 22;
    game.state.money += reward;
    addXP(42 + game.state.level * 3);
    game.state.lastDailyClaim = key;
    showToast(`Daily reward ${fmtMoney(reward)}`);
    playSound("cash");
  }

  function checkDailyRewardPrompt() {
    const key = todayKey();
    if (game.state.lastDailyClaim !== key) {
      const reward = 180 + game.state.level * 22;
      dailyText.textContent = `Claim ${fmtMoney(reward)} and bonus XP for today's shift.`;
      dailyModal.showModal();
    }
  }

  function updateIdleIncome(dt) {
    game.idleTimer += dt;
    if (game.idleTimer < 1) return;
    game.idleTimer = 0;
    const amount = (game.state.workerLevel * 5) + (game.state.hangarLevel * 2);
    if (amount > 0) {
      game.state.money += amount;
    }
  }

  function updateCombo(dt) {
    if (game.state.combo > 1) {
      game.state.comboTimer -= dt;
      if (game.state.comboTimer <= 0) {
        game.state.combo = Math.max(1, game.state.combo - 0.2);
        game.state.comboTimer = 2.5;
      }
    }
  }

  function updateSpawn(dt) {
    game.spawnTimer += dt;
    const difficultyRamp = clamp(game.elapsed * 0.008, 0, 5);
    const minInterval = 2.4;
    const interval = Math.max(minInterval, game.spawnBase - difficultyRamp);
    if (game.spawnTimer >= interval) {
      game.spawnTimer = 0;
      spawnAircraft();
    }
  }

  function update(dt) {
    game.elapsed += dt;
    game.time += dt;

    const size = getWorldSize();
    game.width = size.width;
    game.height = size.height;

    updatePlayer(dt);
    updateWorkers(dt);
    updateAircraft(dt);
    updateSpawn(dt);
    updateIdleIncome(dt);
    updateCombo(dt);
    updateCamera();

    game.saveTimer += dt;
    if (game.saveTimer > 2) {
      game.saveTimer = 0;
      saveGame();
    }

    updateUI();
  }

  function frame(now) {
    if (!frame.last) frame.last = now;
    const dt = clamp((now - frame.last) / 1000, 0, 0.05);
    frame.last = now;

    update(dt);
    drawScene();
    requestAnimationFrame(frame);
  }

  function handlePointerDown(ev) {
    ensureAudio();
    game.input.pointerDown = true;

    if (ev.target === canvas) {
      const p = screenToWorld(ev.clientX, ev.clientY);
      const hit = tapAircraftInteraction(p);
      if (!hit) {
        game.input.tapTarget = p;
      }
    }
  }

  function setupControls() {
    window.addEventListener("keydown", (ev) => {
      const key = ev.key.toLowerCase();
      game.input.keys[key] = true;
      if (key === " " || key === "e") {
        game.input.actionHeld = true;
      }
      if (key === "f") {
        toggleFullscreen();
      }
      if (key === "u") {
        openUpgradeModal();
      }
      if (key === "escape") {
        if (upgradeModal.open) upgradeModal.close();
        if (settingsModal.open) settingsModal.close();
      }
    });

    window.addEventListener("keyup", (ev) => {
      const key = ev.key.toLowerCase();
      game.input.keys[key] = false;
      if (key === " " || key === "e") {
        game.input.actionHeld = false;
      }
    });

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", (ev) => {
      if (!game.input.pointerDown) return;
      if (ev.pointerType === "mouse") return;
      const p = screenToWorld(ev.clientX, ev.clientY);
      game.input.tapTarget = p;
    });
    window.addEventListener("pointerup", () => {
      game.input.pointerDown = false;
    });

    interactBtn.addEventListener("pointerdown", () => {
      ensureAudio();
      game.input.actionHeld = true;
      tryInteract();
    });
    interactBtn.addEventListener("pointerup", () => {
      game.input.actionHeld = false;
    });
    interactBtn.addEventListener("pointercancel", () => {
      game.input.actionHeld = false;
    });
    interactBtn.addEventListener("click", () => {
      tryInteract();
    });

    const joy = {
      activeId: null,
      centerX: 0,
      centerY: 0,
      radius: 54
    };

    function resetJoy() {
      game.input.joystickActive = false;
      game.input.joyX = 0;
      game.input.joyY = 0;
      joystickThumb.style.left = "45px";
      joystickThumb.style.top = "45px";
    }

    joystickArea.addEventListener("pointerdown", (ev) => {
      ensureAudio();
      joy.activeId = ev.pointerId;
      game.input.joystickActive = true;
      const rect = joystickBase.getBoundingClientRect();
      joy.centerX = rect.left + rect.width / 2;
      joy.centerY = rect.top + rect.height / 2;
      joystickArea.setPointerCapture(ev.pointerId);
    });

    joystickArea.addEventListener("pointermove", (ev) => {
      if (!game.input.joystickActive || ev.pointerId !== joy.activeId) return;
      const dx = ev.clientX - joy.centerX;
      const dy = ev.clientY - joy.centerY;
      const d = Math.hypot(dx, dy);
      const limited = d > joy.radius ? joy.radius / d : 1;
      const lx = dx * limited;
      const ly = dy * limited;
      game.input.joyX = lx / joy.radius;
      game.input.joyY = ly / joy.radius;
      joystickThumb.style.left = `${45 + lx}px`;
      joystickThumb.style.top = `${45 + ly}px`;
    });

    function joyEnd(ev) {
      if (ev.pointerId !== joy.activeId) return;
      joy.activeId = null;
      resetJoy();
    }

    joystickArea.addEventListener("pointerup", joyEnd);
    joystickArea.addEventListener("pointercancel", joyEnd);

    upgradeBtn.addEventListener("click", openUpgradeModal);

    settingsBtn.addEventListener("click", () => {
      settingsModal.showModal();
    });

    fullscreenBtn.addEventListener("click", toggleFullscreen);

    claimDailyBtn.addEventListener("click", () => {
      claimDailyReward();
      dailyModal.close();
    });

    soundToggle.addEventListener("change", () => {
      game.settings.sound = soundToggle.checked;
    });

    vibrationToggle.addEventListener("change", () => {
      game.settings.vibration = vibrationToggle.checked;
    });

    window.addEventListener("resize", resize);
    window.addEventListener("beforeunload", saveGame);
  }

  function openUpgradeModal() {
    updateUpgradeUI();
    upgradeModal.showModal();
  }

  async function toggleFullscreen() {
    const root = document.documentElement;
    if (!document.fullscreenElement) {
      try {
        await root.requestFullscreen();
      } catch (_err) {
        showToast("Fullscreen blocked by browser");
      }
    } else {
      await document.exitFullscreen();
    }
  }

  function applyLoadedSettings() {
    soundToggle.checked = game.settings.sound;
    vibrationToggle.checked = game.settings.vibration;
  }

  function runTutorialIfNeeded() {
    if (game.state.tutorialDone) return;
    tutorialModal.showModal();
    tutorialModal.addEventListener("close", () => {
      game.state.tutorialDone = true;
    }, { once: true });
  }

  function init() {
    loadGame();
    setupControls();
    resize();
    applyLoadedSettings();
    runTutorialIfNeeded();
    checkDailyRewardPrompt();

    for (let i = 0; i < 2; i += 1) spawnAircraft();

    updateUpgradeUI();
    updateUI();
    requestAnimationFrame(frame);
  }

  init();
})();
