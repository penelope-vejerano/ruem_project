/* ============================================================
   TABLE OF CONTENTS
   PART 1  Canvas setup + resizing
   PART 2  Save system (localStorage)
   PART 3  Input (keyboard, mouse, buttons)
   PART 4  Game pages (games/<game>/)
   PART 5  Turn logic / local multiplayer
   PART 6  Scenes (menu, ready, results, leaderboard, export/import)
   PART 7  Digital pet
   PART 8  Main loop
   Tip: every PART and every GAME is a foldable region in VS Code.
        Fold all: Ctrl+K Ctrl+0    Unfold all: Ctrl+K Ctrl+J
   ============================================================ */


//#region PART 1 - CANVAS SETUP + RESIZING
/* =========================================================
   PART 1 - CANVAS SETUP + RESIZING
   The game is drawn in a fixed "logical" 800x500 space.
   On every window resize we compute a scale + offset so the
   logical space always fits the window (letterboxed).
   ========================================================= */
const W = 800, H = 500;
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const gameFrame = document.getElementById('gameFrame');
let sc = 1, ox = 0, oy = 0, dpr = 1;
const FONT = 'Fredoka, "Segoe UI", sans-serif';
const C = {
  plum: '#38283F',
  cotton: '#F4D9EE',
  bubblegum: '#DCA6E9',
  red: '#E94E70',
  butter: '#FFD66E',
  vanilla: '#FFF5E9',
  hair: '#2A1C32',
  cream: '#FFF8F0'
};
const menuBackground = new Image();
menuBackground.src = 'assets/arcade-room.png';

// Load the actual Ruem character image (your uploaded Ruem, single character)
const ruemImage = new Image();
ruemImage.src = 'assets/ruem.png';
let ruemImageReady = false;
ruemImage.onload = () => { ruemImageReady = true; };

function resize() {
  dpr = window.devicePixelRatio || 1;
  const box = cv.getBoundingClientRect();                 // the size the CSS gave the canvas
  cv.width = Math.max(1, Math.floor(box.width * dpr));
  cv.height = Math.max(1, Math.floor(box.height * dpr));
  sc = Math.min(cv.width / W, cv.height / H);
  ox = (cv.width - W * sc) / 2;
  oy = (cv.height - H * sc) / 2;
}
addEventListener('resize', resize);
resize();

//#endregion


//#region PART 2 - SAVE SYSTEM (local only)
/* =========================================================
   PART 2 - SAVE SYSTEM (local only)
   Everything lives in the browser's localStorage on this
   computer. Nothing is ever sent anywhere. Export/Import
   buttons let you copy the save as a .json file.
   ========================================================= */
// ---------- SAVE KEY + GAME LIST ----------
const KEY = 'miniArcadeSave_v1';
const GAMES = [
  { id: 'catch',  name: 'Star Catcher' },
  { id: 'target', name: 'Target Rush' },
  { id: 'runner', name: 'Ruins Runner' },
  { id: 'smash',  name: 'Badminton Smash' },
];
const HINTS = {
  catch: 'Catch stars, dodge bombs. 3 lives. Mouse or arrows.',
  target: 'Click targets for 30 seconds. Misses cost points.',
  runner: 'Run! A/D or arrows = lane, W/Up/Space = jump, S/Down = slide. Grab coins and power-ups.',
  smash: 'Move with ←/→. Time Space to return; press S for a smash or F for a drop.'
};


// ---------- LOAD / SAVE FUNCTIONS ----------
function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.players) return d;
  } catch (e) {}
  return { players: {}, p1: null, p2: null, mode: 'solo' };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }


// ---------- PLAYER PROFILES ----------
function getPlayer(name) {
  if (!S.players[name]) {
    S.players[name] = {
      scores: { catch: 0, target: 0, runner: 0, smash: 0 },
      coins: 0,
      pet: { name: 'Ruem', hunger: 80, joy: 80, last: Date.now() }
    };
  }
  for (const g of GAMES) if (typeof S.players[name].scores[g.id] !== 'number') S.players[name].scores[g.id] = 0;   // old saves get the new game's slot
  if (S.players[name].pet && S.players[name].pet.name === 'Ruem') S.players[name].pet.name = 'Ruem';
  return S.players[name];
}


// ---------- CREATE THE SAVE OBJECT 'S' ----------
const S = loadSave();
if (!S.p1) S.p1 = 'Player1';
if (!S.p2) S.p2 = 'Player2';
getPlayer(S.p1); save();

//#endregion


//#region PART 3 - INPUT
/* =========================================================
   PART 3 - INPUT
   Keyboard state, mouse position in logical coordinates, and
   an immediate-mode button system: every frame, scenes call
   btn(...) which both draws a button and registers its
   clickable area in `hits`.
   ========================================================= */
// ---------- KEYBOARD + MOUSE STATE ----------
const keys = {};
const mouse = { x: W / 2, y: H / 2, active: false };
let hits = [];

const cursorDot = document.createElement('div');
const cursorRing = document.createElement('div');
cursorDot.className = 'cursor-dot';
cursorRing.className = 'cursor-ring';
document.body.append(cursorDot, cursorRing);
cursorDot.hidden = true;
cursorRing.hidden = true;
let cursorRingX = innerWidth / 2;
let cursorRingY = innerHeight / 2;
let cursorTargetX = cursorRingX;
let cursorTargetY = cursorRingY;
const buttonMotion = new Map();
let pressedButton = null;

function animateCursor() {
  cursorRingX += (cursorTargetX - cursorRingX) * .38;
  cursorRingY += (cursorTargetY - cursorRingY) * .38;
  cursorRing.style.left = cursorRingX + 'px';
  cursorRing.style.top = cursorRingY + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();


// ---------- KEY PRESS LISTENERS ----------
addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault();
  if (scene.key) scene.key(e.key.toLowerCase());
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });


// ---------- MOUSE / CLICK LISTENERS ----------
function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * dpr - ox) / sc, y: ((e.clientY - r.top) * dpr - oy) / sc };
}
cv.addEventListener('pointermove', e => {
  const p = toLogical(e);
  mouse.x = p.x; mouse.y = p.y; mouse.active = true;
  cursorDot.style.left = e.clientX + 'px';
  cursorDot.style.top = e.clientY + 'px';
  cursorTargetX = e.clientX;
  cursorTargetY = e.clientY;
  const hovering = hits.some(h =>
    p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h
  );
  cursorDot.classList.toggle('is-hovering', hovering);
  cursorRing.classList.toggle('is-hovering', hovering);
});
cv.addEventListener('pointerenter', () => {
  cursorDot.hidden = false;
  cursorRing.hidden = false;
});
cv.addEventListener('pointerleave', () => {
  cursorDot.hidden = true;
  cursorRing.hidden = true;
  cursorDot.classList.remove('is-hovering', 'is-clicking');
  cursorRing.classList.remove('is-hovering', 'is-clicking');
});
cv.addEventListener('pointerdown', e => {
  const p = toLogical(e); mouse.x = p.x; mouse.y = p.y;
  cursorDot.classList.add('is-clicking');
  cursorRing.classList.add('is-clicking');
  for (let i = hits.length - 1; i >= 0; i--) {          // top-most button first
    const h = hits[i];
    if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
      pressedButton = h.key;
      h.fn();
      setTimeout(() => { pressedButton = null; }, 150);
      return;
    }
  }
  setTimeout(() => { pressedButton = null; }, 150);
  if (scene.click) scene.click(p.x, p.y);
});
addEventListener('pointerup', () => {
  cursorDot.classList.remove('is-clicking');
  cursorRing.classList.remove('is-clicking');
});


// ---------- BUTTON HELPER (draws a button + registers its click area) ----------
function btn(x, y, w, h, label, fn, size = 16, kind = 'vanilla') {
  const key = `${x}:${y}:${w}:${h}:${label}`;
  hits.push({ x, y, w, h, fn, key });
  const hover = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  const pressing = pressedButton === key;
  let scale = buttonMotion.get(key) ?? 1;
  scale += ((hover ? 1.05 : 1) * (pressing ? .96 : 1) - scale) * .28;
  buttonMotion.set(key, scale);

  const skins = {
    vanilla: { top: '#FFFFFF', fill: C.vanilla, lip: '#E9D2C4', text: C.plum },
    yellow: { top: '#FFE9A8', fill: C.butter, lip: '#E0B445', text: C.plum },
    pink: { top: '#F4D4F8', fill: C.bubblegum, lip: '#C48AD4', text: C.plum },
    red: { top: '#F48AA0', fill: C.red, lip: '#C43A58', text: C.vanilla }
  };
  const skin = skins[kind] || skins.vanilla;
  const radius = Math.min(h / 2, 22);
  const lift = hover ? -2 + Math.sin(performance.now() / 160) * 1.1 : 0;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + lift);
  ctx.scale(scale, scale);
  ctx.translate(-(x + w / 2), -(y + h / 2));

  ctx.fillStyle = C.plum;
  rr(x, y + 5, w, h, radius); ctx.fill();

  const gradient = ctx.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, hover ? skin.top : '#fff');
  gradient.addColorStop(.22, skin.top);
  gradient.addColorStop(1, skin.fill);
  ctx.fillStyle = gradient;
  rr(x, y, w, h, radius); ctx.fill();

  ctx.strokeStyle = C.plum;
  ctx.lineWidth = 3.2;
  ctx.lineJoin = 'round';
  rr(x + 1.6, y + 1.6, w - 3.2, h - 3.2, radius - 1); ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(x + w * .5, y + h * .28, w * .34, h * .16, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.fill();

  ctx.fillStyle = skin.text;
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

// ---------- DRAWING HELPERS (rounded rectangle, text) ----------
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function text(str, x, y, size = 18, color = C.plum, align = 'center', weight = 600) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function cuteCard(x, y, w, h, r = 24, fill = 'rgba(255,245,233,.92)') {
  ctx.save();
  ctx.fillStyle = C.plum;
  rr(x, y + 6, w, h, r); ctx.fill();
  ctx.fillStyle = fill;
  rr(x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = C.plum;
  ctx.lineWidth = 3.4;
  rr(x + 1.7, y + 1.7, w - 3.4, h - 3.4, r - 1); ctx.stroke();
  ctx.strokeStyle = 'rgba(220,166,233,.85)';
  ctx.lineWidth = 2;
  rr(x + 8, y + 8, w - 16, h - 16, Math.max(8, r - 8)); ctx.stroke();
  ctx.restore();
}

function drawStar(cx, cy, outer, inner, fill = C.butter) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const b = a + Math.PI / 5;
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    ctx.lineTo(cx + Math.cos(b) * inner, cy + Math.sin(b) * inner);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = C.plum;
  ctx.lineWidth = Math.max(1.4, outer * .18);
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
}

function drawArcadeBackdrop() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cw = cv.width, ch = cv.height;
  if (menuBackground.complete && menuBackground.naturalWidth > 0) {
    const scale = Math.max(cw / menuBackground.naturalWidth, ch / menuBackground.naturalHeight);
    const width = menuBackground.naturalWidth * scale;
    const height = menuBackground.naturalHeight * scale;
    ctx.drawImage(menuBackground, (cw - width) / 2, (ch - height) / 2, width, height);
  } else {
    ctx.fillStyle = C.cotton;
    ctx.fillRect(0, 0, cw, ch);
  }
  ctx.restore();
}

//#endregion




//#region PART 5 - MULTIPLAYER (local hot-seat)
/* =========================================================
   PART 5 - MULTIPLAYER (local hot-seat)
   "Versus" mode: Player 1 plays, then Player 2 plays on the
   same computer, then scores are compared. Each profile has
   its own best scores + coins saved in the local save file.
   ========================================================= */
// ---------- TURN / RESULT STATE ----------
let turns = [], results = [], currentGame = null;
let activePlayer = null;


// ---------- START A GAME (solo or versus) ----------
function startGame(id) {
  currentGame = id;
  turns = S.mode === 'versus' ? [S.p1, S.p2] : [S.p1];
  results = [];
  nextTurn();
}
function nextTurn() {
  const who = turns[results.length];
  scene = readyScene(who);
}

// ---------- GAME OVER: SAVE SCORE, THEN NEXT PLAYER OR RESULTS ----------
function onFinish(who, score) {
  const pl = getPlayer(who);
  if (score > pl.scores[currentGame]) pl.scores[currentGame] = score;
  pl.coins += Math.floor(score / 10);
  results.push({ name: who, score });
  save();
  setTimeout(() => {
    gameFrame.hidden = true;
    gameFrame.src = 'about:blank';
    cv.hidden = false;
    resize();
    scene = results.length < turns.length ? readyScene(turns[results.length]) : resultsScene();
  }, 900);
}

//#endregion


//#region PART 6 - SCENES (menu, ready screen, playing, results,
/* =========================================================
   PART 6 - SCENES (menu, ready screen, playing, results,
   leaderboard). `scene` is whichever one is active.
   ========================================================= */
// ---------- 'scene' = WHICHEVER SCREEN IS ACTIVE ----------
let scene;

function launchEmbeddedGame(who) {
  activePlayer = who;
  cv.hidden = true;
  gameFrame.hidden = false;
  gameFrame.src = 'games/' + currentGame + '/index.html';
}

addEventListener('message', e => {
  if (e.source !== gameFrame.contentWindow || !e.data || typeof e.data !== 'object') return;
  if (e.data.type === 'arcade:quit') {
    gameFrame.hidden = true;
    gameFrame.src = 'about:blank';
    cv.hidden = false;
    resize();
    activePlayer = null;
    scene = menuScene();
    return;
  }
  if (e.data.type !== 'arcade:game-over' || activePlayer === null ||
      !Number.isFinite(e.data.score) || e.data.score < 0) return;

  const who = activePlayer;
  activePlayer = null;
  onFinish(who, Math.floor(e.data.score));
});


/* ############################################################
   ##  SCENE: MAIN MENU
   ##  Player names, mode switch, game buttons, leaderboard, export/import.
   ############################################################ */
function menuScene() {
  return {
    isMenu: true,
    update() {},
    draw() {
      // Title card — centered at top with breathing room
      cuteCard(180, 20, 440, 80, 26, 'rgba(255,245,233,.9)');
      drawStar(208, 60, 13, 5.5);
      drawStar(592, 60, 11, 4.5);
      text("Ruem's Arcade", 400, 52, 32, C.plum, 'center', 700);
      text('your pocket buddy arcade', 400, 80, 13, C.red, 'center', 500);

      // Left side — compact vertical stack with proper spacing
      btn(90, 125, 210, 38, 'Player 1: ' + S.p1, () => { setName('p1'); }, 14, 'pink');
      if (S.mode === 'versus') btn(320, 125, 210, 38, 'Player 2: ' + S.p2, () => { setName('p2'); }, 14, 'pink');
      else btn(320, 125, 210, 38, 'Mode: Solo', () => { S.mode = 'versus'; save(); }, 14, 'vanilla');
      if (S.mode === 'versus') {
        btn(90, 175, 440, 36, 'Mode: Versus (2P, same PC)', () => { S.mode = 'solo'; save(); }, 14, 'vanilla');
      }

      GAMES.forEach((g, i) => {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const y = (S.mode === 'versus' ? 230 : 190) + row * 68;
        const x = 90 + col * 230;
        btn(x, y, 210, 52, g.name + '  ★' + getPlayer(S.p1).scores[g.id], () => startGame(g.id), 15, 'yellow');
      });

      const toolsY = S.mode === 'versus' ? 390 : 340;
      btn(90, toolsY, 140, 36, 'Leaderboard', () => { scene = leaderboardScene(); }, 13, 'pink');
      btn(245, toolsY, 140, 36, 'Export save', exportSave, 13, 'vanilla');
      btn(400, toolsY, 140, 36, 'Import save', () => document.getElementById('importFile').click(), 13, 'vanilla');
    }
  };
}


// ---------- HELPER: CHANGE A PLAYER NAME ----------
function setName(slot) {
  const n = (prompt('Enter a player name (new or existing):', S[slot]) || '').trim().slice(0, 12);
  if (n) { S[slot] = n; getPlayer(n); save(); }
}


/* ############################################################
   ##  SCENE: READY SCREEN
   ##  Shows the game name and hint, Start button begins the game.
   ############################################################ */
function readyScene(who) {
  return {
    update() {}, draw() {
      const g = GAMES.find(x => x.id === currentGame);
      cuteCard(150, 70, 500, 320, 28);
      drawStar(190, 112, 14, 6);
      drawStar(610, 112, 12, 5);
      text(g.name, 400, 118, 34, C.plum, 'center', 700);
      text(HINTS[currentGame], 400, 178, 16, C.plum);
      text('Get ready, ' + who + '!', 400, 230, 24, C.red, 'center', 700);
      btn(275, 278, 250, 54, 'Start', () => {
        launchEmbeddedGame(who);
      }, 22, 'yellow');
    }
  };
}


/* ############################################################
   ##  SCENE: RESULTS
   ##  Shows scores (and the winner in versus mode).
   ############################################################ */
function resultsScene() {
  return {
    update() {}, draw() {
      cuteCard(150, 56, 500, 360, 28);
      text('Results', 400, 96, 20, C.red, 'center', 700);
      text(GAMES.find(x => x.id === currentGame).name, 400, 128, 30, C.plum, 'center', 700);
      results.forEach((r, i) => text(r.name + ': ' + r.score, 400, 180 + i * 40, 24));
      if (results.length === 2) {
        const [a, b] = results;
        text(a.score === b.score ? "It's a tie!" : (a.score > b.score ? a.name : b.name) + ' wins!', 400, 270, 26, C.red, 'center', 700);
      }
      btn(210, 320, 170, 46, 'Play again', () => startGame(currentGame), 16, 'yellow');
      btn(420, 320, 150, 46, 'Menu', () => { scene = menuScene(); }, 16, 'pink');
    }
  };
}


/* ############################################################
   ##  SCENE: LEADERBOARD
   ##  Best scores of every saved player.
   ############################################################ */
function leaderboardScene() {
  return {
    update() {}, draw() {
      cuteCard(40, 24, 720, 430, 28);
      text('Leaderboard', 400, 56, 28, C.plum, 'center', 700);
      text('best scores', 400, 82, 14, C.red);
      text('Player', 80, 118, 14, C.plum, 'left');
      GAMES.forEach((g, i) => text(g.name, 250 + i * 130, 118, 13, C.plum));
      Object.keys(S.players).slice(0, 10).forEach((n, r) => {
        text(n, 80, 150 + r * 26, 15, C.plum, 'left');
        GAMES.forEach((g, i) => text(String(S.players[n].scores[g.id] ?? 0), 250 + i * 130, 150 + r * 26, 15));
      });
      btn(58, 40, 86, 32, 'Back', () => { scene = menuScene(); }, 13, 'pink');
    }
  };
}


/* ############################################################
   ##  EXPORT / IMPORT SAVE FILE
   ##  Copy the save to a .json file, or load one back in.
   ############################################################ */
function exportSave() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
  a.download = 'RuemArcade.json'; a.click(); URL.revokeObjectURL(a.href);
}
document.getElementById('importFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d.players) throw 0;
      Object.assign(S.players, d.players); save(); alert('Save imported!');
    } catch (err) { alert('That file is not a valid save.'); }
  };
  rd.readAsText(f); e.target.value = '';
});

//#endregion


//#region PART 7 - DIGITAL PET
/* =========================================================
   PART 7 - DIGITAL PET
   Belongs to Player 1's profile. Hunger and joy slowly drop
   in real time (and a little while the game was closed).
   Click the pet to cheer it up, press Feed (5 coins) to feed.
   Coins are earned from game scores.
   ========================================================= */
// ---------- PET STATE ----------
let petT = 0, hop = 0, saveT = 0, hungerT = 0;
const pet = () => getPlayer(S.p1).pet;


// ---------- PET: CATCH UP ON TIME PASSED WHILE THE GAME WAS CLOSED ----------
(function offlineDecay() {            // apply time passed since last visit (max 1 hour)
  const p = pet(), el = Math.min((Date.now() - p.last) / 1000, 3600);
  p.hunger = Math.max(0, p.hunger - el * 0.05); p.joy = Math.max(0, p.joy - el * 0.03);
})();


// ---------- PET: DRAIN HUNGER AND JOY EVERY FRAME ----------
function tickPet(dt) {
  const p = pet();
  // Hunger drops by -10 every 24 seconds → 100 → 0 in exactly 4 minutes (240s)
  hungerT += dt;
  while (hungerT >= 24) {
    hungerT -= 24;
    p.hunger = Math.max(0, p.hunger - 10);
  }
  p.joy = Math.max(0, p.joy - dt * 0.25);
  p.last = Date.now(); petT += dt; hop = Math.max(0, hop - dt * 3);
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
}


// ---------- PET: DRAW THE PET + FEED BUTTON ----------
function drawPet() {
  const p = pet(), pl = getPlayer(S.p1), mood = (p.hunger + p.joy) / 2;
  const bounce = Math.sin(petT * 3) * 4 + Math.sin(hop * Math.PI) * 18;

  // Pet card — right side, tall enough so nothing overlaps
  cuteCard(590, 130, 240, 300, 24, 'rgba(255,245,233,.95)');

  // Name above the head — not covered by anything
  text(p.name, 710, 165, 16, C.plum, 'center', 700);

  // Hit area for clicking the pet
  hits.push({ x: 600, y: 180, w: 220, h: 100, fn: () => { p.joy = Math.min(100, p.joy + 8); hop = 1; } });

  // Draw the actual Ruem image in center of card (above the bars)
  if (ruemImageReady && ruemImage.complete && ruemImage.naturalWidth > 0) {
    const imgW = ruemImage.naturalWidth, imgH = ruemImage.naturalHeight;
    const drawSize = 140;
    const scale = Math.min(drawSize / imgW, drawSize / imgH);
    const dw = imgW * scale, dh = imgH * scale;
    ctx.save();
    ctx.translate(710, 240 - bounce);
    ctx.scale(scale, scale);
    ctx.drawImage(ruemImage, -dw / 2, -dh / 2);
    ctx.restore();
  } else {
    // Fallback: drawn Ruem if image not loaded yet
    drawRuem(710, 260 - bounce, 1.4, mood);
  }

  // Food / Joy bars — below the image, clearly separated
  bar(610, 335, p.hunger, C.red, 'Food');
  bar(710, 335, p.joy, C.bubblegum, 'Joy');

  // Feed 5 button centered at bottom, star counter centered below it
  btn(665, 362, 90, 28, 'Feed 5', () => {
    if (pl.coins >= 5) { pl.coins -= 5; p.hunger = Math.min(100, p.hunger + 25); p.joy = Math.min(100, p.joy + 3); hop = 1; save(); }
  }, 11, 'yellow');
  drawStar(695, 398, 8, 3.4);
  text(String(pl.coins), 710, 398, 14, C.plum, 'center', 700);
}

function bar(x, y, v, color, label) {
  ctx.fillStyle = C.vanilla;
  rr(x, y, 78, 12, 6); ctx.fill();
  ctx.strokeStyle = C.plum;
  ctx.lineWidth = 2;
  rr(x, y, 78, 12, 6); ctx.stroke();
  ctx.save();
  ctx.beginPath();
  rr(x, y, 78, 12, 6);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 78 * v / 100, 12);
  ctx.restore();
  text(label, x + 39, y + 22, 10, C.plum);
}

function drawRuem(x, y, scale, mood) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(petT * 2.2) * 0.05);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  function paint(fill, width = 2.3) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = C.plum;
    ctx.lineWidth = width;
    ctx.fill();
    ctx.stroke();
  }

  function hairFlap(side) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(-8, -18);
    ctx.bezierCurveTo(-22, -34, -40, -22, -38, 2);
    ctx.bezierCurveTo(-36, 22, -22, 28, -14, 18);
    ctx.bezierCurveTo(-8, 10, -6, 0, -7, -8);
    ctx.closePath();
    paint(C.hair, 2.4);
    ctx.beginPath();
    ctx.moveTo(-14, -12);
    ctx.bezierCurveTo(-26, -16, -30, 2, -24, 12);
    ctx.bezierCurveTo(-18, 10, -14, 0, -13, -6);
    ctx.closePath();
    ctx.fillStyle = C.red;
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.ellipse(18, 14, 8, 6.5, -0.45, 0, Math.PI * 2);
  paint(C.hair, 2);
  drawStar(24, 10, 5.5, 2.3);

  hairFlap(-1);
  hairFlap(1);

  ctx.beginPath();
  ctx.ellipse(0, 6, 22, 20, 0, 0, Math.PI * 2);
  paint('#FFF7EE', 2.6);
  ctx.beginPath();
  ctx.ellipse(-6, 0, 8, 6, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-21, 2);
  ctx.bezierCurveTo(-23, -24, -8, -31, 0, -31);
  ctx.bezierCurveTo(8, -31, 23, -24, 21, 2);
  ctx.quadraticCurveTo(10, -8, 5, -7);
  ctx.quadraticCurveTo(0, -16, -5, -7);
  ctx.quadraticCurveTo(-10, -8, -21, 2);
  paint(C.hair, 2.4);

  ctx.beginPath();
  ctx.moveTo(0, -29);
  ctx.quadraticCurveTo(12, -38, 4, -44);
  ctx.strokeStyle = C.plum;
  ctx.lineWidth = 3.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(3.5, -44, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = C.hair;
  ctx.strokeStyle = C.plum;
  ctx.lineWidth = 1.8;
  ctx.fill();
  ctx.stroke();

  drawStar(-26, -10, 8.5, 3.6);

  // (cheese/sponge removed per request)
  ctx.beginPath();
  ctx.ellipse(-8, 25, 6.5, 3.4, 0, 0, Math.PI * 2);
  paint('#FFF7EE', 2);
  ctx.beginPath();
  ctx.ellipse(8, 25, 6.5, 3.4, 0, 0, Math.PI * 2);
  paint('#FFF7EE', 2);

  ctx.fillStyle = 'rgba(233,78,112,.38)';
  ctx.beginPath(); ctx.ellipse(-12, 6, 4.2, 2.1, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(12, 6, 4.2, 2.1, 0, 0, 7); ctx.fill();

  const sleepy = mood < 28;
  const sad = mood < 45;
  const excited = mood > 78;

  ctx.fillStyle = C.plum;
  if (sleepy) {
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = C.plum;
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.quadraticCurveTo(-8, 3, -4, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(8, 3, 12, 0); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(-8, 0, 3.3, 4.3, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, 0, 3.3, 4.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-7, -1.6, 1.25, 0, 7); ctx.arc(9, -1.6, 1.25, 0, 7); ctx.fill();
    if (sad) {
      ctx.strokeStyle = C.plum;
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(-5, -3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(5, -3); ctx.stroke();
    }
  }

  ctx.strokeStyle = C.plum;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (excited) {
    ctx.ellipse(0, 12, 4.8, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.red;
    ctx.fill();
    ctx.stroke();
  } else if (sad) {
    ctx.moveTo(-6, 14);
    ctx.quadraticCurveTo(0, 9, 6, 14);
    ctx.stroke();
  } else {
    ctx.moveTo(-7, 11);
    ctx.quadraticCurveTo(0, 17, 7, 11);
    ctx.stroke();
  }

  ctx.restore();
}

//#endregion


//#region PART 8 - MAIN LOOP
/* =========================================================
   PART 8 - MAIN LOOP
   Clear -> update -> draw scene -> draw pet on top.
   ========================================================= */
// ---------- START ON THE MENU, THEN RUN THE LOOP ----------
scene = menuScene();
let last = performance.now();

// ---------- ONE FRAME: clear, update, draw, repeat ----------
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  drawArcadeBackdrop();
  ctx.setTransform(sc, 0, 0, sc, ox, oy);
  hits = [];
  scene.update(dt); tickPet(dt);
  scene.draw();
  if (scene.isMenu) drawPet();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
//#endregion
