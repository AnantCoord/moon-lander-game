// --- Terrain Generation ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const GRAVITY = 0.001;
const THRUST = -0.01;
const ROTATE_SPEED = 0.05;
const LANDER_WIDTH = 20;
const LANDER_HEIGHT = 30;
const PAD_WIDTH = 80;
const PAD_COUNT = 3;
const SAFE_LANDING_VY = 1.2;
const SAFE_LANDING_ANGLE = Math.PI / 8; // ~22.5 deg

// --- Generate Terrain ---
const terrainPoints = [];
const terrainStep = 20;
const groundY = canvas.height - 50;
let pads = [];

function generateTerrain() {
    let x = 0;
    let lastY = groundY - 100;
    while (x < canvas.width) {
        let y = lastY + (Math.random() - 0.5) * 40;
        y = Math.max(groundY - 180, Math.min(groundY - 20, y));
        terrainPoints.push({ x, y });
        lastY = y;
        x += terrainStep;
    }
    // Add flat pads
    pads = [];
    for (let i = 0; i < PAD_COUNT; i++) {
        let padIdx = Math.floor(Math.random() * (terrainPoints.length - PAD_WIDTH / terrainStep));
        for (let j = 0; j < PAD_WIDTH / terrainStep; j++) {
            terrainPoints[padIdx + j].y = terrainPoints[padIdx].y;
        }
        pads.push({
            x: terrainPoints[padIdx].x,
            y: terrainPoints[padIdx].y,
            width: PAD_WIDTH
        });
    }
}
generateTerrain();

// --- Lander State ---
function randomBetween(a, b) { return a + Math.random() * (b - a); }
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
    if (!lander.alive || lander.landed) return;

    if (lander.rotatingLeft) lander.angle -= ROTATE_SPEED;
    if (lander.rotatingRight) lander.angle += ROTATE_SPEED;

    let ax = 0;
    let ay = GRAVITY;

    if (lander.thrusting) {
        ax += Math.sin(lander.angle) * THRUST;
        ay += Math.cos(lander.angle) * THRUST;
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
        } else {
            lander.alive = false;
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
    // Altitude = vertical distance from lander bottom to terrain
    let landerBottomY = lander.y + Math.cos(lander.angle) * LANDER_HEIGHT / 2;
    let terrainY = getTerrainY(lander.x);
    let altitude = Math.max(0, terrainY - landerBottomY);
    let orientation = (lander.angle * 180 / Math.PI).toFixed(1);

    ctx.save();
    ctx.font = '20px monospace';
    ctx.fillStyle = 'white';
    ctx.fillText(`Altitude: ${altitude.toFixed(1)} px`, 20, 40);
    ctx.fillText(`Orientation: ${orientation}°`, 20, 70);
    ctx.fillText(`V-Speed: ${lander.vy.toFixed(2)} px/frame`, 20, 100);
    ctx.fillText(`X: ${lander.x.toFixed(1)} px`, 20, 130); // <-- Added X coordinate
    if (lander.landed) {
        ctx.fillStyle = 'lime';
        ctx.fillText('LANDED!', canvas.width / 2 - 60, 80);
    } else if (!lander.alive) {
        ctx.fillStyle = 'red';
        ctx.fillText('CRASH!', canvas.width / 2 - 50, 80);
    }
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    if (e.code === 'ArrowUp') lander.thrusting = true;
    if (e.code === 'ArrowLeft') lander.rotatingLeft = true;
    if (e.code === 'ArrowRight') lander.rotatingRight = true;
    if ((e.code === 'Space' || e.code === 'Enter') && (!lander.alive || lander.landed)) {
        // Restart game
        generateTerrain();
        lander.x = canvas.width / 2;
        lander.y = 100;
        lander.vx = randomBetween(-1, 1);
        lander.vy = randomBetween(0.5, 2);
        lander.angle = randomBetween(-Math.PI / 4, Math.PI / 4);
        lander.thrusting = false;
        lander.rotatingLeft = false;
        lander.rotatingRight = false;
        lander.alive = true;
        lander.landed = false;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp') lander.thrusting = false;
    if (e.code === 'ArrowLeft') lander.rotatingLeft = false;
    if (e.code === 'ArrowRight') lander.rotatingRight = false;
});

gameLoop();
