// --- Terrain Generation ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const stars = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 1
}));

const sounds = {
    thrust: new Audio('sounds/rocketthrust.mp3'),
    land: new Audio('sounds/rocket-landing.mp3'),
    crash: new Audio('sounds/crash.mp3')
};
sounds.thrust.volume = 0.6;
sounds.land.volume = 0.8;
sounds.crash.volume = 0.8;

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

if (isTouch) {
    const startBtn = document.getElementById('startButton');
    startBtn.style.display = 'block';

    startBtn.addEventListener('click', () => {
        gameState = 'playing';
        startBtn.style.display = 'none';
    });
}

const GRAVITY = 0.001;
const THRUST = -0.01;
const ROTATE_SPEED = 0.05;
const LANDER_WIDTH = 20;
const LANDER_HEIGHT = 30;
const PAD_WIDTH = 80;
const PAD_COUNT = 3;
const SAFE_LANDING_VY = 1.2;
const SAFE_LANDING_ANGLE = Math.PI / 8; // ~22.5 deg

let level = 1;
let difficulty = 1; // affects terrain roughness and pad count

// --- Generate Terrain ---
const terrainPoints = [];
const terrainStep = 20;
const groundY = canvas.height - 50;
let pads = [];

function generateTerrain(difficulty = 1) {
    terrainPoints.length = 0; // reset
    const padCount = Math.max(1, PAD_COUNT - difficulty + 1);
    const padWidth = Math.max(40, PAD_WIDTH - difficulty * 10);
    const maxStep = 40 + difficulty * 10;

    let x = 0;
    let lastY = groundY - 100;
    while (x < canvas.width) {
        let y = lastY + (Math.random() - 0.5) * maxStep;
        y = Math.max(groundY - 180, Math.min(groundY - 20, y));
        terrainPoints.push({ x, y });
        lastY = y;
        x += terrainStep;
    }

    // Add flat pads
    pads = [];
    for (let i = 0; i < padCount; i++) {
        let padIdx = Math.floor(Math.random() * (terrainPoints.length - padWidth / terrainStep));
        for (let j = 0; j < padWidth / terrainStep; j++) {
            terrainPoints[padIdx + j].y = terrainPoints[padIdx].y;
        }
        pads.push({
            x: terrainPoints[padIdx].x,
            y: terrainPoints[padIdx].y,
            width: padWidth
        });
    }
}
generateTerrain();

// --- Lander State ---
function randomBetween(a, b) { return a + Math.random() * (b - a); }
let gameState = 'start'; // or 'playing', 'landed', 'crashed'
let lander = {
    x: canvas.width / 2,
    y: 100,
    vx: randomBetween(-1, 1),
    vy: randomBetween(0.5, 2),
    angle: randomBetween(-Math.PI / 4, Math.PI / 4),
    thrusting: false,
    rotatingLeft: false,
    rotatingRight: false,
    alive: true,
    landed: false
};

function getTerrainY(x) {
    // Linear interpolation between terrain points
    for (let i = 0; i < terrainPoints.length - 1; i++) {
        if (x >= terrainPoints[i].x && x <= terrainPoints[i + 1].x) {
            let t = (x - terrainPoints[i].x) / (terrainPoints[i + 1].x - terrainPoints[i].x);
            return terrainPoints[i].y * (1 - t) + terrainPoints[i + 1].y * t;
        }
    }
    return groundY;
}

function isOnPad(x) {
    return pads.some(pad => x >= pad.x && x <= pad.x + pad.width);
}

function update() {
    if (gameState !== 'playing') return;
    if (!lander.alive || lander.landed) return;

    if (lander.rotatingLeft) lander.angle -= ROTATE_SPEED;
    if (lander.rotatingRight) lander.angle += ROTATE_SPEED;

    let ax = 0;
    let ay = GRAVITY;

    if (lander.thrusting) {
        ax += Math.sin(lander.angle) * THRUST;
        ay += Math.cos(lander.angle) * THRUST;
        if (sounds.thrust.paused) {
            sounds.thrust.loop = true;
            sounds.thrust.play();
        }
    } else {
        if (!sounds.thrust.paused) {
            sounds.thrust.pause();
            sounds.thrust.currentTime = 0;
        }
    }

    lander.vx += ax;
    lander.vy += ay;

    lander.x += lander.vx;
    lander.y += lander.vy;

    // --- Collision Detection ---
    let landerBottomY = lander.y + Math.cos(lander.angle) * LANDER_HEIGHT / 2;
    let terrainY = getTerrainY(lander.x);

    if (landerBottomY >= terrainY) {
        if (
            isOnPad(lander.x) &&
            Math.abs(lander.vy) < SAFE_LANDING_VY &&
            Math.abs(lander.angle) < SAFE_LANDING_ANGLE
        ) {
            lander.landed = true;
            gameState = 'landed';
            sounds.land.currentTime = 0;
            sounds.land.play();
            level++;
            difficulty++;
        } else {
            lander.alive = false;
            gameState = 'crashed';
            sounds.land.currentTime = 0;
            sounds.crash.play();
        }
        lander.vx = 0;
        lander.vy = 0;
    }
}

function drawLander() {
    ctx.save();
    ctx.translate(lander.x, lander.y);
    ctx.rotate(-lander.angle);
    ctx.fillStyle = lander.landed ? 'lime' : (lander.alive ? 'white' : 'red');
    ctx.beginPath();
    ctx.moveTo(-LANDER_WIDTH / 2, LANDER_HEIGHT / 2);
    ctx.lineTo(LANDER_WIDTH / 2, LANDER_HEIGHT / 2);
    ctx.lineTo(0, -LANDER_HEIGHT / 2);
    ctx.closePath();
    ctx.fill();
    // Draw thrust flame
    if (lander.thrusting && lander.alive && !lander.landed) {
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.moveTo(-LANDER_WIDTH / 4, LANDER_HEIGHT / 2);
        ctx.lineTo(LANDER_WIDTH / 4, LANDER_HEIGHT / 2);
        ctx.lineTo(0, LANDER_HEIGHT / 2 + 20 * (0.7 + Math.random() * 0.3));
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

function drawTerrain() {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for (let pt of terrainPoints) ctx.lineTo(pt.x, pt.y);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fillStyle = '#222';
    ctx.fill();

    // Draw pads
    for (let pad of pads) {
        ctx.fillStyle = 'yellow';
        ctx.fillRect(pad.x, pad.y - 4, pad.width, 8);
    }
    ctx.restore();
}

function drawOverlay() {
    ctx.save();
    ctx.font = '20px monospace';
    ctx.fillStyle = 'white';

    if (gameState === 'playing') {
        const landerBottomY = lander.y + Math.cos(lander.angle) * LANDER_HEIGHT / 2;
        const terrainY = getTerrainY(lander.x);
        const altitude = Math.max(0, terrainY - landerBottomY);
        const orientation = (lander.angle * 180 / Math.PI).toFixed(1);

        ctx.fillText(`Altitude: ${altitude.toFixed(1)} px`, 20, 40);
        ctx.fillText(`Orientation: ${orientation}°`, 20, 70);
        ctx.fillText(`V-Speed: ${lander.vy.toFixed(2)} px/frame`, 20, 100);
        ctx.fillText(`X: ${lander.x.toFixed(1)} px`, 20, 130);
        ctx.textAlign = 'right';
        ctx.font = '30px monospace';
        ctx.fillText(`Level: ${level}`, canvas.width-20, 40);
    }

    // Centered messages
    ctx.textAlign = 'center';

    if (gameState === 'start') {
        ctx.font = '36px monospace';
        ctx.fillText('🌕 Moon Lander', canvas.width / 2, canvas.height / 2 - 80);

        ctx.font = '20px monospace';
        ctx.fillText('Use Arrow Keys to Rotate and Thrust', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillText('Land upright and softly on yellow pads', canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillText('Press ENTER to Begin', canvas.width / 2, canvas.height / 2 + 60);
    }

    if (gameState === 'landed') {
        ctx.fillStyle = 'lime';
        ctx.font = '30px monospace';
        ctx.fillText('Successful Landing!', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '20px monospace';
        ctx.fillText('Press ENTER for Next Level', canvas.width / 2, canvas.height / 2 + 20);
    }

    if (gameState === 'crashed') {
        ctx.fillStyle = 'red';
        ctx.font = '30px monospace';
        ctx.fillText('Crash!', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '20px monospace';
        ctx.fillText('Press ENTER to Retry', canvas.width / 2, canvas.height / 2 + 20);
    }

    ctx.restore();
}

function drawStars() {
    ctx.fillStyle = 'white';
    for (let star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStars();
    drawTerrain();
    drawLander();
    drawOverlay();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (e) => {
    if (gameState === 'start' && (e.code === 'Enter' || e.code === "Space")) {
        gameState = 'playing';
        return;
    }

    if (e.code === 'ArrowUp') lander.thrusting = true;
    if (e.code === 'ArrowLeft') lander.rotatingLeft = true;
    if (e.code === 'ArrowRight') lander.rotatingRight = true;

    if ((e.code === 'Enter' || e.code === "Space") && (gameState === 'crashed' || gameState === 'landed')) {
        generateTerrain(difficulty);
        Object.assign(lander, {
            x: canvas.width / 2,
            y: 100,
            vx: randomBetween(-1, 1),
            vy: randomBetween(0.5, 2),
            angle: randomBetween(-Math.PI / 4, Math.PI / 4),
            thrusting: false,
            rotatingLeft: false,
            rotatingRight: false,
            alive: true,
            landed: false
        });
        gameState = 'playing';
    }
});


document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp') lander.thrusting = false;
    if (e.code === 'ArrowLeft') lander.rotatingLeft = false;
    if (e.code === 'ArrowRight') lander.rotatingRight = false;
});

const unlockAudio = () => {
    sounds.thrust.play().catch(() => {});
    sounds.thrust.pause();
};
document.addEventListener('keydown', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });

gameLoop();

if (isTouch) {
    document.getElementById('touchControls').style.display = 'flex';

    const btnLeft = document.getElementById('btnLeft');
    const btnRight = document.getElementById('btnRight');
    const btnThrust = document.getElementById('btnThrust');

    const setHold = (button, key, isDown) => {
        button.addEventListener('touchstart', e => {
            e.preventDefault();
            lander[key] = true;
        });
        button.addEventListener('touchend', e => {
            e.preventDefault();
            lander[key] = false;
        });
    };

    setHold(btnLeft, 'rotatingLeft');
    setHold(btnRight, 'rotatingRight');
    setHold(btnThrust, 'thrusting');
}
