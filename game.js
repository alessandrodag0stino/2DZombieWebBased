/* --- CONFIGURAZIONE E VARIABILI GLOBALI --- */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('scoreEl');
const roundEl = document.getElementById('roundEl');
const modal = document.getElementById('modal');
const startBtn = document.getElementById('startBtn');
const modalTitle = document.getElementById('modal-title');
const modalScore = document.getElementById('modal-score');

// Elementi Touch
const stickLeftZone = document.getElementById('stick-left-zone');
const stickRightZone = document.getElementById('stick-right-zone');
const stickLeft = document.getElementById('stick-left');
const stickRight = document.getElementById('stick-right');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Detect Mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

if (isMobile) {
    stickLeftZone.style.display = 'block';
    stickRightZone.style.display = 'block';
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

/* --- OGGETTO INPUT GLOBALE --- */
// Questo oggetto raccoglie input da tutte le fonti (Keyboard, Pad, Touch)
const input = {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    isFiring: false,
    usingGamepad: false // Per nascondere il cursore mouse se si usa il pad
};

const keys = { w: false, a: false, s: false, d: false };

/* --- CLASSI DI GIOCO --- */

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.color = 'cyan';
        this.speed = 5;
        this.aimAngle = 0;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        
        // Indicatore mira
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(
            this.x + Math.cos(this.aimAngle) * 20, 
            this.y + Math.sin(this.aimAngle) * 20, 
            5, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    update() {
        // Applica movimento dall'Input Globale
        if (input.moveX !== 0 || input.moveY !== 0) {
            this.x += input.moveX * this.speed;
            this.y += input.moveY * this.speed;

            // Limiti Mappa
            if (this.x - this.radius < 0) this.x = this.radius;
            if (this.x + this.radius > canvas.width) this.x = canvas.width - this.radius;
            if (this.y - this.radius < 0) this.y = this.radius;
            if (this.y + this.radius > canvas.height) this.y = canvas.height - this.radius;
        }

        // Calcola angolo mira
        if (input.aimX !== 0 || input.aimY !== 0) {
            this.aimAngle = Math.atan2(input.aimY, input.aimX);
        }
    }
}

class Projectile {
    constructor(x, y, velocity) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.color = '#fff';
        this.velocity = velocity;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Enemy {
    constructor(x, y, speedMultiplier) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.color = `hsl(${Math.random() * 60 + 100}, 100%, 50%)`;
        this.velocity = { x: 0, y: 0 };
        this.speed = (Math.random() * 1.5 + 1) * speedMultiplier;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    update(player) {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.velocity.x = Math.cos(angle) * this.speed;
        this.velocity.y = Math.sin(angle) * this.speed;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Particle {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.alpha = 1;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.velocity.x *= 0.97;
        this.velocity.y *= 0.97;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.02;
    }
}

/* --- STATO DEL GIOCO --- */
let player, projectiles, enemies, particles;
let animationId, spawnInterval;
let score = 0;
let round = 1;
let gameActive = false;
let enemiesToSpawn = 0;
let lastShotTime = 0;
const fireRate = 150; 

function init() {
    player = new Player(canvas.width / 2, canvas.height / 2);
    projectiles = [];
    enemies = [];
    particles = [];
    score = 0;
    round = 1;
    scoreEl.innerText = `Punti: ${score}`;
    roundEl.innerText = `Round: ${round}`;
    gameActive = true;
    modal.style.display = 'none';
    startRound();
    animate();
}

function startRound() {
    enemiesToSpawn = round * 5 + 5;
    const spawnRate = Math.max(400, 1000 - (round * 50));
    
    spawnInterval = setInterval(() => {
        if (enemiesToSpawn > 0 && gameActive) {
            spawnEnemy();
            enemiesToSpawn--;
        } else {
            clearInterval(spawnInterval);
        }
    }, spawnRate);
}

function spawnEnemy() {
    const r = 15;
    let x, y;
    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? 0 - r : canvas.width + r;
        y = Math.random() * canvas.height;
    } else {
        x = Math.random() * canvas.width;
        y = Math.random() < 0.5 ? 0 - r : canvas.height + r;
    }
    enemies.push(new Enemy(x, y, 1 + (round * 0.1)));
}

function gameOver() {
    gameActive = false;
    cancelAnimationFrame(animationId);
    clearInterval(spawnInterval);
    modal.style.display = 'block';
    modalTitle.innerText = "GAME OVER";
    modalTitle.style.color = "red";
    modalScore.innerText = `Round: ${round} | Punti: ${score}`;
}

/* --- LOGICA DI INPUT CENTRALIZZATA --- */

function updateInput() {
    // 1. Reset base
    // Non resettiamo aimX/Y completamente per mantenere l'ultimo angolo di mira
    input.moveX = 0;
    input.moveY = 0;
    input.isFiring = false;

    // 2. Controllo Gamepad
    const gamepad = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    
    if (gamepad) {
        input.usingGamepad = true;
        
        // Deadzone
        const dz = 0.1;
        
        // Move (Left Stick)
        if (Math.abs(gamepad.axes[0]) > dz) input.moveX = gamepad.axes[0];
        if (Math.abs(gamepad.axes[1]) > dz) input.moveY = gamepad.axes[1];
        
        // Aim (Right Stick)
        if (Math.abs(gamepad.axes[2]) > dz || Math.abs(gamepad.axes[3]) > dz) {
            input.aimX = gamepad.axes[2];
            input.aimY = gamepad.axes[3];
            // Se si mira col pad, si spara col grilletto (R2/Button 7) o pulsante (X/Button 0)
            if (gamepad.buttons[7].pressed || gamepad.buttons[0].pressed) {
                input.isFiring = true;
            }
        }
    }

    // 3. Controllo Tastiera (Sovrascrive movimento pad se usata)
    if (keys.w || keys.s || keys.a || keys.d) {
        input.usingGamepad = false;
        let dx = 0, dy = 0;
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;
        
        // Normalizza
        const len = Math.hypot(dx, dy);
        if (len > 0) {
            input.moveX = dx / len;
            input.moveY = dy / len;
        }
    }

    // 4. Controllo Touch (Virtual Joysticks)
    if (touchInput.active) {
        input.usingGamepad = false;
        // Movimento (Left Stick)
        if (touchInput.left.active) {
            input.moveX = touchInput.left.x;
            input.moveY = touchInput.left.y;
        }
        // Mira e Sparo (Right Stick)
        if (touchInput.right.active) {
            input.aimX = touchInput.right.x;
            input.aimY = touchInput.right.y;
            // Su mobile, se muovi la levetta destra oltre il 50%, spari
            const aimDist = Math.hypot(input.aimX, input.aimY);
            if (aimDist > 0.5) {
                input.isFiring = true;
            }
        }
    }

    // Mouse Fire (se non usiamo pad/touch)
    if (!input.usingGamepad && !touchInput.active && mouseInput.isDown) {
        input.isFiring = true;
    }
}

/* --- GESTIONE TOUCH (JOYSTICK VIRTUALI) --- */
const touchInput = {
    active: false,
    left: { active: false, x: 0, y: 0, identifier: null, startX: 0, startY: 0 },
    right: { active: false, x: 0, y: 0, identifier: null, startX: 0, startY: 0 }
};

function handleTouch(e, type) {
    e.preventDefault();
    touchInput.active = true;
    const touches = e.changedTouches;

    for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        
        // Controllo zona Sinistra (Movimento)
        const leftRect = stickLeftZone.getBoundingClientRect();
        // Controllo zona Destra (Mira)
        const rightRect = stickRightZone.getBoundingClientRect();

        // LOGICA START
        if (type === 'start') {
            if (t.clientX < window.innerWidth / 2) {
                // Tocco a sinistra -> Assegna a Left Stick
                touchInput.left.active = true;
                touchInput.left.identifier = t.identifier;
                touchInput.left.startX = t.clientX;
                touchInput.left.startY = t.clientY;
                // Posiziona visivamente il knob
                updateKnobPosition(stickLeft, t.clientX, t.clientY, leftRect);
            } else {
                // Tocco a destra -> Assegna a Right Stick
                touchInput.right.active = true;
                touchInput.right.identifier = t.identifier;
                touchInput.right.startX = t.clientX;
                touchInput.right.startY = t.clientY;
                updateKnobPosition(stickRight, t.clientX, t.clientY, rightRect);
            }
        }

        // LOGICA MOVE
        else if (type === 'move') {
            if (t.identifier === touchInput.left.identifier) {
                const dx = t.clientX - touchInput.left.startX;
                const dy = t.clientY - touchInput.left.startY;
                const angle = Math.atan2(dy, dx);
                const dist = Math.min(Math.hypot(dx, dy), 40); // Max raggio 40px
                
                // Normalizza output -1 a 1
                touchInput.left.x = (Math.cos(angle) * dist) / 40;
                touchInput.left.y = (Math.sin(angle) * dist) / 40;

                // Aggiorna UI
                stickLeft.style.transform = `translate(-50%, -50%) translate(${touchInput.left.x * 40}px, ${touchInput.left.y * 40}px)`;
            }
            else if (t.identifier === touchInput.right.identifier) {
                const dx = t.clientX - touchInput.right.startX;
                const dy = t.clientY - touchInput.right.startY;
                const angle = Math.atan2(dy, dx);
                const dist = Math.min(Math.hypot(dx, dy), 40);

                touchInput.right.x = (Math.cos(angle) * dist) / 40;
                touchInput.right.y = (Math.sin(angle) * dist) / 40;

                stickRight.style.transform = `translate(-50%, -50%) translate(${touchInput.right.x * 40}px, ${touchInput.right.y * 40}px)`;
            }
        }

        // LOGICA END
        else if (type === 'end') {
            if (t.identifier === touchInput.left.identifier) {
                touchInput.left.active = false;
                touchInput.left.x = 0;
                touchInput.left.y = 0;
                stickLeft.style.transform = `translate(-50%, -50%)`; // Reset centro
            }
            if (t.identifier === touchInput.right.identifier) {
                touchInput.right.active = false;
                touchInput.right.x = 0;
                touchInput.right.y = 0;
                stickRight.style.transform = `translate(-50%, -50%)`; // Reset centro
            }
        }
    }
}

function updateKnobPosition(element, touchX, touchY, rect) {
    // Questa funzione serve solo per centrare il knob dove hai toccato inizialmente (opzionale, ma migliora feel)
    // Per semplicità qui lasciamo il knob al centro e muoviamo relativamente
}

window.addEventListener('touchstart', e => handleTouch(e, 'start'), {passive: false});
window.addEventListener('touchmove', e => handleTouch(e, 'move'), {passive: false});
window.addEventListener('touchend', e => handleTouch(e, 'end'), {passive: false});


/* --- EVENTI MOUSE/TASTIERA STANDARD --- */
const mouseInput = { x: 0, y: 0, isDown: false };

window.addEventListener('keydown', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; if(e.code==='KeyW') keys.w=true; if(e.code==='KeyS') keys.s=true; if(e.code==='KeyA') keys.a=true; if(e.code==='KeyD') keys.d=true; });
window.addEventListener('keyup', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; if(e.code==='KeyW') keys.w=false; if(e.code==='KeyS') keys.s=false; if(e.code==='KeyA') keys.a=false; if(e.code==='KeyD') keys.d=false; });

window.addEventListener('mousemove', e => {
    if (gameActive && !input.usingGamepad && !touchInput.active) {
        input.aimX = e.clientX - player.x;
        input.aimY = e.clientY - player.y;
    }
});

window.addEventListener('mousedown', () => mouseInput.isDown = true);
window.addEventListener('mouseup', () => mouseInput.isDown = false);


/* --- LOOP PRINCIPALE --- */

function animate() {
    if (!gameActive) return;
    animationId = requestAnimationFrame(animate);

    // Fade effect
    ctx.fillStyle = 'rgba(17, 17, 17, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Aggiorna Input Controller/Touch/Keys
    updateInput();

    // Logica Sparo
    const now = Date.now();
    if (input.isFiring && now - lastShotTime > fireRate) {
        const angle = Math.atan2(input.aimY, input.aimX);
        projectiles.push(new Projectile(player.x, player.y, {
            x: Math.cos(angle) * 12,
            y: Math.sin(angle) * 12
        }));
        lastShotTime = now;
    }

    player.update();
    player.draw();

    // Update Particles
    particles.forEach((p, i) => {
        if(p.alpha <= 0) particles.splice(i, 1);
        else { p.update(); p.draw(); }
    });

    // Update Projectiles
    projectiles.forEach((p, i) => {
        p.update();
        p.draw();
        if(p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) 
            projectiles.splice(i, 1);
    });

    // Update Enemies
    enemies.forEach((enemy, i) => {
        enemy.update(player);
        enemy.draw();

        // Collision Enemy-Player
        const distP = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distP - enemy.radius - player.radius < 1) gameOver();

        // Collision Enemy-Projectile
        projectiles.forEach((proj, pi) => {
            const dist = Math.hypot(proj.x - enemy.x, proj.y - enemy.y);
            if (dist - enemy.radius - proj.radius < 1) {
                // Boom particles
                for(let k=0; k<8; k++) {
                    particles.push(new Particle(proj.x, proj.y, Math.random()*3, enemy.color, {
                        x: (Math.random()-0.5)*5, y: (Math.random()-0.5)*5
                    }));
                }
                setTimeout(() => {
                    enemies.splice(i, 1);
                    projectiles.splice(pi, 1);
                    score += 100;
                    scoreEl.innerText = `Punti: ${score}`;
                    if (enemies.length === 0 && enemiesToSpawn === 0) {
                        round++;
                        roundEl.innerText = `Round: ${round}`;
                        roundEl.style.color = 'yellow';
                        setTimeout(() => {
                            roundEl.style.color = 'white';
                            startRound();
                        }, 2000);
                    }
                }, 0);
            }
        });
    });
}

startBtn.addEventListener('click', init);