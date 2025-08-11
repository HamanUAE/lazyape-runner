/* app.js — LazyApe Runner MVP (Phaser 3)
منظور من خلف اللاعب (2.5D)، 3 مسارات، قفز/سلايد، بارالاكس، جمع عملات.
يعتمد على ملفات الأطلس داخل assets/atlas/*.json
*/

const GAME_CFG = {
w: 720, h: 1280, // شاشة عمودية للموبايل
lanesX: [-140, 0, 140],
groundSpeedStart: 380,
groundSpeedGain: 0.03,
gravity: 2400,
jumpV: 980,
slideMs: 500
};

const ATLAS_FILES = [
'assets/atlas/backgrounds.json',
'assets/atlas/collectables.json',
'assets/atlas/monkey.json',
'assets/atlas/obstacles.json',
'assets/atlas/ui.json'
];

class Boot extends Phaser.Scene {
constructor(){ super('boot'); }
preload(){
// حمّل ملفات JSON أولاً
ATLAS_FILES.forEach((p,i)=> this.load.json('atlas'+i, p));
}
create(){
// بعد تحميل JSON: جهّز قائمة الصور حسب الملفات
const imagesToLoad = new Map();

const addImage = (key, path)=>{ if(!imagesToLoad.has(key)) imagesToLoad.set(key, path); };

for(let i=0;i<ATLAS_FILES.length;i++){
const data = this.cache.json.get('atlas'+i);
if(!data) continue;

// backgrounds
if (data.images) data.images.forEach(img => addImage(img.key, img.path));
if (data.tiles) data.tiles.forEach(t => addImage(t.key, t.path));
if (data.decals) data.decals.forEach(d => addImage(d.key, d.path));

// collectables
if (data.coins) data.coins.forEach(c => addImage(c.key, c.path));
if (data.vfx) data.vfx.forEach(v => addImage(v.key, v.path));

// ui
if (data.images && !data.parallax && !data.tiles && !data.decals) {
data.images.forEach(img => addImage(img.key, img.path));
}

// monkey states frames
if (data.states) {
data.states.forEach(st=>{
st.frames && st.frames.forEach(fr => addImage(fr.key, fr.path));
});
}

// obstacles (صور منفصلة)
if (data.images && data.collisionMap) {
data.images.forEach(o => addImage(o.key, o.path));
}
}

// حمّل الصور التي جمعناها
imagesToLoad.forEach((path,key)=> this.load.image(key, path));

this.load.once('complete', ()=> this.scene.start('menu'));
this.load.start();
}
}

class Menu extends Phaser.Scene {
constructor(){ super('menu'); }
create(){
this.cameras.main.setBackgroundColor('#0e1f1a');
const W=this.scale.width, H=this.scale.height;

// خلفيات خفيفة في القائمة
const bgF = this.add.image(W/2,H/2,'bg_far').setAlpha(.35).setScale(Math.max(W/1280,H/720));
const bgN = this.add.image(W/2,H/2,'bg_near').setAlpha(.55).setScale(bgF.scale);

const title = this.add.text(W/2, H*0.2, 'LazyApe Reboot', {fontFamily:'system-ui,Segoe UI', fontSize:48, color:'#ecf3d2'}).setOrigin(0.5);
const best = +localStorage.getItem('la_best')||0;
this.add.text(W/2, H*0.27, `Best: ${best}`, {fontFamily:'system-ui', fontSize:28, color:'#cfe7c9'}).setOrigin(0.5);

const play = this.button(W/2, H*0.7, 'PLAY', ()=> this.scene.start('game'));
this.tweens.add({targets:play, scale:{from:1,to:1.04}, duration:900, yoyo:true, repeat:-1});
}
button(x,y,label,cb){
const b = this.add.text(x,y,label,{fontFamily:'system-ui',fontSize:42,backgroundColor:'#ffcc00',color:'#222',padding:{x:18,y:12}})
.setOrigin(0.5).setInteractive({useHandCursor:true});
b.on('pointerdown', cb);
return b;
}
}

class Game extends Phaser.Scene {
constructor(){ super('game'); }
create(){
const W=this.scale.width, H=this.scale.height;

// طبقات الخلفية Parallax
this.bgFar = this.add.tileSprite(W/2,H/2,1280,720,'bg_far').setScale(Math.max(W/1280,H/720));
this.bgMid = this.add.tileSprite(W/2,H/2,1280,720,'bg_mid').setScale(this.bgFar.scale);
this.bgNear = this.add.tileSprite(W/2,H/2,1280,720,'bg_near').setScale(this.bgFar.scale);

// الأرض: بلاطات متحركة
this.ground = this.add.tileSprite(W/2, H*0.9, 1024, 256, 'ground_tile').setScale(0.9).setAlpha(0.98);

// أوفرلاي خطوط المسارات (إرشادي)
this.laneMarker = this.add.image(W/2, H*0.68, 'lane_marker').setAlpha(0.8).setScale(Math.max(W/512, H/64*1.3));

// اللاعب (سبرايت 2D مؤقت)
this.playerLane = 1;
this.playerX = GAME_CFG.lanesX[this.playerLane];
this.playerY = H*0.74;
this.playerVy = 0;
this.isSlide = false;
this.slideUntil = 0;

this.player = this.add.image(W/2 + this.playerX, this.playerY, 'runner_back').setOrigin(0.5,1).setDepth(10);

// HUD
this.score=0; this.coins=0; this.dist=0;
this.speed = GAME_CFG.groundSpeedStart;
this.hud = this.add.text(18,18,'',{fontFamily:'system-ui',fontSize:26,color:'#ecf3d2'}).setDepth(1000);
this.time.addEvent({delay:100, loop:true, callback:()=> this.updateHUD()});

// مجموعات العناصر
this.coinGroup = this.add.group();
this.fxGroup = this.add.group();

// إدخال
this.cursors = this.input.keyboard.createCursorKeys();
this.shift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
this.makeSwipe();

// توليد بسيط للعملات (بداية فقط)
this.spawnX = 0;
this.time.addEvent({delay:500, loop:true, callback:()=> this.maybeSpawnCoins()});
}

updateHUD(){
this.hud.setText(`Score: ${this.score}\nCoins: ${this.coins}\nDist: ${Math.floor(this.dist)} m`);
}

makeSwipe(){
let start=null;
this.input.on('pointerdown', p=> start={x:p.x,y:p.y});
this.input.on('pointerup', p=>{
if(!start) return;
const dx=p.x-start.x, dy=p.y-start.y;
if(Math.abs(dx)>Math.abs(dy)){
if(Math.abs(dx)>40) this.changeLane(dx>0?+1:-1);
}else{
if(Math.abs(dy)>40) (dy<0?this.jump():this.slide());
}
start=null;
});
}

changeLane(dir){
const to = Phaser.Math.Clamp(this.playerLane + dir, 0, 2);
if(to===this.playerLane) return;
this.playerLane = to;
this.tweens.add({targets:this, playerX: GAME_CFG.lanesX[to], duration:120, ease:'Sine.easeOut'});
}

jump(){
if(this.playerVy< -100 || this.isSlide) return;
this.playerVy = -GAME_CFG.jumpV;
this.player.setTexture('runner_jump');
}

slide(){
if(this.isSlide) return;
if(this.playerY < this.scale.height*0.74 - 5) return; // لازم يكون على الأرض
this.isSlide = true;
this.slideUntil = this.time.now + GAME_CFG.slideMs;
this.player.setTexture('runner_slide');
}

update(time, dtMS){
const dt = dtMS/1000;
// سرعة وزيادة تدريجية
this.speed += GAME_CFG.groundSpeedGain;
this.dist += this.speed*dt*0.02;
this.score += (this.speed*dt*0.1)|0;

// خلفية وارض تتحرك
this.bgFar.tilePositionY -= this.speed*dt*0.02;
this.bgMid.tilePositionY -= this.speed*dt*0.05;
this.bgNear.tilePositionY -= this.speed*dt*0.09;
this.ground.tilePositionY += this.speed*dt*0.6;

// تحديث موضع اللاعب أفقيًا (انتقال سلس)
const W=this.scale.width, H=this.scale.height;
this.player.x = W/2 + this.playerX;

// جاذبية/قفز
this.playerVy += GAME_CFG.gravity*dt;
this.playerY += this.playerVy*dt;
const groundY = H*0.74;
if(this.playerY > groundY){
this.playerY = groundY;
this.playerVy = 0;
if(!this.isSlide) this.player.setTexture('runner_back');
}
this.player.y = this.playerY;

// سلايد مدة محددة
if(this.isSlide && this.time.now >= this.slideUntil){
this.isSlide = false;
this.player.setTexture('runner_back');
}

// مفاتيح
if(Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.changeLane(-1);
if(Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.changeLane(+1);
if(Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.cursors.space)) this.jump();
if(Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.shift)) this.slide();

// تحديث العملات & التصادم
this.updateCoins(dt);
}

// توليد بسيط لسطر عملات أمام اللاعب
maybeSpawnCoins(){
const H=this.scale.height;
const lanes = [0,1,2];
Phaser.Utils.Array.Shuffle(lanes);
const lane = lanes[0];
const count = 5 + Phaser.Math.Between(0,2);
for(let i=0;i<count;i++){
const y = H*0.74 - 140 - i*70;
const x = this.scale.width/2 + GAME_CFG.lanesX[lane];
const c = this.add.image(x, y, 'coin_static').setScale(0.7).setDepth(5);
c.vy = this.speed*0.55; // تتحرك للأسفل نسبياً
c.collected=false;
// ظل بسيط
c.shadow = this.add.image(x, H*0.74+10, 'shadow_oval').setScale(0.4).setAlpha(0.5).setDepth(4);
this.coinGroup.add(c);
}
}

updateCoins(dt){
const H=this.scale.height;
const playerRect = this.player.getBounds();

this.coinGroup.getChildren().forEach(c=>{
c.y += c.vy*dt;
c.shadow.x = c.x;
c.shadow.alpha = Phaser.Math.Clamp(1 - (H*0.74 - c.y)/300, 0.2, 0.6);
// جمع العملة
if(!c.collected && Phaser.Geom.Intersects.RectangleToRectangle(playerRect, c.getBounds())){
c.collected = true;
this.coins += 1;
this.score += 10;
this.sparkleAt(c.x, c.y);
c.destroy();
c.shadow.destroy();
}
// حذف لو خرجت من الشاشة
if(c.y > H+40){
c.shadow.destroy();
c.destroy();
}
});
}

sparkleAt(x,y){
const fx = this.add.image(x,y,'sparkle').setDepth(20).setScale(0.6);
this.tweens.add({targets:fx, alpha:{from:1,to:0}, scale:{from:0.6,to:1.3}, duration:280, onComplete:()=>fx.destroy()});
}
}

// إنشاء اللعبة
window.addEventListener('load', ()=>{
const config = {
type: Phaser.AUTO,
parent: 'game',
width: GAME_CFG.w,
height: GAME_CFG.h,
backgroundColor: '#0e1f1a',
physics: { default: 'arcade', arcade: { debug:false }},
scene: [Boot, Menu, Game],
scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
};
new Phaser.Game(config);
});
