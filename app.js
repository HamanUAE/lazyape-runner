// LazyApe Reboot - Runner MVP (Phaser 3) — Updated
// Cooldown + coin spin + disabled buttons

const ASSETS = {
  backgrounds: { far:'assets/backgrounds/bg_far.png', mid:'assets/backgrounds/bg_mid.png', near:'assets/backgrounds/bg_near.png' },
  lane: { tile: 'assets/lanes/lane_tile.png' },
  monkey: {
    run: [...Array(6)].map((_,i)=>`assets/monkey/monkey_run_${i}.png`),
    jump: [...Array(4)].map((_,i)=>`assets/monkey/monkey_jump_${i}.png`),
    slide: [...Array(4)].map((_,i)=>`assets/monkey/monkey_slide_${i}.png`),
    hit: [...Array(3)].map((_,i)=>`assets/monkey/monkey_hit_${i}.png`),
  },
  obstacles: { rock:'assets/obstacles/rock_small.png', log:'assets/obstacles/log_medium.png', fence:'assets/obstacles/barrier_wood.png', crate:'assets/obstacles/crate.png' },
  coin: 'assets/collectables/coin_static.png',
  altCoinFrames: [...Array(6)].map((_,i)=>`assets/collectables/coin_${i}.png`),
  ui: { play:'assets/ui/btn_play.png', settings:'assets/ui/btn_settings.png', resume:'assets/ui/btn_resume.png', restart:'assets/ui/btn_restart.png', quit:'assets/ui/btn_quit.png', panel:'assets/ui/panel_score.png', iconCoin:'assets/ui/icon_coin.png', sparkle:'assets/ui/sparkle.png' },
  powerups: { mask:'assets/powerups/mask.png', jetpack:'assets/powerups/jetpack.png', skateboard:'assets/powerups/skateboard.png', rollers:'assets/powerups/rollers.png' }
};

const GAME_CFG = { speedStart:450, speedMax:1100, speedGainPerSec:30, laneX:[-180,0,180], spawnEveryMin:450, spawnEveryMax:900, coinChance:.55, obstacleChance:.7, cooldownSeconds:6 };

let playerName = localStorage.getItem('lz_player_name')||null;
let bestScore = Number(localStorage.getItem('lz_best_score')||0);

class Boot extends Phaser.Scene{ constructor(){super('boot')}
  preload(){
    Object.values(ASSETS.backgrounds).forEach((p,i)=>this.load.image(`bg${i}`, p));
    this.load.image('laneTile', ASSETS.lane.tile);
    ASSETS.monkey.run.forEach((p,i)=>this.load.image(`run${i}`, p));
    ASSETS.monkey.jump.forEach((p,i)=>this.load.image(`jump${i}`, p));
    ASSETS.monkey.slide.forEach((p,i)=>this.load.image(`slide${i}`, p));
    ASSETS.monkey.hit.forEach((p,i)=>this.load.image(`hit${i}`, p));
    Object.entries(ASSETS.obstacles).forEach(([k,p])=>this.load.image(k, p));
    this.load.image('coinS', ASSETS.coin);
    ASSETS.altCoinFrames.forEach((p,i)=>this.load.image(`coin${i}`, p));
    Object.entries(ASSETS.ui).forEach(([k,p])=>this.load.image('ui_'+k, p));
    Object.entries(ASSETS.powerups).forEach(([k,p])=>this.load.image('pw_'+k, p));
  }
  create(){ this.scene.start(playerName? 'menu':'nick'); }
}

class Nick extends Phaser.Scene{ constructor(){super('nick')}
  create(){
    const w=this.scale.width, h=this.scale.height;
    this.add.rectangle(w/2,h/2,w,h,0x0f2a22,.9);
    this.add.text(w/2,h*0.35,'Choose Nickname',{fontSize:Math.floor(h/18)+'px',color:'#fff'}).setOrigin(.5);
    const input=document.createElement('input'); input.placeholder='nickname'; input.maxLength=14;
    Object.assign(input.style,{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',fontSize:'20px',padding:'10px',borderRadius:'8px',border:'2px solid #2a8'});
    document.body.appendChild(input);
    const btn=this.add.text(w/2,h*0.62,'Save',{fontSize:Math.floor(h/20)+'px',color:'#fff',backgroundColor:'#2a8',padding:{x:16,y:8}}).setOrigin(.5).setInteractive();
    btn.on('pointerdown',()=>{ const v=(input.value.trim()||'Player'); localStorage.setItem('lz_player_name',v); playerName=v; input.remove(); this.scene.start('menu'); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{input&&input.remove();});
  }
}

class Menu extends Phaser.Scene{ constructor(){super('menu')}
  create(){
    const {width:w,height:h} = this.scale;
    this.add.image(w/2,h/2,'bg0').setAlpha(.4).setScale(1.1);
    this.add.text(w/2,h*0.18,'LazyApe Reboot',{fontSize:Math.floor(h/16)+'px',color:'#fff',fontStyle:'bold'}).setOrigin(.5);
    const btnConnect=this.add.text(w/2,h*0.42,'[ Connect Wallet ]',{fontSize:Math.floor(h/16)+'px',color:'#ccc',backgroundColor:'#244',padding:{x:14,y:8}}).setOrigin(.5);
    const btnAirdrop=this.add.text(w/2,h*0.52,'[ Airdrop / Claim ]',{fontSize:Math.floor(h/16)+'px',color:'#ccc',backgroundColor:'#244',padding:{x:14,y:8}}).setOrigin(.5);
    this.add.text(w/2,h*0.62,'Coming soon',{fontSize:Math.floor(h/36)+'px',color:'#8fb'}).setOrigin(.5);
    const play=this.add.text(w/2,h*0.78,'PLAY',{fontSize:Math.floor(h/14)+'px',color:'#111',backgroundColor:'#ffcf33',padding:{x:24,y:12}}).setOrigin(.5).setInteractive();
    this.add.text(w/2,h*0.9,`Best: ${bestScore}`,{fontSize:Math.floor(h/28)+'px',color:'#bdf'}).setOrigin(.5);
    play.on('pointerdown',()=>this.scene.start('game'));
  }
}

class Game extends Phaser.Scene{ constructor(){super('game')}
  create(){
    const {width:w,height:h}=this.scale;
    this.bgFar=this.add.tileSprite(w/2,h/2,w,h,'bg0').setAlpha(.25);
    this.bgMid=this.add.tileSprite(w/2,h/2,w,h,'bg1').setAlpha(.35);
    this.bgNear=this.add.tileSprite(w/2,h/2,w,h,'bg2').setAlpha(.5);
    this.floor=this.add.tileSprite(w/2,h*0.82,w,h*0.36,'laneTile');
    this.player=this.add.sprite(w/2,h*0.7,'run0').setDepth(10);
    this.currentLane=1; this.targetX=w/2;
    this.speed=GAME_CFG.speedStart; this.distance=0; this.score=0; this.coins=0; this.state='run'; this.animT=0;
    this.obstacles=this.add.group(); this.coingroup=this.add.group();
    this.keys=this.input.keyboard.addKeys('LEFT,RIGHT,UP,DOWN,SPACE,SHIFT'); this.initSwipe();
    this.spawnTimer=this.time.addEvent({delay:Phaser.Math.Between(GAME_CFG.spawnEveryMin,GAME_CFG.spawnEveryMax),loop:true,callback:()=>this.spawnItem()});
    this.isPaused=false; this.input.keyboard.on('keydown-P',()=>this.togglePause()); this.input.keyboard.on('keydown-ESC',()=>this.togglePause());
  }
  initSwipe(){ let sx=0,sy=0;
    this.input.on('pointerdown',p=>{sx=p.x;sy=p.y;});
    this.input.on('pointerup',p=>{const dx=p.x-sx,dy=p.y-sy; if(Math.abs(dx)>Math.abs(dy)){ if(dx>20)this.moveLane(1); else if(dx<-20)this.moveLane(-1);} else { if(dy<-20)this.jump(); else if(dy>20)this.slide(); }});
  }
  moveLane(d){ if(this.state==='hit')return; const nl=Phaser.Math.Clamp(this.currentLane+d,0,2); if(nl===this.currentLane)return; this.currentLane=nl; this.targetX=this.scale.width/2 + GAME_CFG.laneX[nl]; }
  jump(){ if(this.state!=='run')return; this.state='jump'; this.animT=0; }
  slide(){ if(this.state!=='run')return; this.state='slide'; this.animT=0; }
  spawnItem(){ if(this.isPaused||this.state==='hit')return; const lane=Phaser.Math.Between(0,2); const x=this.scale.width/2+GAME_CFG.laneX[lane]; const y=-80; const r=Math.random();
    if(r<GAME_CFG.coinChance){ for(let i=0;i<3;i++){ const c=this.add.sprite(x,y-i*120,'coinS'); c.type='coin'; c.depth=5; c.hitbox=32; c.spin=(Math.random()*2+1)*(Math.random()<.5?-1:1); c.alphaPulse=(Math.random()*0.5)+0.5; this.coingroup.add(c);} }
    else if(r<GAME_CFG.obstacleChance){ const keys=['rock','log','fence','crate']; const key=keys[Phaser.Math.Between(0,keys.length-1)]; const o=this.add.sprite(x,y,key); o.type='obstacle'; o.depth=6; o.hitbox=46; this.obstacles.add(o); }
    this.spawnTimer.delay=Phaser.Math.Between(GAME_CFG.spawnEveryMin,GAME_CFG.spawnEveryMax)*(this.speed>900?.7:1);
  }
  togglePause(){ this.isPaused=!this.isPaused; this.scene.pause(); this.scene.launch('pause',{sceneKey:'game',paused:true}); }
  update(time,dt){ if(this.isPaused)return; const delta=dt/1000;
    this.speed=Math.min(GAME_CFG.speedMax,this.speed+GAME_CFG.speedGainPerSec*delta);
    this.distance+=this.speed*delta*0.05;
    this.bgFar.tilePositionY+=this.speed*delta*0.02; this.bgMid.tilePositionY+=this.speed*delta*0.05; this.bgNear.tilePositionY+=this.speed*delta*0.09; this.floor.tilePositionY+=this.speed*delta*0.5;
    const px=this.player.x+(this.targetX-this.player.x)*Math.min(1,delta*8); this.player.setPosition(px,this.player.y);
    this.animT+=delta;
    if(this.state==='run'){const f=Math.floor(this.animT*10)%6; this.player.setTexture(`run${f}`);}
    else if(this.state==='jump'){ const f=Math.min(3,Math.floor(this.animT*8)); this.player.setTexture(`jump${f}`); const baseY=this.scale.height*0.7; const t=Math.min(1,this.animT/0.7); const y=baseY-Math.sin(t*Math.PI)*180; this.player.y=y; if(t>=1){this.state='run'; this.player.y=baseY; this.animT=0;} }
    else if(this.state==='slide'){ const f=Math.min(3,Math.floor(this.animT*8)); this.player.setTexture(`slide${f}`); if(this.animT>=0.6){this.state='run'; this.animT=0;} }
    else if(this.state==='hit'){ const f=Math.min(2,Math.floor(this.animT*6)); this.player.setTexture(`hit${f}`); if(this.animT>=0.5){ this.scene.start('gameover',{score:Math.floor(this.score),coins:this.coins,distance:Math.floor(this.distance)});} }
    const vy=this.speed*delta;
    this.obstacles.getChildren().forEach(o=>{ o.y+=vy; if(o.y>this.scale.height+120)o.destroy(); if(this.state!=='hit'){ const dx=o.x-this.player.x, dy=o.y-this.player.y; if(Math.hypot(dx,dy)<o.hitbox){ this.state='hit'; this.animT=0; } } });
    this.coingroup.getChildren().forEach(c=>{ c.y+=vy; if(c.y>this.scale.height+120)c.destroy(); c.rotation+=(vy*0.02)*(c.spin||1)*delta; c.alpha=0.75+Math.sin((this.time.now/200)*(c.alphaPulse||1))*0.25; if(this.state!=='hit'){ const dx=c.x-this.player.x, dy=c.y-this.player.y; if(Math.hypot(dx,dy)<(c.hitbox||28)){ this.onCoinPickup(c); } } });
    this.score += delta*10 + (this.speed-GAME_CFG.speedStart)*0.01;
  }
  onCoinPickup(c){ c.destroy(); this.coins++; this.score+=5; }
}

class PauseScene extends Phaser.Scene{ constructor(){super('pause')}
  create(data){ this.sceneToResume=data.sceneKey||'game'; const {width:w,height:h}=this.scale;
    this.add.rectangle(w/2,h/2,w,h,0x000000,0.35);
    this.add.text(w/2,h/2,'Paused\\n[Resume: tap anywhere]\\n[Restart: R]\\n[Quit: Q]',{fontSize:Math.floor(h/26)+'px',color:'#fff',align:'center'}).setOrigin(.5);
    this.input.once('pointerdown',()=>{ this.scene.stop(); this.scene.resume(this.sceneToResume); const g=this.scene.get(this.sceneToResume); if(g) g.isPaused=false; });
    this.input.keyboard.on('keydown-R',()=>{ this.scene.stop(); this.scene.stop('game'); this.scene.start('game'); });
    this.input.keyboard.on('keydown-Q',()=>{ this.scene.stop(); this.scene.stop('game'); this.scene.start('menu'); });
  }
}

class GameOver extends Phaser.Scene{ constructor(){super('gameover')} init(d){ this.final=d||{score:0,coins:0,distance:0}; }
  create(){ const {width:w,height:h}=this.scale;
    this.add.rectangle(w/2,h/2,w,h,0x00110f,0.85);
    this.add.text(w/2,h*0.25,'Game Over',{fontSize:Math.floor(h/14)+'px',color:'#ffb'}).setOrigin(.5);
    this.add.text(w/2,h*0.44,`Score: ${this.final.score}\\nCoins: ${this.final.coins}\\nDistance: ${this.final.distance}`,{fontSize:Math.floor(h/24)+'px',color:'#fff',align:'center'}).setOrigin(.5);
    bestScore=Math.max(bestScore,this.final.score); localStorage.setItem('lz_best_score',String(bestScore));
    this.add.text(w/2,h*0.58,`Best: ${bestScore}`,{fontSize:Math.floor(h/28)+'px',color:'#bdf'}).setOrigin(.5);
    this.remaining=GAME_CFG.cooldownSeconds; this.label=this.add.text(w/2,h*0.72,`Restart in ${this.remaining}s`,{fontSize:Math.floor(h/24)+'px',color:'#ffd'}).setOrigin(.5);
    this.timer=this.time.addEvent({delay:1000,loop:true,callback:()=>{ this.remaining--; if(this.remaining<=0){ this.timer.remove(); this.label.setText('Tap to Restart'); this.input.once('pointerdown',()=>this.scene.start('game')); } else { this.label.setText(`Restart in ${this.remaining}s`);} }});
    const btnQ=this.add.text(w/2,h*0.86,'Main Menu',{fontSize:Math.floor(h/26)+'px',color:'#fff',backgroundColor:'#155',padding:{x:16,y:8}}).setOrigin(.5).setInteractive();
    btnQ.on('pointerdown',()=>this.scene.start('menu'));
  }
}

const config={ type:Phaser.AUTO, parent:'game', backgroundColor:'#0b1814', scale:{mode:Phaser.Scale.RESIZE, autoCenter:Phaser.Scale.CENTER_BOTH, width:480, height:800}, physics:{default:'arcade'}, scene:[Boot,Nick,Menu,Game,PauseScene,GameOver] };
new Phaser.Game(config);
