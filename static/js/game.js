const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game physics
const GRAVITY = 0.6;
const JUMP_POWER = -13;
const MOVE_SPEED = 5;
const COIN_VALUE = 10;

// Camera
let cameraX = 0;

// Inputs
const keys = {
    ArrowLeft: false, ArrowRight: false, ArrowUp: false,
    a: false, d: false, w: false, ' ': false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) > -1) {
            e.preventDefault();
        }
    }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (gameState === 'PLAYING') isPaused = !isPaused;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

// Animated clouds
let clouds = [
    { x: 100, y: 50, speed: 0.4, size: 45 },
    { x: 500, y: 80, speed: 0.25, size: 55 },
    { x: 900, y: 40, speed: 0.6, size: 35 },
    { x: 1300, y: 65, speed: 0.35, size: 50 },
];

let player = {};
let score = 0;
let coinAnimFrame = 0;
let isGameStarted = false;

// AudioContext for retro BGM
let audioCtx = null;
let isBgmPlaying = false;

function playRetroBGM() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (isBgmPlaying) return;
    isBgmPlaying = true;
    
    const notes = [
        261, 0, 330, 0, 392, 330, 523, 0,
        440, 0, 349, 0, 392, 330, 261, 0,
        293, 293, 0, 330, 349, 0, 392, 0,
        330, 261, 196, 261, 0, 0, 0, 0
    ];
    let noteIdx = 0;
    
    function playNote() {
        if (!isBgmPlaying) return;
        const freq = notes[noteIdx];
        if (freq > 0) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
            osc.stop(audioCtx.currentTime + 0.15);
        }
        noteIdx = (noteIdx + 1) % notes.length;
        setTimeout(playNote, 150);
    }
    playNote();
}

function playTone(freq, type, duration, vol=0.05) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
}

function playDeathSound() {
    isBgmPlaying = false; 
    setTimeout(() => playTone(200, 'sawtooth', 0.2), 50);
    setTimeout(() => playTone(150, 'sawtooth', 0.2), 250);
    setTimeout(() => playTone(100, 'sawtooth', 0.5), 450);
}

function playClearSound() {
    isBgmPlaying = false;
    setTimeout(() => playTone(440, 'square', 0.1), 50);
    setTimeout(() => playTone(554, 'square', 0.1), 200);
    setTimeout(() => playTone(659, 'square', 0.1), 350);
    setTimeout(() => playTone(880, 'square', 0.4), 500);
    setTimeout(() => { playRetroBGM(); }, 2000);
}

function playWinSound() {
    isBgmPlaying = false;
    setTimeout(() => playTone(523, 'square', 0.15), 50);
    setTimeout(() => playTone(659, 'square', 0.15), 200);
    setTimeout(() => playTone(783, 'square', 0.15), 350);
    setTimeout(() => playTone(1046, 'square', 0.5), 500);
}

function playCoinSound() {
    playTone(987, 'sine', 0.08, 0.05); 
    setTimeout(() => playTone(1318, 'sine', 0.12, 0.05), 80); 
}

function playEnemyDefeatSound() {
    playTone(300, 'square', 0.1, 0.05);
    setTimeout(() => playTone(150, 'square', 0.1, 0.05), 100);
}

window.startGame = function() {
    const intro = document.getElementById('intro-screen');
    if (intro) intro.style.display = 'none';
    isGameStarted = true;
    playRetroBGM();
};

// ============================================================
// LEVEL DEFINITIONS  (worldWidth = lebar dunia per level)
// ============================================================
const levels = [
    // ── Level 1 ── Tutorial: jalan kanan, koin mudah
    {
        worldWidth: 1600,
        startPos: { x: 60, y: 300 },
        goal: { x: 1530, y: 310, w: 40, h: 70 },
        platforms: [
            { x: 0,    y: 380, w: 300, h: 20 },
            { x: 350,  y: 380, w: 200, h: 20 },
            { x: 600,  y: 380, w: 150, h: 20 },
            { x: 800,  y: 300, w: 150, h: 20 },
            { x: 1000, y: 380, w: 200, h: 20 },
            { x: 1250, y: 310, w: 120, h: 20 },
            { x: 1420, y: 380, w: 200, h: 20 },
        ],
        coins: makeCoins([
            [120,340],[230,340],[410,340],[510,340],[650,340],
            [840,260],[900,260],[1050,340],[1150,340],[1280,270],
        ]),
        enemies: [
            { x: 420, y: 340, w: 30, h: 40, vx: 2, startX: 350, endX: 540 },
        ]
    },

    // ── Level 2 ── Platform bergerak & jebakan falling
    {
        worldWidth: 1800,
        startPos: { x: 60, y: 300 },
        goal: { x: 1720, y: 280, w: 40, h: 70 },
        platforms: [
            { x: 0,    y: 380, w: 250, h: 20 },
            { x: 310,  y: 350, w: 100, h: 20, type: 'falling' },
            { x: 460,  y: 380, w: 200, h: 20 },
            { x: 710,  y: 310, w: 100, h: 20 },
            { x: 860,  y: 380, w: 150, h: 20 },
            { x: 1060, y: 350, w: 80,  h: 20, type: 'falling' },
            { x: 1190, y: 380, w: 200, h: 20 },
            { x: 1440, y: 310, w: 100, h: 20 },
            { x: 1600, y: 350, w: 160, h: 20 },
        ],
        coins: makeCoins([
            [80,340],[160,340],[340,310],[500,340],[590,340],
            [730,270],[880,340],[960,340],[1210,340],[1460,270],[1640,310],
        ]),
        enemies: [
            { x: 480, y: 340, w: 30, h: 40, vx: 2.5, startX: 460, endX: 650 },
            { x: 1210, y: 340, w: 30, h: 40, vx: 3, startX: 1190, endX: 1380 },
        ]
    },

    // ── Level 3 ── Parkour naik turun + burung terbang
    {
        worldWidth: 2000,
        startPos: { x: 50, y: 300 },
        goal: { x: 1920, y: 100, w: 40, h: 70 },
        platforms: [
            { x: 0,    y: 380, w: 120, h: 20 },
            { x: 180,  y: 300, w: 80,  h: 20 },
            { x: 320,  y: 220, w: 80,  h: 20 },
            { x: 460,  y: 300, w: 80,  h: 20 },
            { x: 600,  y: 220, w: 80,  h: 20 },
            { x: 740,  y: 150, w: 100, h: 20 },
            { x: 900,  y: 220, w: 80,  h: 20 },
            { x: 1040, y: 300, w: 80,  h: 20 },
            { x: 1180, y: 220, w: 80,  h: 20 },
            { x: 1320, y: 150, w: 100, h: 20 },
            { x: 1480, y: 200, w: 80,  h: 20 },
            { x: 1620, y: 130, w: 100, h: 20 },
            { x: 1780, y: 100, w: 180, h: 20 },
        ],
        coins: makeCoins([
            [200,260],[340,180],[480,260],[620,180],[770,110],
            [920,180],[1060,260],[1200,180],[1340,110],[1500,160],
            [1640,90],[1810,60],[1880,60],
        ]),
        enemies: [
            { x: 300, y: 150, w: 40, h: 25, vx: 4, startX: 100, endX: 900, type: 'bird' },
            { x: 1100, y: 100, w: 40, h: 25, vx: -5, startX: 800, endX: 1800, type: 'bird' },
        ]
    },

    // ── Level 4 ── Platform ilusi (fake) + musuh lebih cepat
    {
        worldWidth: 1800,
        startPos: { x: 50, y: 300 },
        goal: { x: 1730, y: 300, w: 40, h: 70 },
        platforms: [
            { x: 0,    y: 380, w: 200, h: 20 },
            { x: 260,  y: 380, w: 100, h: 20, type: 'fake' },
            { x: 420,  y: 380, w: 200, h: 20 },
            { x: 680,  y: 310, w: 80,  h: 20 },
            { x: 820,  y: 380, w: 100, h: 20, type: 'fake' },
            { x: 980,  y: 380, w: 200, h: 20 },
            { x: 1240, y: 310, w: 80,  h: 20 },
            { x: 1380, y: 380, w: 100, h: 20, type: 'fake' },
            { x: 1540, y: 380, w: 230, h: 20 },
        ],
        coins: makeCoins([
            [80,340],[140,340],[440,340],[540,340],[640,340],
            [700,270],[1000,340],[1100,340],[1200,340],[1560,340],[1650,340],
        ]),
        enemies: [
            { x: 440, y: 340, w: 30, h: 40, vx: 3.5, startX: 420, endX: 610 },
            { x: 1000, y: 340, w: 30, h: 40, vx: 4, startX: 980, endX: 1170 },
            { x: 1540, y: 340, w: 30, h: 40, vx: 3, startX: 1540, endX: 1750 },
        ]
    },

    // ── Level 5 ── Kombinasi: falling + fake + burung agresif
    {
        worldWidth: 2200,
        startPos: { x: 50, y: 300 },
        goal: { x: 2130, y: 200, w: 40, h: 70 },
        platforms: [
            { x: 0,    y: 380, w: 150, h: 20 },
            { x: 210,  y: 350, w: 80,  h: 20, type: 'falling' },
            { x: 350,  y: 380, w: 100, h: 20, type: 'fake' },
            { x: 510,  y: 380, w: 150, h: 20 },
            { x: 720,  y: 310, w: 80,  h: 20 },
            { x: 860,  y: 380, w: 100, h: 20, type: 'falling' },
            { x: 1020, y: 380, w: 150, h: 20 },
            { x: 1230, y: 310, w: 80,  h: 20, type: 'fake' },
            { x: 1370, y: 380, w: 150, h: 20 },
            { x: 1580, y: 310, w: 80,  h: 20 },
            { x: 1720, y: 240, w: 80,  h: 20 },
            { x: 1860, y: 200, w: 80,  h: 20, type: 'falling' },
            { x: 2000, y: 240, w: 170, h: 20 },
        ],
        coins: makeCoins([
            [60,340],[230,310],[530,340],[620,340],[740,270],
            [1040,340],[1130,340],[1590,270],[1730,200],[1870,160],
            [2020,200],[2100,200],
        ]),
        enemies: [
            { x: 200, y: 130, w: 40, h: 25, vx: 5,  startX: 0,    endX: 900,  type: 'bird' },
            { x: 900, y: 180, w: 40, h: 25, vx: -6, startX: 500,  endX: 1600, type: 'bird' },
            { x: 530, y: 340, w: 30, h: 40, vx: 3.5, startX: 510, endX: 660 },
        ]
    },

    // ── Level 6 ── Lorong sempit + musuh rapat
    {
        worldWidth: 2200,
        startPos: { x: 50, y: 300 },
        goal: { x: 2130, y: 300, w: 40, h: 70 },
        platforms: [
            { x: 0,    y: 380, w: 200, h: 20 },
            { x: 260,  y: 380, w: 120, h: 20 },
            { x: 440,  y: 380, w: 120, h: 20 },
            { x: 620,  y: 380, w: 120, h: 20 },
            { x: 800,  y: 380, w: 120, h: 20 },
            { x: 980,  y: 380, w: 120, h: 20 },
            { x: 1160, y: 380, w: 120, h: 20 },
            { x: 1340, y: 380, w: 120, h: 20 },
            { x: 1520, y: 380, w: 120, h: 20 },
            { x: 1700, y: 380, w: 120, h: 20 },
            { x: 1880, y: 380, w: 120, h: 20 },
            { x: 2060, y: 380, w: 150, h: 20 },
            // Atas sempit
            { x: 300,  y: 290, w: 60,  h: 20 },
            { x: 480,  y: 220, w: 60,  h: 20 },
            { x: 660,  y: 150, w: 60,  h: 20 },
        ],
        coins: makeCoins([
            [80,340],[140,340],[270,340],[330,340],[450,340],[560,340],
            [310,250],[490,180],[670,110],
            [820,340],[940,340],[1000,340],[1180,340],[1360,340],[1540,340],
            [1720,340],[1900,340],[2080,340],
        ]),
        enemies: [
            { x: 270, y: 340, w: 28, h: 38, vx: 3, startX: 260, endX: 370 },
            { x: 450, y: 340, w: 28, h: 38, vx: 3, startX: 440, endX: 550 },
            { x: 630, y: 340, w: 28, h: 38, vx: 3, startX: 620, endX: 730 },
            { x: 810, y: 340, w: 28, h: 38, vx: 4, startX: 800, endX: 910 },
            { x: 990, y: 340, w: 28, h: 38, vx: 4, startX: 980, endX: 1090 },
        ]
    },

    // ── Level 7 ── Platform bergerak (moving platform) + jurang lebar
    {
        worldWidth: 2400,
        startPos: { x: 50, y: 300 },
        goal: { x: 2330, y: 260, w: 40, h: 70 },
        platforms: [
            { x: 0,    y: 380, w: 180, h: 20 },
            { x: 280,  y: 350, w: 90,  h: 20, type: 'moving', moveRange: 120, moveSpeed: 2, moveDir: 1 },
            { x: 530,  y: 310, w: 90,  h: 20, type: 'moving', moveRange: 100, moveSpeed: 2.5, moveDir: -1 },
            { x: 780,  y: 380, w: 150, h: 20 },
            { x: 1000, y: 320, w: 90,  h: 20, type: 'moving', moveRange: 130, moveSpeed: 3, moveDir: 1 },
            { x: 1260, y: 380, w: 150, h: 20 },
            { x: 1480, y: 310, w: 90,  h: 20, type: 'moving', moveRange: 110, moveSpeed: 3.5, moveDir: -1 },
            { x: 1730, y: 250, w: 90,  h: 20, type: 'moving', moveRange: 90,  moveSpeed: 4,   moveDir: 1 },
            { x: 1980, y: 380, w: 150, h: 20 },
            { x: 2190, y: 290, w: 180, h: 20 },
        ],
        coins: makeCoins([
            [60,340],[130,340],
            [310,310],[360,310],
            [560,270],[610,270],
            [800,340],[880,340],
            [1030,280],[1080,280],
            [1280,340],[1360,340],
            [1510,270],[1560,270],
            [1760,210],[1810,210],
            [2000,340],[2080,340],
            [2220,250],[2290,250],
        ]),
        enemies: [
            { x: 800, y: 340, w: 30, h: 40, vx: 4, startX: 780, endX: 920 },
            { x: 1260, y: 340, w: 30, h: 40, vx: 4.5, startX: 1260, endX: 1400 },
            { x: 400, y: 120, w: 40, h: 25, vx: 5, startX: 100, endX: 1200, type: 'bird' },
        ]
    },

    // ── Level 8 ── Api + falling platform rapat
    {
        worldWidth: 2400,
        startPos: { x: 50, y: 280 },
        goal: { x: 2330, y: 200, w: 40, h: 70 },
        platforms: [
            { x: 0,    y: 360, w: 200, h: 20 },
            { x: 260,  y: 330, w: 80,  h: 20, type: 'falling' },
            { x: 400,  y: 360, w: 200, h: 20 },
            { x: 660,  y: 290, w: 80,  h: 20, type: 'falling' },
            { x: 800,  y: 360, w: 200, h: 20 },
            { x: 1060, y: 300, w: 80,  h: 20, type: 'falling' },
            { x: 1200, y: 360, w: 200, h: 20 },
            { x: 1460, y: 290, w: 80,  h: 20, type: 'falling' },
            { x: 1600, y: 360, w: 200, h: 20 },
            { x: 1860, y: 280, w: 80,  h: 20 },
            { x: 2000, y: 220, w: 80,  h: 20, type: 'falling' },
            { x: 2140, y: 260, w: 240, h: 20 },
            // Fire blocks
            { x: 400,  y: 360, w: 50, h: 20, type: 'fire', fireDelay: 120 },
            { x: 550,  y: 360, w: 50, h: 20, type: 'fire', fireDelay: 60  },
            { x: 800,  y: 360, w: 50, h: 20, type: 'fire', fireDelay: 90  },
            { x: 950,  y: 360, w: 50, h: 20, type: 'fire', fireDelay: 30  },
        ],
        coins: makeCoins([
            [80,320],[150,320],[280,290],[420,320],[510,320],
            [670,250],[820,320],[910,320],[1070,260],[1220,320],
            [1310,320],[1470,250],[1620,320],[1710,320],
            [1870,240],[2010,180],[2160,220],[2250,220],
        ]),
        enemies: [
            { x: 420, y: 320, w: 30, h: 40, vx: 4,   startX: 400,  endX: 590 },
            { x: 820, y: 320, w: 30, h: 40, vx: 5,   startX: 800,  endX: 990 },
            { x: 1220, y: 320, w: 30, h: 40, vx: 5,  startX: 1200, endX: 1390 },
            { x: 500,  y: 100, w: 40, h: 25, vx: 6,  startX: 100,  endX: 1500, type: 'bird' },
            { x: 1500, y: 150, w: 40, h: 25, vx: -5, startX: 1000, endX: 2400, type: 'bird' },
        ]
    },

    // ── Level 9 ── NIGHTMARE: segala jenis jebakan
    {
        worldWidth: 2600,
        startPos: { x: 50, y: 280 },
        goal: { x: 2530, y: 180, w: 40, h: 70 },
        platforms: [
            { x: 0,    y: 360, w: 150, h: 20 },
            { x: 210,  y: 330, w: 70,  h: 20, type: 'falling' },
            { x: 340,  y: 360, w: 70,  h: 20, type: 'fake' },
            { x: 470,  y: 360, w: 120, h: 20 },
            { x: 650,  y: 290, w: 70,  h: 20, type: 'moving', moveRange: 100, moveSpeed: 3, moveDir: 1 },
            { x: 800,  y: 360, w: 120, h: 20 },
            { x: 980,  y: 310, w: 70,  h: 20, type: 'falling' },
            { x: 1110, y: 360, w: 120, h: 20 },
            { x: 1290, y: 290, w: 70,  h: 20, type: 'fake' },
            { x: 1420, y: 360, w: 120, h: 20 },
            { x: 1600, y: 300, w: 70,  h: 20, type: 'moving', moveRange: 80, moveSpeed: 4, moveDir: -1 },
            { x: 1740, y: 360, w: 120, h: 20 },
            { x: 1920, y: 280, w: 70,  h: 20, type: 'falling' },
            { x: 2060, y: 220, w: 70,  h: 20 },
            { x: 2200, y: 260, w: 70,  h: 20, type: 'moving', moveRange: 60, moveSpeed: 5, moveDir: 1 },
            { x: 2360, y: 200, w: 220, h: 20 },
            // Fire traps
            { x: 470,  y: 360, w: 40, h: 20, type: 'fire', fireDelay: 60 },
            { x: 800,  y: 360, w: 40, h: 20, type: 'fire', fireDelay: 30 },
            { x: 1110, y: 360, w: 40, h: 20, type: 'fire', fireDelay: 90 },
        ],
        coins: makeCoins([
            [60,320],[120,320],[220,290],[490,320],[560,320],
            [660,250],[820,320],[900,320],[990,270],[1130,320],
            [1210,320],[1300,250],[1440,320],[1520,320],[1610,260],
            [1760,320],[1840,320],[1930,240],[2070,180],[2210,220],
            [2380,160],[2460,160],[2520,160],
        ]),
        enemies: [
            { x: 490,  y: 320, w: 30, h: 40, vx: 4.5, startX: 470,  endX: 580 },
            { x: 820,  y: 320, w: 30, h: 40, vx: 5,   startX: 800,  endX: 920 },
            { x: 1130, y: 320, w: 30, h: 40, vx: 5,   startX: 1110, endX: 1230 },
            { x: 1760, y: 320, w: 30, h: 40, vx: 5.5, startX: 1740, endX: 1860 },
            { x: 300,  y: 100, w: 40, h: 25, vx: 6,   startX: 0,    endX: 1400, type: 'bird' },
            { x: 1400, y: 150, w: 40, h: 25, vx: -7,  startX: 800,  endX: 2600, type: 'bird' },
            { x: 2000, y: 80,  w: 40, h: 25, vx: 6,   startX: 1500, endX: 2600, type: 'bird' },
        ]
    },

    // ── Level 10 ── BOSS LEVEL: semua jebakan, dunia panjang
    {
        worldWidth: 3000,
        startPos: { x: 50, y: 280 },
        goal: { x: 2920, y: 100, w: 50, h: 80 },
        platforms: [
            { x: 0,    y: 360, w: 160, h: 20 },
            { x: 220,  y: 310, w: 70,  h: 20, type: 'falling' },
            { x: 360,  y: 360, w: 70,  h: 20, type: 'fake' },
            { x: 500,  y: 280, w: 70,  h: 20, type: 'moving', moveRange: 100, moveSpeed: 3.5, moveDir: 1 },
            { x: 660,  y: 360, w: 120, h: 20 },
            { x: 840,  y: 290, w: 70,  h: 20, type: 'falling' },
            { x: 980,  y: 220, w: 70,  h: 20 },
            { x: 1120, y: 290, w: 70,  h: 20, type: 'fake' },
            { x: 1260, y: 360, w: 120, h: 20 },
            { x: 1450, y: 300, w: 70,  h: 20, type: 'moving', moveRange: 110, moveSpeed: 4, moveDir: -1 },
            { x: 1620, y: 230, w: 70,  h: 20 },
            { x: 1760, y: 360, w: 120, h: 20 },
            { x: 1950, y: 280, w: 70,  h: 20, type: 'falling' },
            { x: 2100, y: 210, w: 70,  h: 20, type: 'moving', moveRange: 80, moveSpeed: 4.5, moveDir: 1 },
            { x: 2260, y: 150, w: 70,  h: 20 },
            { x: 2400, y: 200, w: 70,  h: 20, type: 'fake' },
            { x: 2540, y: 130, w: 70,  h: 20, type: 'moving', moveRange: 60, moveSpeed: 5, moveDir: -1 },
            { x: 2700, y: 160, w: 280, h: 20 },
            // Fire traps scattered
            { x: 660,  y: 360, w: 40, h: 20, type: 'fire', fireDelay: 90  },
            { x: 750,  y: 360, w: 40, h: 20, type: 'fire', fireDelay: 45  },
            { x: 1260, y: 360, w: 40, h: 20, type: 'fire', fireDelay: 60  },
            { x: 1350, y: 360, w: 40, h: 20, type: 'fire', fireDelay: 30  },
            { x: 1760, y: 360, w: 40, h: 20, type: 'fire', fireDelay: 75  },
            { x: 1850, y: 360, w: 40, h: 20, type: 'fire', fireDelay: 15  },
        ],
        coins: makeCoins([
            [70,320],[130,320],[240,270],[510,240],[590,240],
            [670,320],[750,320],[850,250],[1000,180],[1140,250],
            [1280,320],[1360,320],[1460,260],[1630,190],[1780,320],
            [1860,320],[1960,240],[2110,170],[2270,110],[2420,160],
            [2550,90],[2720,120],[2800,120],[2880,60],
        ]),
        enemies: [
            { x: 680,  y: 320, w: 30, h: 40, vx: 4,   startX: 660,  endX: 770 },
            { x: 1280, y: 320, w: 30, h: 40, vx: 5,   startX: 1260, endX: 1370 },
            { x: 1780, y: 320, w: 30, h: 40, vx: 5.5, startX: 1760, endX: 1870 },
            { x: 200,  y: 100, w: 40, h: 25, vx: 7,   startX: 0,    endX: 1500, type: 'bird' },
            { x: 1500, y: 150, w: 40, h: 25, vx: -7,  startX: 600,  endX: 2200, type: 'bird' },
            { x: 2200, y: 80,  w: 40, h: 25, vx: 7,   startX: 1800, endX: 3000, type: 'bird' },
            { x: 2700, y: 130, w: 30, h: 40, vx: 6,   startX: 2700, endX: 2960 },
        ]
    },
];

// Helper: generate coin objects from coordinate array
function makeCoins(coords) {
    return coords.map(([x, y]) => ({ x, y, w: 16, h: 16, collected: false }));
}

// ─── State ───
let currentLevelIdx = 0;
let currentLevel    = null;
let gameState       = 'PLAYING';
let deathCount      = 0;
let lives           = 3;
let isPaused        = false;

// ─── loadLevel ───
function loadLevel(idx) {
    if (idx >= levels.length) {
        gameState = 'WIN';
        return;
    }
    const lvl = levels[idx];

    player = {
        x: lvl.startPos.x, y: lvl.startPos.y,
        width: 30, height: 40,
        vx: 0, vy: 0,
        isJumping: false, facingRight: true,
        dead: false,
        ultramanTime: 0,
        flyStamina: 0
    };

    currentLevel = {
        worldWidth: lvl.worldWidth,
        platforms: JSON.parse(JSON.stringify(lvl.platforms)),
        enemies:   JSON.parse(JSON.stringify(lvl.enemies)),
        goal:      Object.assign({}, lvl.goal),
        coins:     JSON.parse(JSON.stringify(lvl.coins)),
        items:     []
    };

    // Auto-inject Mystery Blocks
    currentLevel.platforms.push({ x: lvl.startPos.x + 180, y: lvl.startPos.y - 80, w: 30, h: 30, type: 'mystery', content: 'powerup', used: false, bounce: 0 });

    // Init platform dynamics
    currentLevel.platforms.forEach(p => {
        p.vy       = 0;
        p.isFalling = false;
        p.opacity  = 1;
        if (p.type === 'moving') {
            p.originX  = p.x;
            p.moveDir  = p.moveDir || 1;
            p.moveOffset = 0;
        }
    });

    cameraX   = 0;
    gameState = 'PLAYING';
}

// ─── update ───
function update() {
    clouds.forEach(c => {
        c.x -= c.speed;
        if (c.x + c.size * 3 < cameraX) c.x = cameraX + canvas.width + c.size;
    });

    if (gameState !== 'PLAYING' || isPaused) return;

    coinAnimFrame++;

    // ── Movement ──
    if (keys.ArrowLeft || keys.a) {
        player.vx = -MOVE_SPEED;
        player.facingRight = false;
    } else if (keys.ArrowRight || keys.d) {
        player.vx = MOVE_SPEED;
        player.facingRight = true;
    } else {
        player.vx = 0;
    }

    if ((keys.ArrowUp || keys.w || keys[' '])) {
        if (!player.isJumping) {
            player.vy = JUMP_POWER;
            player.isJumping = true;
            player.flyStamina = 18; // 0.3 second of flight allowed per jump
        } else if (player.ultramanTime > 0 && player.vy > -2 && player.flyStamina > 0) {
            player.vy -= 1.5; // Fly mode for Ultraman
            player.flyStamina--;
        }
    }

    if (player.ultramanTime > 0) player.ultramanTime--;

    player.vy += GRAVITY;
    player.x  += player.vx;
    player.y  += player.vy;

    // World bounds
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > currentLevel.worldWidth)
        player.x = currentLevel.worldWidth - player.width;

    // Camera follows player
    cameraX = player.x - canvas.width / 3;
    cameraX = Math.max(0, Math.min(cameraX, currentLevel.worldWidth - canvas.width));

    // ── Death (fall off) ──
    if (player.y > canvas.height + 100 && !player.dead) die();

    // ── Platform collisions ──
    player.isJumping = true;
    for (let p of currentLevel.platforms) {
        if (p.type === 'fake' && p.opacity < 0.1) continue;

        // Moving platforms
        if (p.type === 'moving') {
            p.moveOffset += p.moveSpeed * p.moveDir;
            if (Math.abs(p.moveOffset) >= p.moveRange) p.moveDir *= -1;
            p.x = p.originX + p.moveOffset;
        }

        // Fire blocks
        if (p.type === 'fire') {
            if (p.fireDelay > 0) {
                p.fireDelay--;
            } else {
                if (!player.dead &&
                    player.x < p.x + p.w && player.x + player.width > p.x &&
                    player.y < p.y + p.h && player.y + player.height > p.y) {
                    die();
                }
            }
        }

        // Falling platforms
        if (p.isFalling) {
            p.vy += GRAVITY * 0.5;
            p.y  += p.vy;
        }

        // Mystery block hit from below
        if (p.type === 'mystery' && player.vy < 0 &&
            player.x < p.x + p.w && player.x + player.width > p.x &&
            player.y < p.y + p.h && player.y - player.vy >= p.y + p.h - 8) {
            player.vy = 0;
            player.y = p.y + p.h;
            if (!p.used) {
                p.used = true;
                p.bounce = 10;
                currentLevel.items.push({
                    x: p.x + p.w/2 - 10, y: p.y - 20, w: 20, h: 20,
                    type: p.content, vy: -5, vx: (Math.random()-0.5)*3
                });
                playCoinSound();
            }
        }

        // Vertical collision (land on top)
        if (player.vy >= 0 &&
            player.x < p.x + p.w &&
            player.x + player.width > p.x &&
            player.y + player.height > p.y &&
            player.y + player.height < p.y + p.h + player.vy + 1) {

            if (p.type === 'fake') {
                p.opacity -= 0.1;
                continue;
            } else if (p.type === 'falling') {
                p.isFalling = true;
            } else if (p.type === 'fire' && p.fireDelay <= 0) {
                die();
                continue;
            }

            player.y  = p.y - player.height;
            player.vy = 0;
            player.isJumping = false;

            if (p.type === 'moving') {
                player.x += p.moveSpeed * p.moveDir;
            }
            if (p.isFalling) player.y += p.vy;
        }
    }

    // ── Items ──
    if (currentLevel.items) {
        for (let i = currentLevel.items.length - 1; i >= 0; i--) {
            let it = currentLevel.items[i];
            it.vy += GRAVITY;
            it.x += it.vx;
            it.y += it.vy;
            for (let p of currentLevel.platforms) {
                if (p.type === 'fake' || p.type === 'mystery') continue;
                if (it.vy > 0 && it.x < p.x + p.w && it.x + it.w > p.x && it.y + it.h > p.y && it.y + it.h < p.y + p.h + it.vy + 1) {
                    it.y = p.y - it.h;
                    it.vy = -it.vy * 0.4;
                    it.vx *= 0.9;
                }
            }
            if (!player.dead && player.x < it.x + it.w && player.x + player.width > it.x && player.y < it.y + it.h && player.y + player.height > it.y) {
                if (it.type === 'coin') {
                    score += COIN_VALUE * 2;
                    playCoinSound();
                } else if (it.type === 'powerup') {
                    player.ultramanTime = 600; // 10 sec
                    playClearSound();
                }
                currentLevel.items.splice(i, 1);
            }
        }
    }

    // ── Enemies ──
    for (let i = currentLevel.enemies.length - 1; i >= 0; i--) {
        let e = currentLevel.enemies[i];
        e.x += e.vx;
        if (e.x > e.endX - e.w || e.x < e.startX) {
            e.vx *= -1;
            e.x  += e.vx;
        }

        if (!player.dead &&
            player.x < e.x + e.w && player.x + player.width > e.x &&
            player.y < e.y + e.h && player.y + player.height > e.y) {

            if (player.ultramanTime > 0) {
                currentLevel.enemies.splice(i, 1);
                score += 50;
                playEnemyDefeatSound();
            } else if (player.vy > 0 && player.y + player.height < e.y + e.h / 2 + player.vy) {
                currentLevel.enemies.splice(i, 1);
                player.vy = JUMP_POWER * 0.7;
                score += 20; // Bonus musuh diinjak
                playEnemyDefeatSound();
            } else {
                die();
            }
        }
    }

    // ── Coins ──
    for (let c of currentLevel.coins) {
        if (c.collected) continue;
        if (player.x < c.x + c.w && player.x + player.width > c.x &&
            player.y < c.y + c.h && player.y + player.height > c.y) {
            c.collected = true;
            score += COIN_VALUE;
            playCoinSound();
        }
    }

    // ── Troll goal (Level 2 trick) ──
    let g = currentLevel.goal;
    if (g.type === 'troll') {
        if (Math.abs(player.x - g.x) < 80 && Math.abs(player.y - g.y) < 80) {
            if (g.teleportCount === undefined) g.teleportCount = 0;
            if (g.teleportCount === 0) {
                g.x = g.jumpToX; g.y = g.jumpToY; g.teleportCount = 1;
            } else if (g.teleportCount === 1) {
                g.x = 700; g.y = 310; g.type = 'normal';
                let newPlats = [], fd = 0;
                for (let p of currentLevel.platforms) {
                    if (p.y >= 380 && p.type !== 'fake') {
                        for (let lx = p.x; lx < p.x + p.w; lx += 50) {
                            newPlats.push({ x: lx, y: p.y, w: Math.min(50, p.x + p.w - lx), h: p.h, type: 'fire', fireDelay: fd });
                            fd += 30;
                        }
                    } else { newPlats.push(p); }
                }
                currentLevel.platforms = newPlats;
            }
        }
    }

    // ── Goal collision ──
    if (!player.dead &&
        player.x < g.x + g.w && player.x + player.width > g.x &&
        player.y < g.y + g.h  && player.y + player.height > g.y) {
        score += 100; // Bonus level clear
        currentLevelIdx++;
        if (currentLevelIdx >= levels.length) {
            saveScore();
            playWinSound();
        } else {
            playClearSound();
        }
        loadLevel(currentLevelIdx);
    }
}

function die() {
    if (player.dead) return;
    player.dead = true;
    playDeathSound();
    player.vy   = JUMP_POWER;
    gameState   = 'GAMEOVER';
    deathCount++;
    lives--;
    setTimeout(() => {
        if (lives <= 0) {
            saveScore(); // Save when game over
            lives = 3;
            // Checkpoint at level 5 (index 4)
            if (currentLevelIdx >= 4) {
                currentLevelIdx = 4;
            } else {
                currentLevelIdx = 0;
            }
            score = 0;
        }
        loadLevel(currentLevelIdx);
        playRetroBGM(); // Resume BGM
    }, 1500);
}

// ============================================================
// DRAW HELPERS
// ============================================================

function drawCloud(x, y, s) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(x, y, s,         Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x + s/2, y - s/2,    s * 0.8, Math.PI * 1,   Math.PI * 1.85);
    ctx.arc(x + s*1.5, y - s/4,  s * 0.9, Math.PI * 1.37, Math.PI * 1.91);
    ctx.arc(x + s*2, y,          s,         Math.PI * 1.5, Math.PI * 0.5);
    ctx.fill();
}

function drawCoin(c) {
    if (c.collected) return;
    const cx = c.x + c.w / 2 - cameraX;
    const cy = c.y + c.h / 2;
    const bounce = Math.sin(coinAnimFrame * 0.1 + c.x * 0.05) * 3;

    // Glow
    ctx.save();
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur  = 12;

    // Coin body
    let grad = ctx.createRadialGradient(cx - 3, cy + bounce - 3, 1, cx, cy + bounce, c.w / 2);
    grad.addColorStop(0, '#fff9c4');
    grad.addColorStop(0.5, '#ffd700');
    grad.addColorStop(1, '#b8860b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy + bounce, c.w / 2, 0, Math.PI * 2);
    ctx.fill();

    // $ symbol
    ctx.fillStyle = '#7a5800';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', cx, cy + bounce);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

function drawPlayer(x, y, w, h) {
    const sx = x - cameraX;
    ctx.save();
    if (player.dead) {
        ctx.translate(sx + w/2, y + h/2);
        ctx.rotate(Math.PI);
        ctx.translate(-(sx + w/2), -(y + h/2));
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx + w/2, y + h + 2, w/2, 5, 0, 0, Math.PI*2);
    ctx.fill();

    // Walking animation offsets
    let legOffset1 = 0, legOffset2 = 0;
    let bodyBounce = 0;
    if (player.vx !== 0 && !player.isJumping && !player.dead) {
        legOffset1 = Math.sin(x * 0.15) * 6;
        legOffset2 = Math.sin(x * 0.15 + Math.PI) * 6;
        bodyBounce = Math.abs(Math.sin(x * 0.15)) * 2;
    }
    
    const by = y - bodyBounce; // Bouncing body Y

    if (player.ultramanTime > 0) {
        ctx.shadowColor = 'rgba(255,255,255,0.5)';
        ctx.shadowBlur = 10;
        
        ctx.fillStyle = '#e6e6e6';
        ctx.beginPath(); ctx.roundRect(sx + 4, by + 18, w - 8, 14, 3); ctx.fill();
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(sx + 8, by + 20, w - 16, 4);
        
        let timerColor = '#00ff00';
        if (player.ultramanTime < 180) timerColor = (Math.floor(Date.now() / 100) % 2 === 0) ? '#ff0000' : '#ffff00';
        else if (player.ultramanTime < 300) timerColor = '#ffff00';
        ctx.fillStyle = timerColor;
        ctx.beginPath(); ctx.arc(sx + w/2, by + 24, 3.5, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = '#e6e6e6';
        ctx.beginPath(); ctx.roundRect(sx + 2, by, w - 4, 18, 8); ctx.fill();
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(sx + w/2 - 2, by - 4, 4, 8); 
        
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 5;
        if (player.facingRight) {
            ctx.beginPath(); ctx.ellipse(sx + 16, by + 10, 4, 6, 0.5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(sx + 8, by + 10, 3, 5, 0.3, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.beginPath(); ctx.ellipse(sx + 10, by + 10, 4, 6, -0.5, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(sx + 18, by + 10, 3, 5, -0.3, 0, Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        
        if (keys.ArrowUp && !player.dead) {
            ctx.fillStyle = '#ff0000';
            if (player.facingRight) ctx.fillRect(sx + w - 4, by + 5, 12, 4);
            else ctx.fillRect(sx - 8, by + 5, 12, 4);
        }
        
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.roundRect(sx + 2 + legOffset1, y + 32, 10, 8, 3);
        ctx.roundRect(sx + 18 + legOffset2, y + 32, 10, 8, 3);
        ctx.fill();
        ctx.restore();
        return;
    }

    // Hat (3D Gradient)
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    let hatGrad = ctx.createLinearGradient(sx, by, sx, by + 10);
    hatGrad.addColorStop(0, '#ff4d4d'); hatGrad.addColorStop(1, '#b30000');
    ctx.fillStyle = hatGrad;
    ctx.beginPath(); ctx.roundRect(sx + 2, by, w - 4, 10, 5); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    if (player.facingRight) {
        ctx.fillRect(sx + 5, by + 5, w, 5);
    } else {
        ctx.fillRect(sx - 5, by + 5, w, 5);
    }

    // Face (3D Radial Gradient)
    let faceGrad = ctx.createRadialGradient(sx + w/2, by + 15, 2, sx + w/2, by + 15, 12);
    faceGrad.addColorStop(0, '#ffcc99'); faceGrad.addColorStop(1, '#cc9966');
    ctx.fillStyle = faceGrad;
    ctx.fillRect(sx + 5, by + 10, w - 10, 10);

    // Eyes
    ctx.fillStyle = player.dead ? '#ff0000' : '#000';
    if (player.facingRight) ctx.fillRect(sx + 15, by + 12, 4, 4);
    else ctx.fillRect(sx + 10, by + 12, 4, 4);

    // Overalls (3D Linear Gradient)
    let grad = ctx.createLinearGradient(sx, by+20, sx, by+40);
    grad.addColorStop(0, '#3366ff'); grad.addColorStop(1, '#00008b');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(sx + 4, by + 20, w - 8, 12, 3); ctx.fill();
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(sx + 8, by + 22, 4, 4);
    ctx.fillRect(sx + 18, by + 22, 4, 4);

    // Shoes (with walking animation)
    let shoeGrad = ctx.createLinearGradient(sx, y + 32, sx, y + 40);
    shoeGrad.addColorStop(0, '#8b5a2b'); shoeGrad.addColorStop(1, '#4a2f1d');
    ctx.fillStyle = shoeGrad;
    ctx.beginPath();
    ctx.roundRect(sx + 2 + legOffset1,  y + 32, 10, 8, 3);
    ctx.roundRect(sx + 18 + legOffset2, y + 32, 10, 8, 3);
    ctx.fill();

    ctx.restore();
}

function drawEnemy(e) {
    const ex = e.x - cameraX;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur  = 5;
    
    // Walking animation offsets
    let eLeg1 = 0, eLeg2 = 0;
    let bodyBounce = 0;
    if (e.type !== 'bird') {
        eLeg1 = Math.sin(e.x * 0.15) * 6;
        eLeg2 = Math.sin(e.x * 0.15 + Math.PI) * 6;
        bodyBounce = Math.abs(Math.sin(e.x * 0.15)) * 2;
    }
    
    const ey = e.y - bodyBounce;

    if (e.type === 'bird') {
        let grad = ctx.createRadialGradient(ex + e.w/2, e.y + e.h/2, 2, ex + e.w/2, e.y + e.h/2, e.w);
        grad.addColorStop(0, '#b300b3'); grad.addColorStop(1, '#4d004d');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(ex + e.w/2, e.y + e.h/2, e.w/2, e.h/2, 0, 0, Math.PI*2);
        ctx.fill();
        
        let flap = Math.sin(e.x * 0.2) * 10;
        ctx.fillStyle = '#ff33ff';
        ctx.beginPath();
        if (e.vx < 0) {
            ctx.moveTo(ex + e.w/2, e.y + e.h/2);
            ctx.lineTo(ex + e.w, e.y - 10 + flap);
            ctx.lineTo(ex + e.w/2 + 5, e.y + e.h/2);
        } else {
            ctx.moveTo(ex + e.w/2, e.y + e.h/2);
            ctx.lineTo(ex, e.y - 10 + flap);
            ctx.lineTo(ex + e.w/2 - 5, e.y + e.h/2);
        }
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(e.vx < 0 ? ex + 10 : ex + e.w - 10, e.y + 10, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(e.vx < 0 ? ex + 8 : ex + e.w - 8, e.y + 10, 2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffa500';
        ctx.beginPath();
        if (e.vx < 0) { ctx.moveTo(ex, e.y+10); ctx.lineTo(ex-10, e.y+15); ctx.lineTo(ex, e.y+20); }
        else { ctx.moveTo(ex+e.w, e.y+10); ctx.lineTo(ex+e.w+10, e.y+15); ctx.lineTo(ex+e.w, e.y+20); }
        ctx.fill();
    } else {
        let grad = ctx.createRadialGradient(ex + e.w/2, ey + e.h/2, 2, ex + e.w/2, ey + e.h/2, e.w);
        grad.addColorStop(0, '#a0522d'); grad.addColorStop(1, '#5c2e16');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(ex + e.w/2, ey);
        ctx.quadraticCurveTo(ex + e.w, ey, ex + e.w, ey + e.h);
        ctx.lineTo(ex, ey + e.h);
        ctx.quadraticCurveTo(ex, ey, ex + e.w/2, ey);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.fillRect(ex + 8, ey + 15, 6, 8);
        ctx.fillRect(ex + 16, ey + 15, 6, 8);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(ex + 10, ey + 17, 4, 4);
        ctx.fillRect(ex + 16, ey + 17, 4, 4);
        
        // Shoes with walking animation
        let shoeGrad = ctx.createLinearGradient(ex, e.y + e.h - 5, ex, e.y + e.h);
        shoeGrad.addColorStop(0, '#444'); shoeGrad.addColorStop(1, '#000');
        ctx.fillStyle = shoeGrad;
        ctx.beginPath();
        ctx.roundRect(ex - 2 + eLeg1, e.y + e.h - 5, 12, 5, 2);
        ctx.roundRect(ex + e.w - 10 + eLeg2, e.y + e.h - 5, 12, 5, 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
}

function drawPlatform(p) {
    const px = p.x - cameraX;
    if (px + p.w < 0 || px > canvas.width) return; // off-screen cull

    if (p.opacity !== undefined && p.opacity < 1)
        ctx.globalAlpha = Math.max(0, p.opacity);

    // Color by type
    let color = '#B22222';
    if (p.type === 'falling') color = '#cd5c5c';
    else if (p.type === 'fire') color = '#8b0000';
    else if (p.type === 'fake') color = '#cc8844';
    else if (p.type === 'moving') color = '#2255aa';
    else if (p.type === 'mystery') color = p.used ? '#777777' : '#ddaa00';

    ctx.fillStyle = color;
    let drawY = p.y;
    if (p.bounce > 0) {
        drawY -= p.bounce;
        p.bounce -= 1;
    }
    ctx.fillRect(px, drawY, p.w, p.h);
    
    if (p.type === 'mystery') {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.strokeRect(px, drawY, p.w, p.h);
        if (!p.used) {
            ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
            ctx.fillText('?', px + p.w/2, drawY + 23); ctx.textAlign = 'left';
        } else {
            ctx.fillStyle = '#444'; ctx.fillRect(px + 4, drawY + 4, p.w - 8, p.h - 8);
        }
    } else {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.strokeRect(px, drawY, p.w, p.h);
        for (let j = 0; j < p.w; j += 20) {
            ctx.beginPath(); ctx.moveTo(px + j, drawY); ctx.lineTo(px + j, drawY + p.h); ctx.stroke();
        }
    }

    // Fire animation
    if (p.type === 'fire' && p.fireDelay <= 0) {
        ctx.fillStyle = '#ff4500';
        ctx.beginPath();
        ctx.moveTo(px, p.y);
        ctx.lineTo(px + p.w/4,    p.y - 15 + Math.random()*10);
        ctx.lineTo(px + p.w/2,    p.y - 5);
        ctx.lineTo(px + p.w*0.75, p.y - 20 + Math.random()*10);
        ctx.lineTo(px + p.w,      p.y);
        ctx.fill();
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(px + p.w/4,    p.y);
        ctx.lineTo(px + p.w/2,    p.y - 10 + Math.random()*5);
        ctx.lineTo(px + p.w*0.75, p.y);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ─── draw ───
function draw() {
    // Sky gradient
    let sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#1a1a3e');
    sky.addColorStop(0.5, '#2d2d6e');
    sky.addColorStop(1, '#4a3f6b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars (parallax, dim at level 1)
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + cameraX * 0.2) % canvas.width + canvas.width) % canvas.width;
        const sy = (i * 73) % (canvas.height * 0.6);
        ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Clouds
    clouds.forEach(c => drawCloud(c.x - cameraX * 0.5, c.y, c.size));

    // WIN screen
    if (gameState === 'WIN') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        let wg = ctx.createLinearGradient(0, 0, canvas.width, 0);
        wg.addColorStop(0, '#ffd700'); wg.addColorStop(1, '#ff8c00');
        ctx.fillStyle = wg;
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🎉 YOU WIN! 🎉', canvas.width/2, canvas.height/2 - 30);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px Arial';
        ctx.fillText('Skor Akhir: ' + score, canvas.width/2, canvas.height/2 + 20);
        ctx.font = '20px Arial';
        ctx.fillText('Total Mati: ' + deathCount + ' kali', canvas.width/2, canvas.height/2 + 55);
        ctx.textAlign = 'left';
        return;
    }

    if (!currentLevel) return;

    // ── Platforms ──
    currentLevel.platforms.forEach(drawPlatform);

    // ── Coins ──
    currentLevel.coins.forEach(drawCoin);

    // ── Items ──
    if (currentLevel.items) {
        currentLevel.items.forEach(it => {
            const ix = it.x - cameraX;
            if (it.type === 'coin') {
                ctx.fillStyle = '#ffd700';
                ctx.beginPath(); ctx.arc(ix + it.w/2, it.y + it.h/2, it.w/2, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#aa8800'; ctx.font = '12px Arial'; ctx.textAlign='center'; 
                ctx.fillText('$', ix+it.w/2, it.y+it.h/2+4); ctx.textAlign='left';
            } else if (it.type === 'powerup') {
                ctx.fillStyle = '#ff3333'; ctx.fillRect(ix, it.y, it.w, it.h);
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ix + it.w/2, it.y + it.h/2, it.w/4, 0, Math.PI*2); ctx.fill();
            }
        });
    }

    // ── Goal (Door) ──
    let g = currentLevel.goal;
    const gx = g.x - cameraX;
    // Glowing door
    ctx.save();
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur  = 20;
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(gx, g.y, g.w, g.h);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#3a2415';
    ctx.fillRect(gx + 5, g.y + 5, g.w - 10, g.h - 10);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(gx + 8, g.y + g.h/2, 5, 0, Math.PI*2); ctx.fill();
    // Star above door
    ctx.font = '20px Arial'; ctx.textAlign = 'center';
    ctx.fillText('⭐', gx + g.w/2, g.y - 5);
    ctx.restore();
    ctx.textAlign = 'left';

    // ── Enemies ──
    currentLevel.enemies.forEach(drawEnemy);

    // ── Player ──
    drawPlayer(player.x, player.y, player.width, player.height);

    // ── HUD ──
    drawHUD();

    // ── Overlays ──
    if (gameState === 'GAMEOVER') {
        ctx.fillStyle = 'rgba(200, 0, 0, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 52px Arial';
        if (lives <= 0) {
            ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 20);
            ctx.font = '22px Arial';
            ctx.fillText('Nyawa habis — kembali ke Level 1 & skor direset', canvas.width/2, canvas.height/2 + 25);
        } else {
            ctx.fillText('WASTED!', canvas.width/2, canvas.height/2 - 20);
            ctx.font = '22px Arial';
            ctx.fillText('Nyawa tersisa: ' + lives, canvas.width/2, canvas.height/2 + 25);
        }
        ctx.textAlign = 'left';
    } else if (isPaused) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 52px Arial';
        ctx.fillText('⏸ PAUSED', canvas.width/2, canvas.height/2 - 20);
        ctx.font = '20px Arial';
        ctx.fillText('Tekan P atau ESC untuk lanjut', canvas.width/2, canvas.height/2 + 25);
        ctx.textAlign = 'left';
    }
}

function drawHUD() {
    // Panel background
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.roundRect(10, 8, 230, 75, 8); ctx.fill();

    // Level
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('LEVEL ' + (currentLevelIdx + 1) + ' / ' + levels.length, 22, 30);

    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('💰 Skor: ' + score, 22, 52);

    // Lives
    ctx.fillStyle = '#ff6666';
    ctx.fillText('❤️ ' + lives + '  💀 ' + deathCount, 22, 74);

    if (player.ultramanTime > 0) {
        ctx.fillStyle = '#ff0000';
        ctx.beginPath(); ctx.roundRect(100, 62, 120, 14, 5); ctx.fill();
        ctx.fillStyle = '#00ff00';
        ctx.beginPath(); ctx.roundRect(100, 62, 120 * (player.ultramanTime / 600), 14, 5); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.textAlign='center';
        ctx.fillText('ULTRAMAN MODE', 160, 73); ctx.textAlign='left';
    }

    // Progress bar (coins collected this level)
    const totalCoins = currentLevel.coins.length;
    const gotCoins   = currentLevel.coins.filter(c => c.collected).length;
    if (totalCoins > 0) {
        const barW = canvas.width - 20;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.roundRect(10, canvas.height - 18, barW, 10, 5); ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.roundRect(10, canvas.height - 18, barW * (gotCoins / totalCoins), 10, 5); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Koin: ' + gotCoins + ' / ' + totalCoins, canvas.width/2, canvas.height - 22);
        ctx.textAlign = 'left';
    }

    // Mini-map (world scroll position indicator)
    const mmW = 120, mmH = 8, mmX = canvas.width - mmW - 15, mmY = 15;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(mmX, mmY, mmW, mmH, 4); ctx.fill();
    const progress = cameraX / Math.max(1, currentLevel.worldWidth - canvas.width);
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath(); ctx.roundRect(mmX, mmY, mmW * progress, mmH, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('Peta', canvas.width - 15, mmY + mmH + 11);
    ctx.textAlign = 'left';
}

// ─── Save score to server ───
function saveScore() {
    fetch('/api/save_score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            score:  score,
            level:  currentLevelIdx + 1,
            deaths: deathCount
        })
    }).catch(() => {}); // fail silently
}
function gameLoop() {
    if (isGameStarted) {
        update();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

window.onload = () => {
    loadLevel(0);
    gameLoop();
};
