(() => {
  const STORAGE_KEY = "aircraft_mechanic_tycoon_save_v1";
  const CLOUD_PROFILE_KEY = "aircraft_mechanic_tycoon_profile_v1";
  const CLOUD_SYNC_INTERVAL_SECONDS = 35;
  const LEADERBOARD_LIMIT = 10;
  const cloudConfig = window.MOTY_CONFIG || null;

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const moneyValue = document.getElementById("moneyValue");
  const levelValue = document.getElementById("levelValue");
  const xpText = document.getElementById("xpText");
  const xpFill = document.getElementById("xpFill");
  const comboValue = document.getElementById("comboValue");
  const toast = document.getElementById("toast");
  const topBar = document.querySelector(".top-bar");
  const bottomActions = document.querySelector(".bottom-actions");

  const interactBtn = document.getElementById("interactBtn");
  const upgradeBtn = document.getElementById("upgradeBtn");
  const boardBtn = document.getElementById("boardBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const saveBtn = document.getElementById("saveBtn");

  const dayValue = document.getElementById("dayValue");
  const strikesValue = document.getElementById("strikesValue");

  const upgradeModal = document.getElementById("upgradeModal");
  const settingsModal = document.getElementById("settingsModal");
  const dailyModal = document.getElementById("dailyModal");
  const tutorialModal = document.getElementById("tutorialModal");
  const boardModal = document.getElementById("boardModal");

  const soundToggle = document.getElementById("soundToggle");
  const vibrationToggle = document.getElementById("vibrationToggle");
  const claimDailyBtn = document.getElementById("claimDailyBtn");
  const dailyText = document.getElementById("dailyText");
  const characterNameInput = document.getElementById("characterNameInput");
  const saveCharacterBtn = document.getElementById("saveCharacterBtn");
  const submitBoardBtn = document.getElementById("submitBoardBtn");
  const refreshBoardBtn = document.getElementById("refreshBoardBtn");
  const boardStatusText = document.getElementById("boardStatusText");
  const boardList = document.getElementById("boardList");

  const joystickArea = document.getElementById("joystickArea");
  const joystickBase = document.getElementById("joystickBase");
  const joystickThumb = document.getElementById("joystickThumb");

  const upgradeList = document.getElementById("upgradeList");

  const WORLD_BASE = { width: 1400, height: 900 };
  const PLAYER_RADIUS = 26;
  const INTERACT_RANGE = 110;
  const MAX_WORKERS = 5;
  const DAY_LENGTH = 90; // seconds per in-game day

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

  const WEATHER_CONFIG = {
    winter: {
      label: "Winter",
      accent: "#7dd3fc",
      slowMultiplier: 0.72,
      fastMultiplier: 1.28,
      longItem: {
        stateKey: "winterJacketUntil",
        icon: "🧥",
        title: "Thermal Jacket",
        cost: 2200,
        duration: DAY_LENGTH * 3.5,
        desc: "Expensive, long-lasting protection that keeps you working at normal speed"
      },
      shortItem: {
        stateKey: "coffeeUntil",
        icon: "☕",
        title: "Hot Coffee",
        cost: 160,
        duration: 45,
        desc: "Short boost that makes you work fast"
      }
    },
    summer: {
      label: "Summer",
      accent: "#fca85d",
      slowMultiplier: 0.72,
      fastMultiplier: 1.28,
      longItem: {
        stateKey: "summerFanUntil",
        icon: "🌀",
        title: "Cooling Fan",
        cost: 2200,
        duration: DAY_LENGTH * 3.5,
        desc: "Expensive, long-lasting cooling that keeps you working at normal speed"
      },
      shortItem: {
        stateKey: "popsicleUntil",
        icon: "🍧",
        title: "Popsicle",
        cost: 160,
        duration: 45,
        desc: "Short boost that makes you work fast"
      }
    }
  };

  const FIRE_RESET_START_MONEY = Math.max(
    WEATHER_CONFIG.winter.longItem.cost,
    WEATHER_CONFIG.summer.longItem.cost
  );

  function createInitialState() {
    return {
      money: 2500,
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
      winterJacketUntil: 0,
      coffeeUntil: 0,
      summerFanUntil: 0,
      popsicleUntil: 0,
      lastDailyClaim: "",
      characterName: "Mechanic",
      bestCompetitionScore: 0,
      totalRepairs: 0,
      strikes: 0,
      lostPlanes: 0,
      lastBreakDay: 0,
      lastMeetingDay: 0
    };
  }

  function createFiredResetState() {
    return {
      ...createInitialState(),
      money: FIRE_RESET_START_MONEY,
      tutorialDone: game.state.tutorialDone,
      lastDailyClaim: game.state.lastDailyClaim
    };
  }

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
    leaderboard: {
      syncing: false,
      lastSyncElapsed: 0,
      rows: []
    },
    state: {
      ...createInitialState()
    },
    input: {
      keys: {},
      actionHeld: false,
      joystickActive: false,
      joyX: 0,
      joyY: 0
    },
    boss: {
      phase: "idle",   // "idle" | "entering" | "yelling" | "leaving"
      x: -90,
      y: 0,
      timer: 0,
      nextEvent: 45,   // seconds until first visit
      msgIndex: 0,
      shake: 0
    },
    qualityBoss: {
      phase: "idle",   // "idle" | "entering" | "yelling" | "leaving"
      x: 0,
      y: 0,
      timer: 0,
      nextEvent: 62,
      msgIndex: 0,
      shake: 0
    },
    cookieDay: {
      lastDay: 0,
      banner: 0         // display timer in seconds
    },
    pause: {
      manual: false,
      forced: false,
      reason: "",
      timer: 0
    },
    incident: {
      active: false,
      type: "",
      x: 0,
      y: 0,
      progress: 0,
      need: 0,
      marker: 0.5,
      markerDir: 1,
      markerSpeed: 1,
      zoneCenter: 0.5,
      zoneWidth: 0.22,
      nextEvent: 120
    },
    dayTracker: {
      currentDay: 1,
      season: "winter"
    },
    sessionEnded: false,
    sessionEndTimer: 0,
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
  let cloudProfile = loadCloudProfile();
  let resizeRaf = 0;
  let lastOrientationMode = "";
  let lastLandscapeHintAt = 0;

  function cleanCharacterName(raw) {
    const normalized = String(raw || "")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .trim()
      .slice(0, 24);
    return normalized || "Mechanic";
  }

  function newProfileId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `mech-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function loadCloudProfile() {
    try {
      const raw = localStorage.getItem(CLOUD_PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.playerId) {
          return {
            playerId: String(parsed.playerId),
            characterName: cleanCharacterName(parsed.characterName)
          };
        }
      }
    } catch (_err) {
      // Invalid profile data is replaced with a new profile.
    }

    const fresh = {
      playerId: newProfileId(),
      characterName: "Mechanic"
    };
    localStorage.setItem(CLOUD_PROFILE_KEY, JSON.stringify(fresh));
    return fresh;
  }

  function saveCloudProfile() {
    localStorage.setItem(CLOUD_PROFILE_KEY, JSON.stringify(cloudProfile));
  }

  function isCloudEnabled() {
    return Boolean(
      cloudConfig &&
      cloudConfig.url &&
      cloudConfig.anonKey &&
      cloudConfig.table
    );
  }

  function cloudHeaders() {
    return {
      "Content-Type": "application/json",
      apikey: cloudConfig.anonKey,
      Authorization: `Bearer ${cloudConfig.anonKey}`
    };
  }

  function getCompetitionScore() {
    const moneyScore = Math.floor(game.state.money / 15);
    const levelScore = game.state.level * 450;
    const repairsScore = game.state.totalRepairs * 35;
    const strikePenalty = game.state.strikes * 220;
    return Math.max(0, moneyScore + levelScore + repairsScore - strikePenalty);
  }

  function setBoardStatus(message) {
    if (boardStatusText) boardStatusText.textContent = message;
  }

  function renderBoardRows(rows) {
    if (!boardList) return;
    boardList.innerHTML = "";
    if (!rows.length) {
      const empty = document.createElement("li");
      empty.textContent = "No scores yet. Be the first to post a score.";
      boardList.appendChild(empty);
      return;
    }

    for (const row of rows) {
      const item = document.createElement("li");
      item.className = "board-entry";

      const left = document.createElement("div");
      const name = document.createElement("div");
      name.className = "board-entry-name";
      name.textContent = cleanCharacterName(row.character_name || "Mechanic");

      const meta = document.createElement("div");
      meta.className = "board-entry-meta";
      meta.textContent = `Lv.${row.level || 1} • Repairs ${row.total_repairs || 0}`;

      left.appendChild(name);
      left.appendChild(meta);

      const score = document.createElement("div");
      score.className = "board-entry-score";
      score.textContent = Number(row.score || 0).toLocaleString();

      item.appendChild(left);
      item.appendChild(score);
      boardList.appendChild(item);
    }
  }

  async function fetchLeaderboardRows() {
    if (!isCloudEnabled()) {
      setBoardStatus("Cloud not configured. Add MOTY_CONFIG in config.js.");
      return;
    }

    const qs = new URLSearchParams({
      select: "character_name,score,level,total_repairs,updated_at",
      order: "score.desc,updated_at.asc",
      limit: String(LEADERBOARD_LIMIT)
    });

    const response = await fetch(`${cloudConfig.url}/rest/v1/${cloudConfig.table}?${qs.toString()}`, {
      method: "GET",
      headers: cloudHeaders()
    });

    if (!response.ok) {
      throw new Error(`Leaderboard fetch failed (${response.status})`);
    }

    const rows = await response.json();
    game.leaderboard.rows = Array.isArray(rows) ? rows : [];
    renderBoardRows(game.leaderboard.rows);
    setBoardStatus("Live global standings");
  }

  async function submitLeaderboardScore(showFeedback = true) {
    if (!isCloudEnabled()) {
      setBoardStatus("Cloud not configured. Add MOTY_CONFIG in config.js.");
      if (showFeedback) showToast("Cloud board unavailable");
      return;
    }
    if (game.leaderboard.syncing) return;

    game.leaderboard.syncing = true;
    const scoreNow = getCompetitionScore();
    game.state.bestCompetitionScore = Math.max(game.state.bestCompetitionScore || 0, scoreNow);
    const payload = {
      player_id: cloudProfile.playerId,
      character_name: cleanCharacterName(game.state.characterName || cloudProfile.characterName),
      score: game.state.bestCompetitionScore,
      level: game.state.level,
      total_repairs: game.state.totalRepairs,
      money: Math.floor(game.state.money),
      updated_at: new Date().toISOString()
    };

    try {
      const url = `${cloudConfig.url}/rest/v1/${cloudConfig.table}?on_conflict=player_id`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...cloudHeaders(),
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Score submit failed (${response.status})`);
      }

      game.leaderboard.lastSyncElapsed = game.elapsed;
      if (showFeedback) showToast("Score submitted");
      setBoardStatus("Score synced across devices");
    } catch (_err) {
      if (showFeedback) showToast("Score sync failed");
      setBoardStatus("Could not sync score. Check cloud config/policies.");
    } finally {
      game.leaderboard.syncing = false;
    }
  }

  function applyProfileToState() {
    game.state.characterName = cleanCharacterName(game.state.characterName || cloudProfile.characterName);
    cloudProfile.characterName = game.state.characterName;
    saveCloudProfile();
    if (characterNameInput) characterNameInput.value = game.state.characterName;
  }

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

  function playBossYell() {
    if (!game.settings.sound) return;
    ensureAudio();
    if (!audioCtx) return;

    const bursts = [0, 0.14, 0.31];
    for (const offset of bursts) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const start = audioCtx.currentTime + offset;
      const dur = 0.2;
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(780, start);
      osc.frequency.exponentialRampToValueAtTime(145, start + dur);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.23, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.start(start);
      osc.stop(start + dur + 0.02);
    }
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
    const cols = Math.min(4, count);
    const rows = Math.ceil(count / cols);
    const startX = 220;
    const startY = 190;
    const xGap = (size.width - 440) / Math.max(cols - 1, 1);
    const yGap = 175;

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
      flash: 0,
      angryTimer: 0
    });
  }

  function getRepairRate() {
    return (1.2 + game.state.repairLevel * 0.3) * getPlayerWorkMultiplier();
  }

  function getMoveSpeed() {
    return (165 + game.state.speedLevel * 28) * getPlayerWorkMultiplier();
  }

  function getValueMultiplier() {
    return 1 + (game.state.valueLevel - 1) * 0.18;
  }

  function getComboMultiplier() {
    return 1 + (game.state.combo - 1) * 0.08;
  }

  function getDiagnoseSpeed(actor = "player") {
    const base = 1 + (game.state.diagnoseLevel - 1) * 0.35;
    return actor === "player" ? base * getPlayerWorkMultiplier() : base;
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

  function getCurrentSeason() {
    return Math.floor((getCurrentDay() - 1) / 5) % 2 === 0 ? "winter" : "summer";
  }

  function getSeasonConfig() {
    return WEATHER_CONFIG[getCurrentSeason()];
  }

  function getWeatherItemRemaining(stateKey) {
    return Math.max(0, game.state[stateKey] - game.elapsed);
  }

  function isWeatherItemActive(stateKey) {
    return getWeatherItemRemaining(stateKey) > 0;
  }

  function formatTimer(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function getPlayerWorkMultiplier() {
    const season = getSeasonConfig();
    const hasFastBoost = isWeatherItemActive(season.shortItem.stateKey);
    const hasProtection = isWeatherItemActive(season.longItem.stateKey);

    if (hasFastBoost) return season.fastMultiplier;
    if (hasProtection) return 1;
    return season.slowMultiplier;
  }

  function hasSeasonWeatherRelief() {
    const season = getSeasonConfig();
    return isWeatherItemActive(season.shortItem.stateKey) || isWeatherItemActive(season.longItem.stateKey);
  }

  function getWeatherSpeedLabel() {
    const multiplier = getPlayerWorkMultiplier();
    if (multiplier < 1) return "Slow";
    if (multiplier > 1) return "Fast";
    return "Normal";
  }

  function getWeatherNeedText() {
    const season = getSeasonConfig();
    const longTitle = season.longItem.title;
    const shortTitle = season.shortItem.title;
    const hasFastBoost = isWeatherItemActive(season.shortItem.stateKey);
    const hasProtection = isWeatherItemActive(season.longItem.stateKey);

    if (hasProtection && hasFastBoost) {
      return `${longTitle} + ${shortTitle} active`;
    }
    if (hasFastBoost) {
      return `${shortTitle} active`;
    }
    if (hasProtection) {
      return `${longTitle} active`;
    }
    return `Buy ${longTitle} or ${shortTitle}`;
  }

  function getActiveWeatherItems() {
    const season = getSeasonConfig();
    const activeItems = [];
    const longRemain = getWeatherItemRemaining(season.longItem.stateKey);
    const shortRemain = getWeatherItemRemaining(season.shortItem.stateKey);

    if (longRemain > 0) {
      activeItems.push({
        icon: season.longItem.icon,
        label: season.longItem.title,
        remaining: longRemain,
        accent: season.accent
      });
    }

    if (shortRemain > 0) {
      activeItems.push({
        icon: season.shortItem.icon,
        label: season.shortItem.title,
        remaining: shortRemain,
        accent: season.accent
      });
    }

    return activeItems;
  }

  function buyWeatherItem(item) {
    game.state[item.stateKey] = Math.max(game.state[item.stateKey], game.elapsed) + item.duration;
    return `${item.title} active for ${formatTimer(getWeatherItemRemaining(item.stateKey))}`;
  }

  function getCurrentDay() {
    return Math.floor(game.elapsed / DAY_LENGTH) + 1;
  }

  function isGamePaused() {
    return game.pause.manual || game.pause.forced || game.sessionEnded;
  }

  function startForcedPause(reason, seconds) {
    game.pause.forced = true;
    game.pause.reason = reason;
    game.pause.timer = Math.max(0, seconds);
  }

  function clearForcedPause() {
    game.pause.forced = false;
    game.pause.reason = "";
    game.pause.timer = 0;
  }

  function togglePause() {
    if (game.sessionEnded) return;
    game.pause.manual = !game.pause.manual;
    if (game.pause.manual) {
      showToast("Paused");
    } else {
      showToast("Resumed");
    }
    updateUI();
  }

  async function saveProgressWithFeedback() {
    saveGame();
    showToast("Progress saved");
    await submitLeaderboardScore(false);
  }

  function triggerIncident() {
    if (game.incident.active || isGamePaused()) return;
    const type = Math.random() < 0.5 ? "oil" : "tool";
    game.incident.active = true;
    game.incident.type = type;
    game.incident.progress = 0;
    game.incident.need = type === "oil" ? 2 : 3;
    game.incident.marker = 0.5;
    game.incident.markerDir = Math.random() < 0.5 ? -1 : 1;
    game.incident.markerSpeed = type === "oil" ? 0.72 : 0.86;
    game.incident.zoneCenter = rand(0.28, 0.72);
    game.incident.zoneWidth = type === "oil" ? 0.32 : 0.28;
    game.incident.x = rand(170, game.width - 170);
    game.incident.y = rand(170, game.height - 170);
    game.incident.nextEvent = 135 + Math.random() * 135;
    makePlanesAngry(type === "oil" ? 2.8 : 3.2, 0.7);
    showToast(type === "oil" ? "Oil spill! Hit the green timing zone." : "Tool missing! Hit the green timing zone.");
    playSound("alert");
  }

  function tryIncidentTimingHit() {
    const incident = game.incident;
    if (!incident.active) return false;

    const close = dist(game.player, incident) <= INTERACT_RANGE;
    if (!close) {
      showToast("Move closer to start timing");
      return true;
    }

    const inZone = Math.abs(incident.marker - incident.zoneCenter) <= incident.zoneWidth * 0.5;
    if (inZone) {
      incident.progress += 1;
      incident.markerSpeed = clamp(incident.markerSpeed + 0.05, 0.9, 1.8);
      incident.zoneCenter = rand(0.24, 0.76);
      playSound("repair");
      vibrate(12);

      if (incident.progress >= incident.need) {
        const msg = incident.type === "oil" ? "Oil spill cleaned" : "Lost tool found";
        incident.active = false;
        incident.type = "";
        incident.progress = 0;
        incident.need = 0;
        showToast(`${msg}. Back to work!`);
        playSound("cash");
      } else {
        showToast(`Great timing ${incident.progress}/${incident.need}`);
      }
    } else {
      incident.progress = Math.max(0, incident.progress - 1);
      makePlanesAngry(4.2, incident.type === "oil" ? 1.5 : 1.9);
      showToast("Missed timing");
      playSound("alert");
      vibrate(8);
    }

    return true;
  }

  function updateIncident(dt) {
    const incident = game.incident;

    if (!incident.active) {
      incident.nextEvent -= dt;
      if (incident.nextEvent <= 0) {
        triggerIncident();
      }
      return;
    }

    incident.marker += incident.markerDir * incident.markerSpeed * dt;
    if (incident.marker <= 0) {
      incident.marker = 0;
      incident.markerDir = 1;
    } else if (incident.marker >= 1) {
      incident.marker = 1;
      incident.markerDir = -1;
    }
  }

  function makePlanesAngry(angrySeconds = 4, waitPenalty = 0.8) {
    for (const a of game.aircraft) {
      if (!["waiting", "diagnosing", "repairing", "done"].includes(a.state)) continue;
      a.angryTimer = Math.max(a.angryTimer || 0, angrySeconds);
      a.wait = Math.max(2, a.wait - waitPenalty);
      a.flash = Math.max(a.flash || 0, 0.5);
    }
  }

  function registerPlaneLoss(typeName) {
    game.state.lostPlanes += 1;
    game.state.strikes += 1;
    showToast(`${typeName} lost. Strike ${game.state.strikes}/3`);
    playSound("alert");

    if (game.state.strikes >= 3) {
      fireAndRestart();
    }
  }

  function fireAndRestart() {
    if (game.sessionEnded) return;
    game.sessionEnded = true;
    game.sessionEndTimer = 0;
    game.pause.manual = false;
    startForcedPause("3 strikes. You are fired.", 3.5);
    playBossYell();
    showToast("You are fired. Restarting...");

    // Reset progression immediately so any follow-up save keeps the wiped state.
    game.state = createFiredResetState();
    game.elapsed = 0;
    game.dayTracker.currentDay = 1;
    game.dayTracker.season = getCurrentSeason();
    game.aircraft = [];
    game.workers = [];
    game.particles = [];
    game.incident.active = false;
    game.incident.type = "";
    saveGame();
    updateUpgradeUI();
    updateUI();

    setTimeout(() => {
      window.location.reload();
    }, 4200);
  }

  function updateDayEvents() {
    const dayNum = getCurrentDay();
    const season = getCurrentSeason();

    if (dayNum !== game.dayTracker.currentDay) {
      game.dayTracker.currentDay = dayNum;
      showToast(`Day ${dayNum} started`);

      if (season !== game.dayTracker.season) {
        game.dayTracker.season = season;
        if (season === "winter") {
          game.state.summerFanUntil = 0;
          game.state.popsicleUntil = 0;
        } else {
          game.state.winterJacketUntil = 0;
          game.state.coffeeUntil = 0;
        }
        const seasonInfo = getSeasonConfig();
        showToast(`${seasonInfo.label} started. Buy ${seasonInfo.longItem.title} or ${seasonInfo.shortItem.title}.`);
      }
    }

    if (game.state.lastBreakDay !== dayNum) {
      game.state.lastBreakDay = dayNum;
      startForcedPause("Mandatory daily break", 6);
    }

    if (dayNum % 10 === 0 && game.state.lastMeetingDay !== dayNum) {
      game.state.lastMeetingDay = dayNum;
      const meetingCost = 260 + dayNum * 35;
      game.state.money = Math.max(0, game.state.money - meetingCost);
      startForcedPause(`All-hands meeting. Food cost ${fmtMoney(meetingCost)}`, 5);
      playSound("cash");
    }
  }

  function startDiagnose(aircraft, actor = "player") {
    if (aircraft.state !== "waiting") return;
    aircraft.state = "diagnosing";
    aircraft.diagnoseTimer = (1 + Math.random() * 0.7) / getDiagnoseSpeed(actor);
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

    if (aircraft.reservedBy && aircraft.reservedBy !== "player") {
      aircraft.reservedBy = null;
    }
    aircraft.state = "departing";
  }

  function failAircraft(aircraft) {
    if (aircraft.reservedBy && aircraft.reservedBy !== "player") {
      aircraft.reservedBy = null;
    }
    aircraft.state = "departing";
    game.state.combo = 1;
    showToast(`${aircraft.typeName} left unhappy`);
    playSound("alert");
    registerPlaneLoss(aircraft.typeName);
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
    if (isGamePaused()) return;

    if (game.incident.active) {
      tryIncidentTimingHit();
      return;
    }

    const nearest = nearestInteractable();
    if (!nearest.target || nearest.distance > INTERACT_RANGE) return;
    const a = nearest.target;

    if (a.state === "waiting") {
      startDiagnose(a, "player");
    } else if (a.state === "done") {
      collectPayment(a, false);
    }
  }

  function startActionPress() {
    if (isGamePaused()) return;
    ensureAudio();
    game.input.actionHeld = true;
    tryInteract();
  }

  function endActionPress() {
    game.input.actionHeld = false;
  }

  function tapAircraftInteraction(point) {
    if (isGamePaused()) return false;
    if (game.incident.active) {
      return tryIncidentTimingHit();
    }

    let hit = null;
    for (const a of game.aircraft) {
      if (!["waiting", "diagnosing", "repairing", "done"].includes(a.state)) continue;
      if (Math.abs(a.x - point.x) < 70 && Math.abs(a.y - point.y) < 57) {
        hit = a;
      }
    }
    if (!hit) return false;
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
    function releaseReservation(worker) {
      worker.targetId = null;
    }

    // Backward compatibility: clear legacy worker reservation marker.
    for (const aircraft of game.aircraft) {
      if (aircraft.reservedBy === "worker") {
        aircraft.reservedBy = null;
      }
    }

    const needed = game.state.workerLevel;

    while (game.workers.length < needed) {
      game.workers.push({
        id: crypto.randomUUID(),
        x: rand(130, 260),
        y: rand(500, 730),
        targetId: null,
        pulse: Math.random() * Math.PI * 2
      });
    }

    if (game.workers.length > needed) {
      for (let i = needed; i < game.workers.length; i += 1) {
        releaseReservation(game.workers[i]);
      }
      game.workers.length = needed;
    }

    for (const worker of game.workers) {
      worker.pulse += dt * 3;

      // Re-evaluate target every tick so workers break off for higher-priority unattended planes.
      const activeStates = ["waiting", "diagnosing", "repairing", "done"];
      const pool = game.aircraft.filter((a) => activeStates.includes(a.state));

      // Track which planes other workers are already heading to.
      const attendedIds = new Set(game.workers
        .filter((w) => w !== worker && w.targetId)
        .map((w) => w.targetId));
      // The player is also "attending" whichever plane they are next to and acting on.
      const playerNearest = nearestInteractable();
      if (playerNearest.target && playerNearest.distance <= INTERACT_RANGE + 30 &&
          (game.input.actionHeld || playerNearest.target.state === "repairing" || playerNearest.target.state === "diagnosing")) {
        attendedIds.add(playerNearest.target.id);
      }

      const unattended = pool.filter((a) => !attendedIds.has(a.id));
      const searchPool = unattended.length > 0 ? unattended : pool;

      let best = null;
      let bestScore = Infinity;
      for (const a of searchPool) {
        let statePriority = 3;
        if (a.state === "repairing") statePriority = 0;
        else if (a.state === "diagnosing") statePriority = 1;
        else if (a.state === "waiting") statePriority = 2;
        // Small hysteresis bonus for the current target to prevent micro-thrashing.
        const stickBonus = (a.id === worker.targetId) ? -60 : 0;
        const score = dist(worker, a) + statePriority * 180 + stickBonus;
        if (score < bestScore) {
          bestScore = score;
          best = a;
        }
      }

      const target = best;
      if (target) {
        worker.targetId = target.id;
      } else {
        releaseReservation(worker);
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
          startDiagnose(target, worker.id);
        } else if (target.state === "diagnosing") {
          target.diagnoseTimer -= dt * 0.8 * getDiagnoseSpeed();
        } else if (target.state === "repairing") {
          target.repairProgress += dt * getWorkerRepairRate();
        } else if (target.state === "done") {
          collectPayment(target, true);
          releaseReservation(worker);
        }
      }

      if (target.state === "departing") {
        releaseReservation(worker);
      }
    }
  }

  function updateAircraft(dt) {
    for (let i = game.aircraft.length - 1; i >= 0; i -= 1) {
      const a = game.aircraft[i];
      if (a.flash > 0) a.flash -= dt;
      if (a.angryTimer > 0) a.angryTimer -= dt;

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

    if (a.angryTimer > 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      fillRoundedRect(p.x - 26, p.y - size - 64, 52, 20, 10);
      ctx.fillStyle = "#ff6b5f";
      ctx.font = "bold 14px Manrope";
      ctx.textAlign = "center";
      ctx.fillText("ANGRY", p.x, p.y - size - 50);
      ctx.textAlign = "start";
    }

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
    const season = getCurrentSeason();
    const showSeasonDiscomfort = !hasSeasonWeatherRelief();
    const isWinter = season === "winter" && showSeasonDiscomfort;
    const isSummer = season === "summer" && showSeasonDiscomfort;

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

    // Body — seasonal tint
    const vestGrad = ctx.createLinearGradient(-15, -10, 15, 28);
    if (isWinter) {
      vestGrad.addColorStop(0, "#b8dcff");
      vestGrad.addColorStop(0.4, "#4e8fc7");
      vestGrad.addColorStop(1, "#234e7d");
    } else if (isSummer) {
      vestGrad.addColorStop(0, "#ff7a6a");
      vestGrad.addColorStop(0.4, "#df3f39");
      vestGrad.addColorStop(1, "#922322");
    } else {
      vestGrad.addColorStop(0, "#ffd428");
      vestGrad.addColorStop(0.4, "#e8a500");
      vestGrad.addColorStop(1, "#b07600");
    }
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
    ctx.fillStyle = isWinter ? "#9fc6f0" : (isSummer ? "#f19184" : "#f0b880");
    fillRoundedRect(-5, -18, 10, 10, 3);

    // Head
    ctx.fillStyle = isWinter ? "#9fc6f0" : (isSummer ? "#f19184" : "#f0b880");
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

    if (isSummer) {
      ctx.fillStyle = "rgba(180, 230, 255, 0.9)";
      for (let i = 0; i < 3; i += 1) {
        const sx = -10 + i * 10;
        const sy = -43 + Math.sin(game.time * 7 + i) * 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (isWinter) {
      ctx.fillStyle = "rgba(8, 20, 35, 0.7)";
      fillRoundedRect(-34, -62, 68, 18, 8);
      ctx.fillStyle = "#d7ebff";
      ctx.font = "bold 11px Manrope";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Brrr...", 0, -53);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

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
    if (game.incident.active) return;

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

  function drawIncident() {
    if (!game.incident.active) return;
    const i = game.incident;
    const p = worldToScreen(i.x, i.y);

    ctx.save();
    ctx.translate(p.x, p.y);

    if (i.type === "oil") {
      const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 58);
      g.addColorStop(0, "rgba(35, 35, 35, 0.85)");
      g.addColorStop(0.6, "rgba(12, 12, 12, 0.72)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.2)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, 66, 36, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#ffd24a";
      fillRoundedRect(-24, -16, 48, 32, 8);
      ctx.fillStyle = "#203148";
      fillRoundedRect(-6, -8, 12, 16, 3);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      fillRoundedRect(-24, -16, 48, 10, 8);
    }

    const ratio = i.need > 0 ? clamp(i.progress / i.need, 0, 1) : 0;
    const barW = 132;
    const barH = 14;
    const barX = -barW / 2;
    const barY = -68;
    const zoneStart = clamp(i.zoneCenter - i.zoneWidth * 0.5, 0, 1);
    const zoneW = i.zoneWidth;
    const markerX = barX + i.marker * barW;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    fillRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, 8);
    ctx.fillStyle = "rgba(220, 235, 255, 0.25)";
    fillRoundedRect(barX, barY, barW, barH, 7);
    ctx.fillStyle = "rgba(86, 216, 197, 0.85)";
    fillRoundedRect(barX + zoneStart * barW, barY, zoneW * barW, barH, 7);

    ctx.strokeStyle = "#ff4d4d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(markerX, barY - 6);
    ctx.lineTo(markerX, barY + barH + 6);
    ctx.stroke();

    ctx.fillStyle = "#dff6ff";
    ctx.font = "bold 10px Manrope";
    ctx.textAlign = "center";
    ctx.fillText("Tap in green", 0, barY + 30);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    fillRoundedRect(-50, -44, 100, 8, 4);
    ctx.fillStyle = "#56d8c5";
    fillRoundedRect(-50, -44, 100 * ratio, 8, 4);

    ctx.textAlign = "start";

    ctx.restore();
  }

  function drawActiveWeatherIcons() {
    if (game.sessionEnded) return;

    const activeItems = getActiveWeatherItems();
    if (!activeItems.length) return;

    const compact = game.viewWidth < 640;
    const iconSize = compact ? 52 : 60;
    const gap = 14;
    const totalWidth = (activeItems.length * iconSize) + ((activeItems.length - 1) * gap);
    const startX = (game.viewWidth - totalWidth) / 2;
    const baseY = game.viewHeight - (bottomActions?.offsetHeight || 88) - iconSize - 18;

    ctx.save();
    for (let i = 0; i < activeItems.length; i += 1) {
      const item = activeItems[i];
      const x = startX + i * (iconSize + gap);
      const pulse = 1 + Math.sin(game.time * 5 + i) * 0.03;

      ctx.save();
      ctx.translate(x + iconSize / 2, baseY + iconSize / 2);
      ctx.scale(pulse, pulse);

      ctx.fillStyle = "rgba(8, 14, 24, 0.84)";
      fillRoundedRect(-iconSize / 2, -iconSize / 2, iconSize, iconSize, 16);
      ctx.strokeStyle = item.accent;
      ctx.lineWidth = 3;
      ctx.strokeRect((-iconSize / 2) + 1.5, (-iconSize / 2) + 1.5, iconSize - 3, iconSize - 3);

      ctx.font = compact ? "26px sans-serif" : "30px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.icon, 0, -6);

      ctx.fillStyle = "#eff7ff";
      ctx.font = compact ? "bold 10px Manrope" : "bold 11px Manrope";
      ctx.fillText(formatTimer(item.remaining), 0, iconSize * 0.22);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawFiredScottyOverlay() {
    const t = game.sessionEndTimer;
    const entrance = clamp(t / 0.95, 0, 1);
    const stomp = Math.abs(Math.sin(t * 8.5));
    const shake = Math.min(1, t * 1.8) * Math.sin(t * 30) * 9;
    const scale = Math.min(7.5, Math.max(4.6, Math.min(game.viewWidth, game.viewHeight) / 80));
    const targetX = game.viewWidth * 0.36;
    const x = -220 + (targetX + 220) * entrance;
    const y = game.viewHeight * 0.68 + stomp * 8;
    const textPunch = 0.86 + Math.min(0.22, t * 0.11);

    ctx.save();
    ctx.fillStyle = "rgba(30, 0, 0, 0.58)";
    ctx.fillRect(0, 0, game.viewWidth, game.viewHeight);
    ctx.translate(shake, 0);

    const bg = ctx.createLinearGradient(0, 0, 0, game.viewHeight);
    bg.addColorStop(0, "rgba(80, 0, 0, 0.7)");
    bg.addColorStop(0.55, "rgba(28, 0, 0, 0.82)");
    bg.addColorStop(1, "rgba(6, 0, 0, 0.94)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, game.viewWidth, game.viewHeight);

    for (let i = -1; i < 10; i += 1) {
      const stripeX = i * 120 + ((t * 80) % 120);
      ctx.fillStyle = i % 2 === 0 ? "rgba(255, 40, 40, 0.08)" : "rgba(255, 210, 70, 0.08)";
      ctx.beginPath();
      ctx.moveTo(stripeX, 0);
      ctx.lineTo(stripeX + 80, 0);
      ctx.lineTo(stripeX - 30, game.viewHeight);
      ctx.lineTo(stripeX - 110, game.viewHeight);
      ctx.closePath();
      ctx.fill();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, 54, 38, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1a0a00";
    fillRoundedRect(-20, 18 + stomp * 2.5, 13, 30, 5);
    fillRoundedRect(7, 16 - stomp * 1.8, 13, 32, 5);
    ctx.fillStyle = "#080303";
    fillRoundedRect(-24, 45 + stomp * 2.5, 20, 8, 4);
    fillRoundedRect(6, 43 - stomp * 1.8, 20, 8, 4);

    const suitGrad = ctx.createLinearGradient(-26, -18, 26, 40);
    suitGrad.addColorStop(0, "#ff5148");
    suitGrad.addColorStop(0.5, "#c41212");
    suitGrad.addColorStop(1, "#560909");
    ctx.fillStyle = suitGrad;
    fillRoundedRect(-24, -18, 48, 52, 10);

    ctx.fillStyle = "#2a0404";
    fillRoundedRect(-6, -13, 12, 34, 4);

    ctx.fillStyle = "#7d1515";
    fillRoundedRect(-39, -15 + stomp * 1.5, 15, 31, 5);
    fillRoundedRect(24, -19 - stomp * 1.5, 15, 35, 5);
    ctx.fillStyle = "#f0c080";
    ctx.beginPath();
    ctx.arc(-31, 18 + stomp * 1.5, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(31, 15 - stomp * 1.5, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f0b870";
    fillRoundedRect(-7, -29, 14, 11, 4);
    ctx.beginPath();
    ctx.arc(0, -46, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#170707";
    ctx.beginPath();
    ctx.ellipse(0, -58, 20, 8, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-8, -46, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, -46, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#180404";
    ctx.beginPath();
    ctx.arc(-8, -46, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, -46, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#180404";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-15, -54);
    ctx.lineTo(-3, -50);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(15, -54);
    ctx.lineTo(3, -50);
    ctx.stroke();

    ctx.fillStyle = "#5f0000";
    ctx.beginPath();
    ctx.ellipse(0, -35, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    fillRoundedRect(-24, -11, 48, 14, 4);
    ctx.fillStyle = "#7d0000";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LEAD", 0, -4);

    for (let i = 0; i < 3; i += 1) {
      const puffX = -44 + i * 20;
      const puffY = 52 + Math.sin(t * 11 + i) * 4;
      ctx.fillStyle = "rgba(255, 220, 180, 0.2)";
      ctx.beginPath();
      ctx.arc(puffX, puffY, 6 + i, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    ctx.save();
    ctx.translate(game.viewWidth * 0.58, game.viewHeight * 0.33);
    ctx.scale(textPunch, textPunch);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(30, 0, 0, 0.95)";
    ctx.lineWidth = 12;
    ctx.fillStyle = "#ff3030";
    ctx.font = `900 ${Math.min(110, game.viewWidth * 0.17)}px Russo One`;
    ctx.strokeText("YOU'RE", 0, -34);
    ctx.fillText("YOU'RE", 0, -34);
    ctx.font = `900 ${Math.min(132, game.viewWidth * 0.2)}px Russo One`;
    ctx.strokeText("FIRED", 0, 58);
    ctx.fillText("FIRED", 0, 58);

    ctx.fillStyle = "rgba(255, 233, 200, 0.94)";
    ctx.font = `bold ${Math.min(24, game.viewWidth * 0.034)}px Manrope`;
    ctx.fillText("Lead storms in and shuts the whole hangar down", 0, 114);
    ctx.restore();

    ctx.restore();
  }

  function drawStatusOverlay() {
    if (game.incident.active && !isGamePaused()) {
      const compact = game.viewWidth < 720;
      const panelWidth = Math.min(game.viewWidth - 28, compact ? 230 : 360);
      const panelHeight = compact ? 30 : 34;
      const panelX = (game.viewWidth - panelWidth) / 2;
      const panelY = compact ? game.viewHeight - panelHeight - 22 : 94;

      ctx.save();
      ctx.fillStyle = "rgba(9, 16, 24, 0.72)";
      fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 10);
      ctx.fillStyle = "#eff7ff";
      ctx.font = compact ? "bold 12px Manrope" : "bold 13px Manrope";
      ctx.textAlign = "center";
      const text = compact
        ? "Move close. Tap in green."
        : (game.incident.type === "oil"
          ? "Oil spill! Move close and tap when marker is in green."
          : "Tool lost! Move close and tap when marker is in green.");
      ctx.fillText(text, game.viewWidth / 2, panelY + panelHeight * 0.68);
      ctx.textAlign = "start";
      ctx.restore();
    }

    if (game.sessionEnded) {
      drawFiredScottyOverlay();
      return;
    }

    if (!isGamePaused()) return;

    ctx.save();
    ctx.fillStyle = "rgba(3, 8, 14, 0.54)";
    ctx.fillRect(0, 0, game.viewWidth, game.viewHeight);

    ctx.fillStyle = "#e7f4ff";
    ctx.textAlign = "center";
    ctx.font = "bold 34px Russo One";
    ctx.fillText(game.sessionEnded ? "FIRED" : "PAUSED", game.viewWidth / 2, game.viewHeight * 0.42);

    ctx.font = "bold 14px Manrope";
    let detail = game.pause.reason;
    if (!detail && game.pause.manual) detail = "Press Pause or P to resume";
    if (game.pause.forced && game.pause.timer > 0) {
      detail = `${detail} (${Math.ceil(game.pause.timer)}s)`;
    }
    if (detail) {
      ctx.fillText(detail, game.viewWidth / 2, game.viewHeight * 0.47);
    }
    ctx.restore();
  }

  function drawScene() {
    drawBackground();
    drawHUDMarkers();
    for (const a of game.aircraft) drawAircraft(a);
    drawIncident();
    drawWorkers();
    drawPlayer();
    drawBoss();
    drawQualityBoss();
    drawInteractionHint();
    drawCookieDayBanner();
    drawActiveWeatherIcons();
    drawStatusOverlay();
  }

  function updateLayoutMetrics() {
    const topPad = (topBar?.offsetHeight || 88) + 10;
    const bottomPad = (bottomActions?.offsetHeight || 88) + 10;
    const root = document.documentElement;
    root.style.setProperty("--hud-top", `${topPad}px`);
    root.style.setProperty("--hud-bottom", `${bottomPad}px`);
  }

  function updateViewportHeightVar() {
    const viewportHeight = Math.max(
      1,
      Math.floor(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0)
    );
    document.documentElement.style.setProperty("--vvh", `${viewportHeight}px`);
  }

  function queueResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      resize();
    });
  }

  function maybeShowLandscapeSpaceHint(force = false) {
    if (!isLikelyMobileDevice()) {
      lastOrientationMode = "";
      return;
    }

    const viewportWidth = Math.floor(window.visualViewport?.width || window.innerWidth || 0);
    const viewportHeight = Math.floor(window.visualViewport?.height || window.innerHeight || 0);
    const orientationMode = viewportWidth > viewportHeight ? "landscape" : "portrait";
    const orientationChanged = orientationMode !== lastOrientationMode;

    if (orientationChanged) {
      lastOrientationMode = orientationMode;
    }

    const isShortLandscape = orientationMode === "landscape" && viewportHeight <= 430;
    if (!isShortLandscape || document.fullscreenElement) return;
    if (!force && !orientationChanged) return;

    const now = Date.now();
    if (now - lastLandscapeHintAt < 10000) return;
    lastLandscapeHintAt = now;
    showToast("Tip: Tap Fullscreen for more room in landscape");
  }

  function resize() {
    updateViewportHeightVar();
    updateLayoutMetrics();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    game.viewWidth = width;
    game.viewHeight = height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    maybeShowLandscapeSpaceHint();
  }

  function updateUI() {
    moneyValue.textContent = fmtMoney(game.state.money);
    levelValue.textContent = `${game.state.level}`;
    xpText.textContent = `${Math.floor(game.state.xp)} / ${game.state.xpToNext} XP`;
    xpFill.style.width = `${(game.state.xp / game.state.xpToNext) * 100}%`;
    comboValue.textContent = `x${getComboMultiplier().toFixed(1)}`;
    dayValue.textContent = `Day ${getCurrentDay()} | ${getSeasonConfig().label}`;
    strikesValue.textContent = `${game.state.strikes}/3`;

    pauseBtn.textContent = game.pause.manual ? "Resume" : "Pause";

    if (isGamePaused()) {
      interactBtn.textContent = "Paused";
      interactBtn.classList.remove("ready-diagnose", "ready-repair", "ready-collect");
      return;
    }

    if (game.incident.active) {
      const nearIncident = dist(game.player, game.incident) <= INTERACT_RANGE;
      interactBtn.classList.remove("ready-diagnose", "ready-repair", "ready-collect");
      interactBtn.classList.add("ready-repair");
      interactBtn.textContent = nearIncident
        ? "Tap Timing"
        : (game.incident.type === "oil" ? "Go Clean Spill" : "Go Find Tool");
      return;
    }

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
      seasonal: getSeasonConfig().accent,
      operations: "#56d8c5",
      economy: "#fbbf24",
      expansion: "#b89dff",
      contracts: "#ff9f4d"
    };

    const season = getSeasonConfig();
    const longRemain = getWeatherItemRemaining(season.longItem.stateKey);
    const shortRemain = getWeatherItemRemaining(season.shortItem.stateKey);

    const sections = [
      {
        label: `${season.label} Gear`,
        cat: "seasonal",
        items: [
          {
            id: season.longItem.stateKey,
            icon: season.longItem.icon,
            title: season.longItem.title,
            desc: `${season.longItem.desc}${longRemain > 0 ? ` (${formatTimer(longRemain)} left)` : ""}`,
            cost: season.longItem.cost,
            onBuy: () => buyWeatherItem(season.longItem),
            available: true,
            repeatable: true,
            badgeText: longRemain > 0 ? formatTimer(longRemain) : "Ready"
          },
          {
            id: season.shortItem.stateKey,
            icon: season.shortItem.icon,
            title: season.shortItem.title,
            desc: `${season.shortItem.desc}${shortRemain > 0 ? ` (${formatTimer(shortRemain)} left)` : ""}`,
            cost: season.shortItem.cost,
            onBuy: () => buyWeatherItem(season.shortItem),
            available: true,
            repeatable: true,
            badgeText: shortRemain > 0 ? formatTimer(shortRemain) : "Ready"
          }
        ]
      },
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
        const isMaxed = !def.repeatable && !def.available;
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
        if (def.badgeText) {
          levelBadge.textContent = def.badgeText;
        } else if (isMaxed) {
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
          const buyMessage = def.onBuy();
          playSound("upgrade");
          showToast(buyMessage || `${def.title} upgraded!`);
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

  const LEAD_LINES = [
    "HURRY UP!! We have planes waiting!!",
    "You can't do that job — that's TOO HARD for you!",
    "WHAT ARE YOU DOING?! Move faster!!",
    "I'm watching you! SPEED IT UP!!",
    "That repair is too hard, get someone else!",
    "COME ON COME ON COME ON!! HURRY UP!!"
  ];

  const QUALITY_LINES = [
    "Where is your manual?",
    "Technically you should do it this way, don't do it that way.",
    "Man, I wish I had your job, you don't do anything."
  ];

  function updateBoss(dt) {
    const b = game.boss;
    if (b.shake > 0) b.shake -= dt;

    if (b.phase === "idle") {
      b.nextEvent -= dt;
      if (b.nextEvent <= 0) {
        b.phase = "entering";
        b.y = game.viewHeight * 0.45;
        b.x = -90;
        b.msgIndex = Math.floor(Math.random() * LEAD_LINES.length);
        b.timer = 0;
      }
      return;
    }

    if (b.phase === "entering") {
      b.x += dt * 140;
      if (b.x >= 90) {
        b.x = 90;
        b.phase = "yelling";
        b.timer = 3.5;
        b.shake = 3.5;
        showToast(`Lead: "${LEAD_LINES[b.msgIndex]}"`);
        playSound("alert");
        vibrate([80, 40, 80]);
      }
      return;
    }

    if (b.phase === "yelling") {
      b.timer -= dt;
      if (b.timer <= 0) {
        b.phase = "leaving";
      }
      return;
    }

    if (b.phase === "leaving") {
      b.x -= dt * 160;
      if (b.x < -90) {
        b.x = -90;
        b.phase = "idle";
        // Next visit in 50-100 seconds
        b.nextEvent = 50 + Math.random() * 50;
      }
    }
  }

  function updateQualityBoss(dt) {
    const b = game.qualityBoss;
    if (b.shake > 0) b.shake -= dt;

    if (b.phase === "idle") {
      b.nextEvent -= dt;
      if (b.nextEvent <= 0) {
        b.phase = "entering";
        b.y = game.viewHeight * 0.58;
        b.x = game.viewWidth + 95;
        b.msgIndex = Math.floor(Math.random() * QUALITY_LINES.length);
        b.timer = 0;
      }
      return;
    }

    if (b.phase === "entering") {
      b.x -= dt * 170;
      const stopX = Math.max(90, game.viewWidth - 110);
      if (b.x <= stopX) {
        b.x = stopX;
        b.phase = "yelling";
        b.timer = 3.8;
        b.shake = 2.8;
        showToast(`Quality: "${QUALITY_LINES[b.msgIndex]}"`);
        playSound("alert");
      }
      return;
    }

    if (b.phase === "yelling") {
      b.timer -= dt;
      if (b.timer <= 0) {
        b.phase = "leaving";
      }
      return;
    }

    if (b.phase === "leaving") {
      b.x += dt * 190;
      if (b.x > game.viewWidth + 95) {
        b.x = game.viewWidth + 95;
        b.phase = "idle";
        b.nextEvent = 70 + Math.random() * 55;
      }
    }
  }

  function updateCookieDay(dt) {
    const cd = game.cookieDay;
    if (cd.banner > 0) {
      cd.banner -= dt;
    }

    const dayNum = Math.floor(game.elapsed / DAY_LENGTH) + 1;
    if (dayNum > 1 && dayNum % 4 === 0 && dayNum !== cd.lastDay) {
      cd.lastDay = dayNum;
      cd.banner = 6;
      const bonus = 250 + game.state.level * 30;
      game.state.money += bonus;
      addXP(60);
      playSound("cash");
      vibrate([50, 30, 50, 30, 100]);
    }
  }

  function drawBoss() {
    const b = game.boss;
    if (b.phase === "idle") return;

    const shakeX = b.shake > 0 ? (Math.random() - 0.5) * 3 : 0;
    const bob = b.phase === "yelling" ? Math.sin(game.time * 14) * 2.5 : 0;

    ctx.save();
    ctx.translate(b.x + shakeX, b.y + bob);

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 42, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = "#1a0a00";
    fillRoundedRect(-13, 26, 10, 20, 4);
    fillRoundedRect(3, 26, 10, 20, 4);
    // Shoes
    ctx.fillStyle = "#0a0500";
    fillRoundedRect(-15, 42, 13, 6, 3);
    fillRoundedRect(3, 42, 13, 6, 3);

    // Suit body (dark red — angry boss)
    const suitGrad = ctx.createLinearGradient(-15, -12, 15, 28);
    suitGrad.addColorStop(0, "#c0392b");
    suitGrad.addColorStop(0.5, "#962020");
    suitGrad.addColorStop(1, "#5c1010");
    ctx.fillStyle = suitGrad;
    fillRoundedRect(-15, -12, 30, 39, 7);

    // Tie
    ctx.fillStyle = "#2c0a0a";
    fillRoundedRect(-4, -8, 8, 26, 3);

    // Arms (angry pose — raised slightly)
    ctx.fillStyle = "#6b1a1a";
    fillRoundedRect(-26, -10, 12, 22, 4);
    fillRoundedRect(14, -10, 12, 22, 4);
    // Fists
    ctx.fillStyle = "#f0c080";
    ctx.beginPath();
    ctx.arc(-20, 14, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(20, 14, 6, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.fillStyle = "#f0b870";
    fillRoundedRect(-5, -20, 10, 10, 3);

    // Head
    ctx.fillStyle = "#f0b870";
    ctx.beginPath();
    ctx.arc(0, -30, 15, 0, Math.PI * 2);
    ctx.fill();

    // Hair (dark, slicked back)
    ctx.fillStyle = "#1a0a00";
    ctx.beginPath();
    ctx.ellipse(0, -40, 14, 6, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Eyes (angry — angled eyebrows)
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-5, -30, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5, -30, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a0808";
    ctx.beginPath();
    ctx.arc(-5, -30, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -30, 2, 0, Math.PI * 2);
    ctx.fill();
    // Eyebrows (angry V shape)
    ctx.strokeStyle = "#1a0a00";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-9, -35);
    ctx.lineTo(-2, -33);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(9, -35);
    ctx.lineTo(2, -33);
    ctx.stroke();

    // Mouth (yelling O)
    ctx.fillStyle = "#6b0000";
    ctx.beginPath();
    ctx.ellipse(0, -23, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Name tag
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    fillRoundedRect(-18, -6, 36, 12, 3);
    ctx.fillStyle = "#6b0000";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LEAD", 0, 0);

    // Speech bubble (during yelling phase)
    if (b.phase === "yelling") {
      const msg = LEAD_LINES[b.msgIndex];
      const maxW = 200;
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      // Word wrap
      const words = msg.split(" ");
      const lines = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (ctx.measureText(test).width > maxW - 16) {
          if (cur) lines.push(cur);
          cur = w;
        } else {
          cur = test;
        }
      }
      if (cur) lines.push(cur);

      const lineH = 16;
      const bW = maxW;
      const bH = lines.length * lineH + 16;
      const bX = 18;
      const bY = -62 - bH;

      // Bubble fill
      ctx.fillStyle = "rgba(255, 240, 220, 0.97)";
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const br = 8;
      ctx.moveTo(bX + br, bY);
      ctx.lineTo(bX + bW - br, bY);
      ctx.arcTo(bX + bW, bY, bX + bW, bY + br, br);
      ctx.lineTo(bX + bW, bY + bH - br);
      ctx.arcTo(bX + bW, bY + bH, bX + bW - br, bY + bH, br);
      ctx.lineTo(bX + 22, bY + bH);
      ctx.lineTo(bX + 10, bY + bH + 12);
      ctx.lineTo(bX + 34, bY + bH);
      ctx.lineTo(bX + br, bY + bH);
      ctx.arcTo(bX, bY + bH, bX, bY + bH - br, br);
      ctx.lineTo(bX, bY + br);
      ctx.arcTo(bX, bY, bX + br, bY, br);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#6b0000";
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], bX + 8, bY + 8 + i * lineH);
      }
    }

    ctx.restore();
  }

  function drawQualityBoss() {
    const b = game.qualityBoss;
    if (b.phase === "idle") return;

    const shakeX = b.shake > 0 ? (Math.random() - 0.5) * 2.4 : 0;
    const bob = b.phase === "yelling" ? Math.sin(game.time * 10) * 2 : 0;

    ctx.save();
    ctx.translate(b.x + shakeX, b.y + bob);

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 42, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0d1324";
    fillRoundedRect(-13, 26, 10, 20, 4);
    fillRoundedRect(3, 26, 10, 20, 4);
    ctx.fillStyle = "#070b16";
    fillRoundedRect(-15, 42, 13, 6, 3);
    fillRoundedRect(3, 42, 13, 6, 3);

    const suitGrad = ctx.createLinearGradient(-15, -12, 15, 28);
    suitGrad.addColorStop(0, "#5f7ea5");
    suitGrad.addColorStop(0.5, "#39557c");
    suitGrad.addColorStop(1, "#22314f");
    ctx.fillStyle = suitGrad;
    fillRoundedRect(-15, -12, 30, 39, 7);

    ctx.fillStyle = "#1b2842";
    fillRoundedRect(-4, -8, 8, 26, 3);

    ctx.fillStyle = "#334b70";
    fillRoundedRect(-26, -10, 12, 22, 4);
    fillRoundedRect(14, -10, 12, 22, 4);

    ctx.fillStyle = "#f0b870";
    ctx.beginPath();
    ctx.arc(-20, 14, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(20, 14, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f0b870";
    fillRoundedRect(-5, -20, 10, 10, 3);
    ctx.beginPath();
    ctx.arc(0, -30, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1a2233";
    ctx.beginPath();
    ctx.ellipse(0, -40, 14, 6, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-5, -30, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5, -30, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f1728";
    ctx.beginPath();
    ctx.arc(-5, -30, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -30, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#0f1728";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-9, -34);
    ctx.lineTo(-2, -32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(9, -34);
    ctx.lineTo(2, -32);
    ctx.stroke();

    ctx.fillStyle = "#0f1728";
    fillRoundedRect(-7, -20, 14, 11, 3);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    fillRoundedRect(-22, -5, 44, 13, 4);
    ctx.fillStyle = "#22314f";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("QUALITY", 0, 1);

    ctx.fillStyle = "#d7dfef";
    fillRoundedRect(18, 1, 16, 12, 2);
    ctx.strokeStyle = "#7a8da8";
    ctx.lineWidth = 1;
    ctx.strokeRect(18, 1, 16, 12);

    if (b.phase === "yelling") {
      const msg = QUALITY_LINES[b.msgIndex];
      const maxW = 220;
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      const words = msg.split(" ");
      const lines = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (ctx.measureText(test).width > maxW - 16) {
          if (cur) lines.push(cur);
          cur = w;
        } else {
          cur = test;
        }
      }
      if (cur) lines.push(cur);

      const lineH = 16;
      const bW = maxW;
      const bH = lines.length * lineH + 16;
      const bX = -bW - 24;
      const bY = -62 - bH;

      ctx.fillStyle = "rgba(236, 244, 255, 0.97)";
      ctx.strokeStyle = "#39557c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const br = 8;
      ctx.moveTo(bX + br, bY);
      ctx.lineTo(bX + bW - br, bY);
      ctx.arcTo(bX + bW, bY, bX + bW, bY + br, br);
      ctx.lineTo(bX + bW, bY + bH - br);
      ctx.arcTo(bX + bW, bY + bH, bX + bW - br, bY + bH, br);
      ctx.lineTo(bX + bW - 26, bY + bH);
      ctx.lineTo(bX + bW - 10, bY + bH + 12);
      ctx.lineTo(bX + bW - 38, bY + bH);
      ctx.lineTo(bX + br, bY + bH);
      ctx.arcTo(bX, bY + bH, bX, bY + bH - br, br);
      ctx.lineTo(bX, bY + br);
      ctx.arcTo(bX, bY, bX + br, bY, br);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#22314f";
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], bX + 8, bY + 8 + i * lineH);
      }
    }

    ctx.restore();
  }

  function drawCookieDayBanner() {
    const cd = game.cookieDay;
    if (cd.banner <= 0) return;

    const alpha = Math.min(1, cd.banner * 0.6);
    ctx.save();
    ctx.globalAlpha = alpha;

    const bW = 340;
    const bH = 80;
    const bX = (game.viewWidth - bW) / 2;
    const bY = game.viewHeight * 0.22;

    // Banner background
    const banGrad = ctx.createLinearGradient(bX, bY, bX + bW, bY + bH);
    banGrad.addColorStop(0, "#8B4513");
    banGrad.addColorStop(0.5, "#D2691E");
    banGrad.addColorStop(1, "#8B4513");
    ctx.fillStyle = banGrad;
    ctx.strokeStyle = "#F4A460";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const r = 14;
    ctx.moveTo(bX + r, bY);
    ctx.arcTo(bX + bW, bY, bX + bW, bY + bH, r);
    ctx.arcTo(bX + bW, bY + bH, bX, bY + bH, r);
    ctx.arcTo(bX, bY + bH, bX, bY, r);
    ctx.arcTo(bX, bY, bX + bW, bY, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cookie emoji + text
    ctx.fillStyle = "#FFF8DC";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("COOKIE DAY SURPRISE!", bX + bW / 2, bY + 28);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#FFE4B5";
    ctx.fillText("Free cookies in the break room! Bonus cash earned!", bX + bW / 2, bY + 56);

    ctx.restore();
  }

  function update(dt) {
    game.time += dt;

    if (game.sessionEnded) {
      game.sessionEndTimer += dt;
      updateUI();
      return;
    }

    if (game.pause.forced) {
      game.pause.timer -= dt;
      if (game.pause.timer <= 0) {
        clearForcedPause();
      }
    }

    if (isGamePaused()) {
      updateUI();
      return;
    }

    game.elapsed += dt;

    const size = getWorldSize();
    game.width = size.width;
    game.height = size.height;

    updatePlayer(dt);
    updateIncident(dt);

    if (!game.incident.active) {
      updateWorkers(dt);
      updateAircraft(dt);
      updateSpawn(dt);
    }

    updateIdleIncome(dt);
    updateCombo(dt);
    updateBoss(dt);
    updateQualityBoss(dt);
    updateCookieDay(dt);
    updateDayEvents();
    updateCamera();

    game.saveTimer += dt;
    if (game.saveTimer > 2) {
      game.saveTimer = 0;
      saveGame();
    }

    if (
      isCloudEnabled() &&
      !game.leaderboard.syncing &&
      game.elapsed - game.leaderboard.lastSyncElapsed >= CLOUD_SYNC_INTERVAL_SECONDS
    ) {
      submitLeaderboardScore(false);
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
    if (isGamePaused()) return;
    ensureAudio();

    if (ev.target === canvas) {
      const p = screenToWorld(ev.clientX, ev.clientY);
      tapAircraftInteraction(p);
    }
  }

  function setupControls() {
    window.addEventListener("keydown", (ev) => {
      const key = ev.key.toLowerCase();
      if (key === "p") {
        togglePause();
        return;
      }

      if (isGamePaused()) return;

      game.input.keys[key] = true;
      if (key === " " || key === "e") {
        ev.preventDefault();
        if (!ev.repeat) {
          startActionPress();
        }
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
      if (isGamePaused()) {
        if (key === " " || key === "e") game.input.actionHeld = false;
        return;
      }
      game.input.keys[key] = false;
      if (key === " " || key === "e") {
        ev.preventDefault();
        endActionPress();
      }
    });

    canvas.addEventListener("pointerdown", handlePointerDown);

    interactBtn.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      startActionPress();
    });
    interactBtn.addEventListener("pointerup", () => {
      endActionPress();
    });
    interactBtn.addEventListener("pointercancel", () => {
      endActionPress();
    });
    interactBtn.addEventListener("pointerleave", () => {
      endActionPress();
    });
    const joy = {
      activeId: null,
      centerX: 0,
      centerY: 0,
      radius: 54,
      thumbCenter: 45
    };

    function resetJoy() {
      game.input.joystickActive = false;
      game.input.joyX = 0;
      game.input.joyY = 0;
      const bw = joystickBase.offsetWidth;
      const tw = joystickThumb.offsetWidth;
      const center = Math.round((bw - tw) / 2);
      joystickThumb.style.left = `${center}px`;
      joystickThumb.style.top = `${center}px`;
    }

    joystickArea.addEventListener("pointerdown", (ev) => {
      if (isGamePaused()) return;
      ensureAudio();
      joy.activeId = ev.pointerId;
      game.input.joystickActive = true;
      const rect = joystickBase.getBoundingClientRect();
      joy.centerX = rect.left + rect.width / 2;
      joy.centerY = rect.top + rect.height / 2;
      joy.thumbCenter = Math.round((rect.width - joystickThumb.offsetWidth) / 2);
      joy.radius = rect.width / 2 - joystickThumb.offsetWidth / 2 - 2;
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
      joystickThumb.style.left = `${joy.thumbCenter + lx}px`;
      joystickThumb.style.top = `${joy.thumbCenter + ly}px`;
    });

    function joyEnd(ev) {
      if (ev.pointerId !== joy.activeId) return;
      joy.activeId = null;
      resetJoy();
    }

    joystickArea.addEventListener("pointerup", joyEnd);
    joystickArea.addEventListener("pointercancel", joyEnd);

    upgradeBtn.addEventListener("click", openUpgradeModal);
    boardBtn.addEventListener("click", openBoardModal);

    pauseBtn.addEventListener("click", togglePause);
    saveBtn.addEventListener("click", saveProgressWithFeedback);

    settingsBtn.addEventListener("click", () => {
      settingsModal.showModal();
    });

    fullscreenBtn.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", () => {
      updateFullscreenButtonLabel();
      queueResize();
      if (!document.fullscreenElement) {
        setTimeout(() => {
          maybeShowLandscapeSpaceHint(true);
        }, 120);
      }
    });

    claimDailyBtn.addEventListener("click", () => {
      claimDailyReward();
      dailyModal.close();
    });

    saveCharacterBtn.addEventListener("click", () => {
      game.state.characterName = cleanCharacterName(characterNameInput.value);
      cloudProfile.characterName = game.state.characterName;
      saveCloudProfile();
      characterNameInput.value = game.state.characterName;
      saveGame();
      setBoardStatus(`Saved as ${game.state.characterName}`);
      showToast(`Name set: ${game.state.characterName}`);
    });

    submitBoardBtn.addEventListener("click", async () => {
      await submitLeaderboardScore(true);
      await fetchLeaderboardRows().catch(() => {});
    });

    refreshBoardBtn.addEventListener("click", async () => {
      await fetchLeaderboardRows().catch(() => {
        showToast("Board refresh failed");
      });
    });

    characterNameInput.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      saveCharacterBtn.click();
    });

    soundToggle.addEventListener("change", () => {
      game.settings.sound = soundToggle.checked;
    });

    vibrationToggle.addEventListener("change", () => {
      game.settings.vibration = vibrationToggle.checked;
    });

    window.addEventListener("resize", queueResize);
    window.addEventListener("orientationchange", () => {
      queueResize();
      setTimeout(queueResize, 140);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", queueResize);
      window.visualViewport.addEventListener("scroll", queueResize);
    }
    window.addEventListener("beforeunload", saveGame);
  }

  function openUpgradeModal() {
    updateUpgradeUI();
    upgradeModal.showModal();
  }

  async function openBoardModal() {
    if (!boardModal) return;
    characterNameInput.value = cleanCharacterName(game.state.characterName || cloudProfile.characterName);
    boardModal.showModal();
    setBoardStatus(isCloudEnabled() ? "Loading global standings..." : "Cloud not configured. Add MOTY_CONFIG in config.js.");
    try {
      await fetchLeaderboardRows();
    } catch (_err) {
      renderBoardRows([]);
      setBoardStatus("Could not load board. Verify cloud configuration.");
    }
  }

  function isLikelyMobileDevice() {
    return window.matchMedia("(max-width: 980px), (pointer: coarse)").matches;
  }

  function updateFullscreenButtonLabel() {
    fullscreenBtn.textContent = document.fullscreenElement ? "Minimize" : "Fullscreen";
  }

  function armMobileFullscreenFallback() {
    if (!isLikelyMobileDevice() || document.fullscreenElement) return;

    const root = document.documentElement;
    const attempt = async () => {
      if (document.fullscreenElement) return;
      try {
        await root.requestFullscreen();
      } catch (_err) {
        // Some browsers still block fullscreen even after gesture.
      }
      updateFullscreenButtonLabel();
      window.removeEventListener("pointerdown", attempt, true);
      window.removeEventListener("keydown", attempt, true);
      window.removeEventListener("touchstart", attempt, true);
    };

    window.addEventListener("pointerdown", attempt, true);
    window.addEventListener("keydown", attempt, true);
    window.addEventListener("touchstart", attempt, true);
    showToast("Tap once to enter fullscreen");
  }

  async function autoFullscreenForMobile() {
    if (!isLikelyMobileDevice() || document.fullscreenElement) {
      updateFullscreenButtonLabel();
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
    } catch (_err) {
      armMobileFullscreenFallback();
    }
    updateFullscreenButtonLabel();
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
      showToast("Fullscreen off");
    }
    updateFullscreenButtonLabel();
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
    applyProfileToState();
    game.dayTracker.currentDay = getCurrentDay();
    game.dayTracker.season = getCurrentSeason();
    setupControls();
    resize();
    applyLoadedSettings();
    updateFullscreenButtonLabel();
    autoFullscreenForMobile();
    runTutorialIfNeeded();
    checkDailyRewardPrompt();

    for (let i = 0; i < 2; i += 1) spawnAircraft();

    updateUpgradeUI();
    updateUI();
    renderBoardRows(game.leaderboard.rows);
    setBoardStatus(isCloudEnabled() ? "Ready to sync global standings" : "Cloud not configured. Add MOTY_CONFIG in config.js.");
    requestAnimationFrame(frame);
  }

  init();
})();
