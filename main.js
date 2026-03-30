(() => {
  const STORAGE_KEY = "aircraft_mechanic_tycoon_save_v1";

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
  const PLAYER_RADIUS = 26;
  const INTERACT_RANGE = 110;
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
      diagnoseLevel: 1,
      patienceLevel: 1,
      comboLevel: 1,
      unlockHelicopter: false,
      unlockJet: false,
      tutorialDone: false,
      workerSpeedLevel: 1,
      atcLevel: 1,
      fuelLevel: 1,
      eliteLevel: 1,
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
    const xGap = Math.max(190, (size.width - 460) / Math.max(cols - 1, 1));
    const yGap = Math.max(190, (size.height - 340) / Math.max(rows - 1, 1));

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
    if (pool.length === 1) return "small";
    // Elite contracts bias toward premium aircraft
    const w = getEliteWeight();
    const weights = pool.map((t) => t === "small" ? 1 : w);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
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
      wait: def.wait * waitScale * getWaitMultiplier(),
      waitMax: def.wait * waitScale * getWaitMultiplier(),
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

  function getDiagnoseSpeed() {
    return 1 + (game.state.diagnoseLevel - 1) * 0.35;
  }

  function getWaitMultiplier() {
    return 1 + (game.state.patienceLevel - 1) * 0.18;
  }

  function getComboMax() {
    return 6 + (game.state.comboLevel - 1);
  }

  function getComboDecay() {
    return Math.max(0.05, 0.2 - (game.state.comboLevel - 1) * 0.03);
  }

  function getWorkerSpeed() {
    return 120 + (game.state.workerSpeedLevel - 1) * 22;
  }

  function getWorkerRepairRate() {
    return 0.7 + (game.state.workerSpeedLevel - 1) * 0.12;
  }

  function getSpawnInterval() {
    const difficultyRamp = clamp(game.elapsed * 0.008, 0, 5);
    const atcBonus = (game.state.atcLevel - 1) * 0.38;
    return Math.max(1.8, game.spawnBase - difficultyRamp - atcBonus);
  }

  function getFuelIdleBonus() {
    return (game.state.fuelLevel - 1) * 6;
  }

  function getEliteWeight() {
    return 1 + (game.state.eliteLevel - 1) * 0.35;
  }

  function startDiagnose(aircraft, actor = "player") {
    if (aircraft.state !== "waiting") return;
    aircraft.state = "diagnosing";
    aircraft.diagnoseTimer = (1 + Math.random() * 0.7) / getDiagnoseSpeed();
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
      game.state.combo = clamp(game.state.combo + 0.25, 1, getComboMax());
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
      if (Math.abs(a.x - point.x) < 70 && Math.abs(a.y - point.y) < 57) {
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
      const speed = getWorkerSpeed();

      if (d > 34) {
        worker.x += (dx / d) * speed * dt;
        worker.y += (dy / d) * speed * dt;
      } else {
        if (target.state === "waiting") {
          startDiagnose(target, "worker");
        } else if (target.state === "diagnosing") {
          target.diagnoseTimer -= dt * 0.8 * getDiagnoseSpeed();
        } else if (target.state === "repairing") {
          target.repairProgress += dt * getWorkerRepairRate();
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

    // Overhead light fixtures and floor pools
    const numLights = 5;
    for (let li = 0; li < numLights; li++) {
      const lx = 200 + (li / (numLights - 1)) * (game.width - 400);
      const ly = 92;

      // Floor light pool
      const poolGrad = ctx.createRadialGradient(lx, ly + 220, 10, lx, ly + 220, 300);
      poolGrad.addColorStop(0, "rgba(255, 248, 210, 0.13)");
      poolGrad.addColorStop(0.6, "rgba(255, 248, 210, 0.05)");
      poolGrad.addColorStop(1, "transparent");
      ctx.fillStyle = poolGrad;
      ctx.beginPath();
      ctx.ellipse(lx, ly + 220, 260, 280, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fixture glow halo
      const haloGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 40);
      haloGrad.addColorStop(0, "rgba(255, 252, 220, 0.85)");
      haloGrad.addColorStop(0.45, "rgba(255, 235, 170, 0.35)");
      haloGrad.addColorStop(1, "transparent");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(lx, ly, 40, 0, Math.PI * 2);
      ctx.fill();

      // Fixture housing
      ctx.fillStyle = "#3a4d5e";
      ctx.fillRect(lx - 14, ly - 6, 28, 10);
      ctx.fillStyle = "#c8dae8";
      ctx.fillRect(lx - 9, ly, 18, 5);
    }

    ctx.restore();
  }

  function drawAircraft(a) {
    const p = worldToScreen(a.x, a.y);
    const size = 70 * a.def.size;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Drop shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    ctx.beginPath();
    ctx.ellipse(4, 32, size * 1.0, size * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Flash glow
    const flashAlpha = a.flash > 0 ? Math.abs(0.22 * Math.sin(a.flash * 16) + 0.18) : 0;
    if (flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    const c = a.def.color;

    if (a.key === "small") {
      const grad = ctx.createLinearGradient(-size * 0.4, -size, size * 0.4, size);
      grad.addColorStop(0, "#f0faff");
      grad.addColorStop(0.28, c);
      grad.addColorStop(1, "#1a3050");

      // Left swept wing
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-size * 0.07, -size * 0.12);
      ctx.lineTo(-size * 0.88, size * 0.24);
      ctx.lineTo(-size * 0.7, size * 0.38);
      ctx.lineTo(-size * 0.05, size * 0.08);
      ctx.closePath();
      ctx.fill();

      // Right swept wing
      ctx.beginPath();
      ctx.moveTo(size * 0.07, -size * 0.12);
      ctx.lineTo(size * 0.88, size * 0.24);
      ctx.lineTo(size * 0.7, size * 0.38);
      ctx.lineTo(size * 0.05, size * 0.08);
      ctx.closePath();
      ctx.fill();

      // Left horizontal stabilizer
      ctx.beginPath();
      ctx.moveTo(-size * 0.06, size * 0.6);
      ctx.lineTo(-size * 0.38, size * 0.76);
      ctx.lineTo(-size * 0.3, size * 0.86);
      ctx.lineTo(-size * 0.06, size * 0.73);
      ctx.closePath();
      ctx.fill();

      // Right horizontal stabilizer
      ctx.beginPath();
      ctx.moveTo(size * 0.06, size * 0.6);
      ctx.lineTo(size * 0.38, size * 0.76);
      ctx.lineTo(size * 0.3, size * 0.86);
      ctx.lineTo(size * 0.06, size * 0.73);
      ctx.closePath();
      ctx.fill();

      // Fuselage
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.14, size * 0.88, 0, 0, Math.PI * 2);
      ctx.fill();

      // Propeller disc (spinning)
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "rgba(210, 230, 255, 0.85)";
      ctx.lineWidth = 3;
      ctx.save();
      ctx.rotate(game.time * 14);
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.22);
      ctx.lineTo(0, size * 0.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.18, -size * 0.12);
      ctx.lineTo(size * 0.18, size * 0.12);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.restore();

      // Cockpit window
      ctx.fillStyle = "rgba(120, 200, 255, 0.78)";
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.46, size * 0.1, size * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.ellipse(-size * 0.03, -size * 0.5, size * 0.04, size * 0.06, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Wing leading-edge highlight
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-size * 0.07, -size * 0.12);
      ctx.lineTo(-size * 0.84, size * 0.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(size * 0.07, -size * 0.12);
      ctx.lineTo(size * 0.84, size * 0.22);
      ctx.stroke();
    }

    if (a.key === "helicopter") {
      const grad = ctx.createLinearGradient(-size * 0.4, -size * 0.5, size * 0.4, size * 0.5);
      grad.addColorStop(0, "#e8fff2");
      grad.addColorStop(0.32, c);
      grad.addColorStop(1, "#143325");

      // Tail boom
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-size * 0.11, size * 0.24);
      ctx.lineTo(size * 0.11, size * 0.24);
      ctx.lineTo(size * 0.055, size * 0.88);
      ctx.lineTo(-size * 0.055, size * 0.88);
      ctx.closePath();
      ctx.fill();

      // Main cabin body
      ctx.fillStyle = grad;
      fillRoundedRect(-size * 0.4, -size * 0.36, size * 0.8, size * 0.66, size * 0.18);

      // Main rotor blades (3-blade, animated)
      ctx.save();
      ctx.rotate(game.time * 4.5);
      ctx.strokeStyle = "rgba(30, 45, 35, 0.82)";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      for (let b = 0; b < 3; b++) {
        ctx.save();
        ctx.rotate((b / 3) * Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.09);
        ctx.lineTo(0, -size * 0.95);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Rotor hub
      ctx.fillStyle = "#263830";
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4a6050";
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.05, 0, Math.PI * 2);
      ctx.fill();

      // Tail rotor (small, animated)
      ctx.save();
      ctx.translate(0, size * 0.88);
      ctx.rotate(game.time * 9);
      ctx.strokeStyle = "rgba(30, 45, 35, 0.75)";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.19);
      ctx.lineTo(0, size * 0.19);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.19, 0);
      ctx.lineTo(size * 0.19, 0);
      ctx.stroke();
      ctx.restore();

      // Skid struts
      ctx.strokeStyle = "#1e2e28";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-size * 0.46, size * 0.22);
      ctx.lineTo(-size * 0.46, -size * 0.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(size * 0.46, size * 0.22);
      ctx.lineTo(size * 0.46, -size * 0.12);
      ctx.stroke();
      // Skid rails
      ctx.beginPath();
      ctx.moveTo(-size * 0.52, -size * 0.1);
      ctx.lineTo(-size * 0.24, -size * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(size * 0.52, -size * 0.1);
      ctx.lineTo(size * 0.24, -size * 0.1);
      ctx.stroke();

      // Front windshield
      ctx.fillStyle = "rgba(120, 205, 255, 0.74)";
      fillRoundedRect(-size * 0.28, -size * 0.3, size * 0.56, size * 0.24, size * 0.07);
      ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
      ctx.beginPath();
      ctx.ellipse(-size * 0.07, -size * 0.25, size * 0.12, size * 0.05, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (a.key === "jet") {
      const grad = ctx.createLinearGradient(-size * 0.5, -size, size * 0.5, size * 0.7);
      grad.addColorStop(0, "#fff5ee");
      grad.addColorStop(0.28, c);
      grad.addColorStop(1, "#2a1808");

      // Delta wing body
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.16, -size * 0.58);
      ctx.lineTo(size * 0.9, size * 0.5);
      ctx.lineTo(size * 0.42, size * 0.6);
      ctx.lineTo(size * 0.14, size * 0.82);
      ctx.lineTo(-size * 0.14, size * 0.82);
      ctx.lineTo(-size * 0.42, size * 0.6);
      ctx.lineTo(-size * 0.9, size * 0.5);
      ctx.lineTo(-size * 0.16, -size * 0.58);
      ctx.closePath();
      ctx.fill();

      // Fuselage center spine
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.18, size * 0.07, size * 0.74, 0, 0, Math.PI * 2);
      ctx.fill();

      // Engine exhaust glow
      const engineBright = a.state === "done" ? 1.0 : 0.55;
      const exGrad1 = ctx.createRadialGradient(-size * 0.28, size * 0.72, 0, -size * 0.28, size * 0.72, size * 0.15);
      exGrad1.addColorStop(0, `rgba(255, 180, 50, ${engineBright})`);
      exGrad1.addColorStop(0.5, `rgba(255, 100, 20, ${engineBright * 0.6})`);
      exGrad1.addColorStop(1, "transparent");
      ctx.fillStyle = exGrad1;
      ctx.beginPath();
      ctx.ellipse(-size * 0.28, size * 0.74, size * 0.1, size * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();

      const exGrad2 = ctx.createRadialGradient(size * 0.28, size * 0.72, 0, size * 0.28, size * 0.72, size * 0.15);
      exGrad2.addColorStop(0, `rgba(255, 180, 50, ${engineBright})`);
      exGrad2.addColorStop(0.5, `rgba(255, 100, 20, ${engineBright * 0.6})`);
      exGrad2.addColorStop(1, "transparent");
      ctx.fillStyle = exGrad2;
      ctx.beginPath();
      ctx.ellipse(size * 0.28, size * 0.74, size * 0.1, size * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();

      // Canopy
      ctx.fillStyle = "rgba(120, 200, 255, 0.76)";
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.5, size * 0.09, size * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.48)";
      ctx.beginPath();
      ctx.ellipse(-size * 0.03, -size * 0.56, size * 0.04, size * 0.08, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Wing leading-edge highlights
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.9, size * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(-size * 0.9, size * 0.5);
      ctx.stroke();
    }

    ctx.restore();

    const barW = 120;
    const barX = p.x - barW / 2;
    const barY = p.y - size - 36;

    ctx.fillStyle = "rgba(0,0,0,0.52)";
    fillRoundedRect(barX - 1, barY - 1, barW + 2, 14, 7);

    if (a.state === "repairing") {
      const ratio = clamp(a.repairProgress / a.repairNeed, 0, 1);
      const rGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      rGrad.addColorStop(0, "#56d8c5");
      rGrad.addColorStop(1, "#8affcd");
      ctx.fillStyle = rGrad;
      fillRoundedRect(barX, barY, barW * ratio, 12, 6);
      ctx.fillStyle = "#dff6ff";
      ctx.font = "bold 11px Manrope";
      ctx.fillText(`Repair ${Math.floor(ratio * 100)}%`, barX, barY - 5);
    } else {
      const ratio = clamp(a.wait / a.waitMax, 0, 1);
      ctx.fillStyle = ratio < 0.3 ? "#ff7e6b" : ratio < 0.55 ? "#ffc94d" : "#72e88a";
      fillRoundedRect(barX, barY, barW * ratio, 12, 6);
      ctx.fillStyle = a.state === "done" ? "#ffd700" : "#dff6ff";
      ctx.font = "bold 11px Manrope";
      if (a.state === "waiting") ctx.fillText(`${a.repairType} check`, barX, barY - 5);
      else if (a.state === "diagnosing") ctx.fillText("Diagnosing...", barX, barY - 5);
      else if (a.state === "done") ctx.fillText("Collect payment!", barX, barY - 5);
    }
  }

  function drawPlayer() {
    const p = worldToScreen(game.player.x, game.player.y);
    const bob = Math.sin(game.player.step) * 2.8;
    const armSwing = Math.sin(game.player.step * 1.1) * 7;

    ctx.save();
    ctx.translate(p.x, p.y + bob);

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 38, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = "#182634";
    fillRoundedRect(-14, 26, 11, 18, 4);
    fillRoundedRect(3, 26, 11, 18, 4);
    // Boots
    ctx.fillStyle = "#0d1a28";
    fillRoundedRect(-15, 40, 12, 7, 3);
    fillRoundedRect(3, 40, 12, 7, 3);

    // Body — hi-vis vest
    const vestGrad = ctx.createLinearGradient(-15, -10, 15, 28);
    vestGrad.addColorStop(0, "#ffd428");
    vestGrad.addColorStop(0.4, "#e8a500");
    vestGrad.addColorStop(1, "#b07600");
    ctx.fillStyle = vestGrad;
    fillRoundedRect(-15, -10, 30, 37, 7);

    // Reflective stripes
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    fillRoundedRect(-15, 3, 30, 4, 2);
    fillRoundedRect(-15, 14, 30, 4, 2);

    // Arms
    ctx.fillStyle = "#1e4060";
    fillRoundedRect(-24, -5 + armSwing, 10, 22, 4);
    fillRoundedRect(14, -5 - armSwing, 10, 22, 4);
    // Gloves
    ctx.fillStyle = "#d05a16";
    fillRoundedRect(-24, 14 + armSwing, 10, 7, 3);
    fillRoundedRect(14, 14 - armSwing, 10, 7, 3);

    // Neck
    ctx.fillStyle = "#f0b880";
    fillRoundedRect(-5, -18, 10, 10, 3);

    // Head
    ctx.fillStyle = "#f0b880";
    ctx.beginPath();
    ctx.arc(0, -26, 14, 0, Math.PI * 2);
    ctx.fill();

    // Hard hat dome
    const hatGrad = ctx.createLinearGradient(-14, -44, 14, -30);
    hatGrad.addColorStop(0, "#ffe030");
    hatGrad.addColorStop(0.6, "#e8a500");
    hatGrad.addColorStop(1, "#b07600");
    ctx.fillStyle = hatGrad;
    ctx.beginPath();
    ctx.arc(0, -33, 15, Math.PI, 0);
    ctx.lineTo(16, -26);
    ctx.lineTo(-16, -26);
    ctx.closePath();
    ctx.fill();
    // Hat brim
    ctx.fillStyle = "#b07600";
    ctx.fillRect(-18, -28, 36, 4);
    // Hat shine
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.arc(-4, -38, 5, Math.PI, 0);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#1a0e00";
    ctx.beginPath();
    ctx.arc(-5, -25, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -25, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawWorkers() {
    for (const worker of game.workers) {
      const p = worldToScreen(worker.x, worker.y);
      const bob = Math.sin(worker.pulse) * 1.6;
      ctx.save();
      ctx.translate(p.x, p.y + bob);

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(0, 28, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.fillStyle = "#163828";
      fillRoundedRect(-11, 16, 9, 14, 3);
      fillRoundedRect(2, 16, 9, 14, 3);

      // Body (green overalls)
      const bodyGrad = ctx.createLinearGradient(-11, -6, 11, 18);
      bodyGrad.addColorStop(0, "#88efbf");
      bodyGrad.addColorStop(1, "#288060");
      ctx.fillStyle = bodyGrad;
      fillRoundedRect(-12, -6, 24, 24, 6);

      // Arms
      ctx.fillStyle = "#1e6040";
      fillRoundedRect(-20, -4, 9, 16, 3);
      fillRoundedRect(11, -4, 9, 16, 3);

      // Head
      ctx.fillStyle = "#fad0a0";
      ctx.beginPath();
      ctx.arc(0, -16, 12, 0, Math.PI * 2);
      ctx.fill();

      // Cyan hard hat
      const helmetGrad = ctx.createLinearGradient(-12, -30, 12, -20);
      helmetGrad.addColorStop(0, "#30d8d0");
      helmetGrad.addColorStop(1, "#0f9898");
      ctx.fillStyle = helmetGrad;
      ctx.beginPath();
      ctx.arc(0, -21, 13, Math.PI, 0);
      ctx.lineTo(14, -17);
      ctx.lineTo(-14, -17);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0c8080";
      ctx.fillRect(-15, -19, 30, 3);
      // Helmet shine
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.arc(-3, -26, 4, Math.PI, 0);
      ctx.fill();

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
    let msg;
    if (a.state === "waiting") msg = "Tap to diagnose";
    else if (a.state === "diagnosing") msg = "Diagnosing...";
    else if (a.state === "repairing") msg = "Hold to repair";
    else msg = "Tap to collect";
    ctx.fillText(msg, p.x - 48, p.y);
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
      ctx.strokeRect(s.x - 88, s.y - 65, 176, 130);
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

    const nearest = nearestInteractable();
    const inRange = nearest.target && nearest.distance <= INTERACT_RANGE + 30;
    interactBtn.classList.remove("ready-diagnose", "ready-repair", "ready-collect");
    if (inRange) {
      const s = nearest.target.state;
      if (s === "waiting") {
        interactBtn.textContent = "Diagnose";
        interactBtn.classList.add("ready-diagnose");
      } else if (s === "repairing") {
        interactBtn.textContent = "Hold to Repair";
        interactBtn.classList.add("ready-repair");
      } else if (s === "done") {
        interactBtn.textContent = "Collect $$$";
        interactBtn.classList.add("ready-collect");
      } else {
        interactBtn.textContent = "Repair / Collect";
      }
    } else {
      interactBtn.textContent = "Repair / Collect";
    }
  }

  function updateUpgradeUI() {
    const CATEGORY_COLORS = {
      operations: "#56d8c5",
      economy: "#fbbf24",
      expansion: "#b89dff",
      contracts: "#ff9f4d"
    };

    const sections = [
      {
        label: "Operations",
        cat: "operations",
        items: [
          {
            id: "speed",
            icon: "👟",
            title: "Mechanic Speed",
            desc: "Move faster across the hangar",
            level: game.state.speedLevel,
            cost: Math.floor(120 * Math.pow(1.55, game.state.speedLevel - 1)),
            onBuy: () => { game.state.speedLevel += 1; },
            available: true
          },
          {
            id: "repair",
            icon: "🔧",
            title: "Tool Upgrade",
            desc: "Boost repair speed",
            level: game.state.repairLevel,
            cost: Math.floor(140 * Math.pow(1.6, game.state.repairLevel - 1)),
            onBuy: () => { game.state.repairLevel += 1; },
            available: true
          },
          {
            id: "diagnose",
            icon: "🔬",
            title: "Diagnostic Tools",
            desc: "Speed up aircraft diagnose time",
            level: game.state.diagnoseLevel,
            cost: Math.floor(130 * Math.pow(1.58, game.state.diagnoseLevel - 1)),
            onBuy: () => { game.state.diagnoseLevel += 1; },
            available: true
          },
          {
            id: "patience",
            icon: "🤝",
            title: "Client Relations",
            desc: "Aircraft wait longer before leaving",
            level: game.state.patienceLevel,
            cost: Math.floor(200 * Math.pow(1.65, game.state.patienceLevel - 1)),
            onBuy: () => { game.state.patienceLevel += 1; },
            available: true
          },
          {
            id: "combo",
            icon: "⚡",
            title: "Combo Training",
            desc: "Raise combo cap and slow decay",
            level: game.state.comboLevel,
            cost: Math.floor(250 * Math.pow(1.7, game.state.comboLevel - 1)),
            onBuy: () => { game.state.comboLevel += 1; },
            available: true
          }
        ]
      },
      {
        label: "Economy",
        cat: "economy",
        items: [
          {
            id: "value",
            icon: "💎",
            title: "Premium Parts",
            desc: "Increase payout per repair",
            level: game.state.valueLevel,
            cost: Math.floor(160 * Math.pow(1.62, game.state.valueLevel - 1)),
            onBuy: () => { game.state.valueLevel += 1; },
            available: true
          },
          {
            id: "fuel",
            icon: "⛽",
            title: "Fuel Bay",
            desc: "Boosts passive idle income",
            level: game.state.fuelLevel,
            cost: Math.floor(420 * Math.pow(1.72, game.state.fuelLevel - 1)),
            onBuy: () => { game.state.fuelLevel += 1; },
            available: true
          },
          {
            id: "elite",
            icon: "⭐",
            title: "Elite Contracts",
            desc: "Higher-value aircraft arrive more often",
            level: game.state.eliteLevel,
            cost: Math.floor(600 * Math.pow(1.8, game.state.eliteLevel - 1)),
            onBuy: () => { game.state.eliteLevel += 1; },
            available: game.state.unlockHelicopter || game.state.unlockJet
          }
        ]
      },
      {
        label: "Hangar & Staff",
        cat: "expansion",
        items: [
          {
            id: "hangar",
            icon: "🏗️",
            title: "Expand Hangar",
            desc: "More parking slots",
            level: game.state.hangarLevel,
            cost: Math.floor(320 * Math.pow(1.78, game.state.hangarLevel - 1)),
            onBuy: () => { game.state.hangarLevel += 1; },
            available: true
          },
          {
            id: "worker",
            icon: "👷",
            title: "Hire Worker",
            desc: `Auto-repair nearby aircraft (${game.state.workerLevel}/${MAX_WORKERS})`,
            level: game.state.workerLevel,
            cost: Math.floor(440 * Math.pow(1.86, game.state.workerLevel)),
            onBuy: () => { game.state.workerLevel += 1; },
            available: game.state.workerLevel < MAX_WORKERS
          },
          {
            id: "workerSpeed",
            icon: "🏃",
            title: "Worker Training",
            desc: "Workers move and repair faster",
            level: game.state.workerSpeedLevel,
            cost: Math.floor(350 * Math.pow(1.7, game.state.workerSpeedLevel - 1)),
            onBuy: () => { game.state.workerSpeedLevel += 1; },
            available: game.state.workerLevel > 0
          },
          {
            id: "atc",
            icon: "📡",
            title: "Air Traffic Control",
            desc: "Aircraft arrive more frequently",
            level: game.state.atcLevel,
            cost: Math.floor(280 * Math.pow(1.65, game.state.atcLevel - 1)),
            onBuy: () => { game.state.atcLevel += 1; },
            available: true
          }
        ]
      },
      {
        label: "Unlock Aircraft",
        cat: "contracts",
        items: [
          {
            id: "unlockHelicopter",
            icon: "🚁",
            title: "Unlock Helicopters",
            desc: "Higher challenge and payout",
            level: game.state.unlockHelicopter ? 1 : 0,
            cost: 900,
            onBuy: () => { game.state.unlockHelicopter = true; },
            available: !game.state.unlockHelicopter
          },
          {
            id: "unlockJet",
            icon: "✈️",
            title: "Unlock Jets",
            desc: "Top-tier contracts and big money",
            level: game.state.unlockJet ? 1 : 0,
            cost: 2200,
            onBuy: () => { game.state.unlockJet = true; },
            available: !game.state.unlockJet && game.state.unlockHelicopter
          }
        ]
      }
    ];

    upgradeList.innerHTML = "";

    for (const section of sections) {
      const accentColor = CATEGORY_COLORS[section.cat];

      const sectionHeader = document.createElement("div");
      sectionHeader.className = "upg-section-label";
      sectionHeader.textContent = section.label;
      sectionHeader.style.setProperty("--upg-accent", accentColor);
      upgradeList.appendChild(sectionHeader);

      for (const def of section.items) {
        const isMaxed = !def.available;
        const canAfford = game.state.money >= def.cost;

        const item = document.createElement("div");
        item.className = `upgrade-item upg-cat-${section.cat}`;
        item.style.setProperty("--upg-accent", accentColor);

        // Icon bubble
        const iconBubble = document.createElement("div");
        iconBubble.className = "upg-icon-bubble";
        iconBubble.textContent = def.icon;

        // Body
        const body = document.createElement("div");
        body.className = "upg-body";

        const titleRow = document.createElement("div");
        titleRow.className = "upg-title-row";

        const titleEl = document.createElement("span");
        titleEl.className = "upg-title";
        titleEl.textContent = def.title;

        const levelBadge = document.createElement("span");
        levelBadge.className = "upg-level-badge";
        if (isMaxed) {
          levelBadge.textContent = "MAX";
          levelBadge.classList.add("maxed");
        } else {
          levelBadge.textContent = `Lv ${def.level}`;
        }

        titleRow.appendChild(titleEl);
        titleRow.appendChild(levelBadge);

        const descEl = document.createElement("small");
        descEl.className = "upg-desc";
        descEl.textContent = def.desc;

        body.appendChild(titleRow);
        body.appendChild(descEl);

        // Buy button
        const btn = document.createElement("button");
        btn.className = "upg-buy-btn";
        if (isMaxed) {
          btn.textContent = "Maxed";
          btn.classList.add("is-maxed");
          btn.disabled = true;
        } else {
          btn.textContent = fmtMoney(def.cost);
          btn.disabled = !canAfford;
          if (!canAfford) btn.classList.add("cant-afford");
        }

        btn.addEventListener("click", () => {
          if (!def.available || game.state.money < def.cost) return;
          game.state.money -= def.cost;
          def.onBuy();
          playSound("upgrade");
          showToast(`${def.title} upgraded!`);
          updateUpgradeUI();
        });

        item.appendChild(iconBubble);
        item.appendChild(body);
        item.appendChild(btn);
        upgradeList.appendChild(item);
      }
    }
  }

  function saveGame() {
    const payload = {
      state: game.state,
      elapsed: game.elapsed,
      settings: game.settings
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
    const amount = (game.state.workerLevel * 5) + (game.state.hangarLevel * 2) + getFuelIdleBonus();
    if (amount > 0) {
      game.state.money += amount;
    }
  }

  function updateCombo(dt) {
    if (game.state.combo > 1) {
      game.state.comboTimer -= dt;
      if (game.state.comboTimer <= 0) {
        game.state.combo = Math.max(1, game.state.combo - getComboDecay());
        game.state.comboTimer = 2.5;
      }
    }
  }

  function updateSpawn(dt) {
    game.spawnTimer += dt;
    const interval = getSpawnInterval();
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
