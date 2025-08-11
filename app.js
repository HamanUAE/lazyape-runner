// -------- Config --------
const GAME_W = 720;
const GAME_H = 1280;
const LANES = [GAME_W * 0.25, GAME_W * 0.5, GAME_W * 0.75];
const RUN_SPEED = 500; // سرعة تقدّم العالم (بيكسل/ث)
const SCROLL_SCALE = { near: 1.0, mid: 0.6, far: 0.25 };
const JUMP_VEL = -900;
const GRAVITY = 2800;
const SLIDE_TIME = 500; // ms
const SPAWN_EVERY = 650; // ms

let game;

// --------- مشاهد Phaser ----------
class RunScene extends Phaser.Scene {
constructor() {
super('run');
this.state = 'run'; // run | jump | slide | hit
this.score = 0;
this.coins = 0;
this.dist = 0;
this.laneIndex = 1; // يبدأ بالوسط
this.slideTimer = 0;
}

preload() {
// الخلفيات
this.load.image('bg_far', 'assets/backgrounds/bg_far.png');
this.load.image('bg_mid', 'assets/backgrounds/bg_mid.png');
this.load.image('bg_near', 'assets/backgrounds/bg_near.png');

// الأرض والمسارات والظل
this.load.image('ground_tile', 'assets/backgrounds/ground_tile.png');
this.load.image('lane_marker', 'assets/backgrounds/lane_marker.png');
this.load.image('shadow_oval', 'assets/backgrounds/shadow_oval.png');

// القرد (2D مؤقت)
this.load.image('runner_back', 'assets/backgrounds/monkey/runner_back.png');
this.load.image('runner_jump', 'assets/backgrounds/monkey/runner_jump.png');
this.load.image('runner_slide', 'assets/backgrounds/monkey/runner_slide.png');
this.load.image('runner_hit', 'assets/backgrounds/monkey/runner_hit.png');

// عوائق
this.load.image('obs_barrier_low', 'assets/backgrounds/obstacles/barrier_wood_low.png');
this.load.image('obs_barrier_high', 'assets/backgrounds/obstacles/barrier_wood_high.png');
this.load.image('obs_crate', 'assets/backgrounds/obstacles/crate_box.png');
this.load.image('obs_arch', 'assets/backgrounds/obstacles/archway_stone.png');
this.load.image('obs_tree_low', 'assets/backgrounds/obstacles/fallen_tree_low.png');
this.load.image('obs_tree_high', 'assets/backgrounds/obstacles/fallen_tree_high.png');
this.load.image('obs_rock', 'assets/backgrounds/obstacles/rock_small.png');

// عملة بسيطة (لو ما عندنا سبرايت جاهز)
// نرسم دائرة في runtime، لكن نحمّل بريق بسيط من ui
this.load.image('sparkle', 'assets/backgrounds/ui/sparkle.png');
}

create() {
// فيزيكس
this.physics.world.gravity.y = GRAVITY;

// Parallax layers
this.bgFar = this.add.tileSprite(GAME_W/2, GAME_H*0.28, GAME_W, 512, 'bg_far').setScrollFactor(0);
this.bgMid = this.add.tileSprite(GAME_W/2, GAME_H*0.40, GAME_W, 512, 'bg_mid').setScrollFactor(0);
this.bgNear = this.add.tileSprite(GAME_W/2, GAME_H*0.55, GAME_W, 512, 'bg_near').setScrollFactor(0);

// الأرض (تايل يكرر أفقيًا)
this.ground = this.add.tileSprite(GAME_W/2, GAME_H*0.86, GAME_W, 256, 'ground_tile');
this.ground.setOrigin(0.5, 0.5);

// خطوط المسارات
this.laneLines = this.add.group();
LANES.forEach(x => {
const line = this.add.tileSprite(x, this.ground.y - 30, 8, 900, 'lane_marker').setAlpha(0.22);
line.setOrigin(0.5, 1);
this.laneLines.add(line);
});

// اللاعب
this.shadow = this.add.image(LANES[this.laneIndex], this.ground.y + 30, 'shadow_oval').setAlpha(0.5).setScale(0.9);
this.player = this.physics.add.sprite(LANES[this.laneIndex], this.ground.y - 120, 'runner_back');
this.player.setCollideWorldBounds(true);
this.player.setCircle(48, this.player.width*0.5-48, this.player.height*0.5-48); // هيت بوكس لطيف

// مجموعات
this.obstacles = this.physics.add.group();
this.coinsGrp = this.physics.add.group();

// اصطدامات
this.physics.add.overlap(this.player, this.coinsGrp, this.onCoin, null, this);
this.physics.add.overlap(this.player, this.obstacles, this.onHit, null, this);

// HUD بسيط
this.hud = this.add.text(24, 24, '', { fontFamily: 'monospace', fontSize: 36, color: '#e8f5d1' }).setScrollFactor(0);

// إدخال (سوايب + أزرار)
this.initInput();

// سباون متكرر
this.time.addEvent({ delay: SPAWN_EVERY, loop: true, callback: () => this.spawn() });

// إعادة تعيين
this.lastTime = 0;
}

initInput() {
// سوايب للهاتف
this.input.on('pointerdown', p => { this._swipeStart = { x: p.x, y: p.y, t: performance.now() }; });
this.input.on('pointerup', p => {
const dx = p.x - this._swipeStart.x;
const dy = p.y - this._swipeStart.y;
const dt = performance.now() - this._swipeStart.t;
if (dt > 500) return; // ليس سوايب سريع

if (Math.abs(dx) > Math.abs(dy)) {
if (dx > 40) this.moveRight();
else if (dx < -40) this.moveLeft();
} else {
if (dy < -40) this.jump();
else if (dy > 40) this.slide();
}
});

// كيبورد للدسكتوب
this.cursors = this.input.keyboard.createCursorKeys();
}

update(time, delta) {
const dt = delta / 1000;

// تمرير الخلفيات/الأرض
const dx = RUN_SPEED * dt;
this.bgFar.tilePositionX += dx * SCROLL_SCALE.far;
this.bgMid.tilePositionX += dx * SCROLL_SCALE.mid;
this.bgNear.tilePositionX += dx * SCROLL_SCALE.near;
this.ground.tilePositionX += dx;
this.laneLines.children.iterate(l => l && (l.tilePositionY += dx * 0.2)); // إحساس حركة خفيف

// HUD
this.dist += RUN_SPEED * dt * 0.001; // أمتار تقريبًا
this.score += Math.floor(10 * dt);
this.hud.setText(`Score: ${this.score}\nCoins: ${this.coins}\nDist: ${Math.floor(this.dist)} m`);

// ظِل اللاعب يلاحقه
this.shadow.x = this.player.x;

// تحكّم كيبورد
if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.moveLeft();
if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.moveRight();
if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.jump();
if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.slide();

// إنهاء السلايد بعد وقته
if (this.state === 'slide' && (time - this.slideTimer) > SLIDE_TIME) {
this.state = 'run';
this.player.setTexture('runner_back');
this.player.body.setSize(this.player.width, this.player.height, true);
}

// تنظيف الأغراض اللي طلعت خارج الشاشة
this.obstacles.children.iterate(o => o && o.x < -200 && o.destroy());
this.coinsGrp.children.iterate(c => c && c.x < -200 && c.destroy());

// حرّك الأشياء يسار (العالم يتقدّم)
this.obstacles.children.iterate(o => o && (o.x -= RUN_SPEED * dt));
this.coinsGrp.children.iterate(c => c && (c.x -= RUN_SPEED * dt));
}

moveLeft() {
if (this.laneIndex > 0) {
this.laneIndex--;
this.tweens.add({ targets: this.player, x: LANES[this.laneIndex], duration: 120, ease: 'Quad.easeOut' });
}
}
moveRight() {
if (this.laneIndex < LANES.length - 1) {
this.laneIndex++;
this.tweens.add({ targets: this.player, x: LANES[this.laneIndex], duration: 120, ease: 'Quad.easeOut' });
}
}

jump() {
if (this.state === 'hit') return;
if (this.player.body.blocked.down || this.state === 'slide' || this.state === 'run') {
this.state = 'jump';
this.player.setTexture('runner_jump');
this.player.setVelocityY(JUMP_VEL);
// يرجع لوضع الجري عند الهبوط
this.time.delayedCall(350, () => {
if (this.state !== 'hit') this.player.setTexture('runner_back');
this.state = 'run';
});
}
}

slide() {
if (this.state === 'hit') return;
if (this.player.body.blocked.down && this.state !== 'slide') {
this.state = 'slide';
this.slideTimer = performance.now();
this.player.setTexture('runner_slide');
// صغّر الهت بوكس
this.player.body.setSize(this.player.width * 0.9, this.player.height * 0.55, true);
}
}

spawn() {
// عائق أو عملات
const r = Math.random();
if (r < 0.65) this.spawnObstacle();
else this.spawnCoins();
}

spawnObstacle() {
const lane = Phaser.Math.Between(0, 2);
const x = GAME_W + 200;
const groundY = this.ground.y - 100;

// اختر نوع
const pool = [
'obs_barrier_low', 'obs_barrier_high',
'obs_crate', 'obs_arch',
'obs_tree_low', 'obs_tree_high', 'obs_rock'
];
const key = pool[Phaser.Math.Between(0, pool.length - 1)];

let y = groundY;
if (key.includes('high')) y -= 80; // بوابة عالية للسلايد
if (key === 'obs_arch') y -= 60;

const o = this.obstacles.create(LANES[lane], y, key);
o.setImmovable(true);
o.body.allowGravity = false;

// اضبط حجم الهت بوكس تقريبًا
const scale = 0.9;
o.setScale(scale);
o.body.setSize(o.width * scale, o.height * scale, true);
}

spawnCoins() {
const lane = Phaser.Math.Between(0, 2);
const x0 = GAME_W + 120;
const y = this.ground.y - Phaser.Math.Between(120, 220);
const n = Phaser.Math.Between(4, 6);

for (let i = 0; i < n; i++) {
// عملة بسيطة: دائرة + بريق صغير
const coin = this.add.circle(x0 + i * 90, y, 26, 0xffd54f);
const phys = this.physics.add.existing(coin);
phys.body.setCircle(26);
phys.body.allowGravity = false;
coin.x = LANES[lane] + i * 90;
const sparkle = this.add.image(coin.x, coin.y, 'sparkle').setScale(0.5).setAlpha(0.6);
this.coinsGrp.add(coin);
// اربط السبَركل مع العملة ليطلعوا سوا
coin._fx = sparkle;
}
}

onCoin(player, coin) {
this.coins += 1;
if (coin._fx) coin._fx.destroy();
coin.destroy();
}

onHit(player, obstacle) {
if (this.state === 'hit') return;
this.state = 'hit';
this.player.setTexture('runner_hit');
this.player.setVelocity(0, -300);
this.time.delayedCall(1000, () => this.scene.restart());
}
}

// -------- Boot + Start ----------
const config = {
type: Phaser.AUTO,
width: GAME_W,
height: GAME_H,
backgroundColor: '#0e2a22',
physics: { default: 'arcade', arcade: { debug: false } },
scene: [RunScene],
scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
};

window.addEventListener('load', () => { game = new Phaser.Game(config); });
