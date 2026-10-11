import {WIDTH,HEIGHT,distance} from './battle.mjs';
const TAU=Math.PI*2;
export class SeaRenderer {
  constructor(canvas,{reducedMotion=false}={}){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.reducedMotion=reducedMotion;this.scale=1;this.offsetX=0;this.offsetY=0;}
  point(event){const r=this.canvas.getBoundingClientRect();return {x:(event.clientX-r.left-this.offsetX)/this.scale,y:(event.clientY-r.top-this.offsetY)/this.scale}}
  circle(x,y,r,color,width=1){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,r,0,TAU);c.stroke()}
  line(x1,y1,x2,y2,color,width=1){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke()}
  text(text,x,y,color='#d4e1dd',size=14,align='center',bold=false){const c=this.ctx;c.font=`${bold?'600 ':''}${size}px system-ui,sans-serif`;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(text,x,y)}
  pill(text,x,y,color,size=14){const c=this.ctx;c.font=`600 ${size}px system-ui,sans-serif`;const w=c.measureText(text).width+16;c.fillStyle='#081320e8';c.fillRect(x-w/2,y-13,w,26);this.text(text,x,y,color,size,'center',true)}
  render(b,selected,showRange){
    const c=this.ctx,cv=this.canvas,w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;
    const dpr=Math.min(globalThis.devicePixelRatio||1,2);
    if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
    c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#0e2431';c.fillRect(0,0,w,h);
    this.scale=Math.min(w/WIDTH,h/HEIGHT);this.offsetX=(w-WIDTH*this.scale)/2;this.offsetY=(h-HEIGHT*this.scale)/2;
    c.translate(this.offsetX,this.offsetY);c.scale(this.scale,this.scale);
    this.sea(b);
    this.bloodSea(b);
    this.tactics(b);
    if(showRange){const s=b.ship(selected);if(s?.hp>0){c.save();c.setLineDash([5,8]);this.circle(s.x,s.y,s.id==='guard'?320:s.range,s.color+'66');c.restore();this.text(s.id==='guard'?'牽制圏':'射程',s.x+25,s.y-75,s.color,12)}}
    const rally=b.pending==='rally'?(b.pendingRally||b.rally):b.order==='rally'?b.rally:null;
    if(rally){
      c.save();c.setLineDash([5,7]);for(const s of b.ships.filter(s=>s.hp>0))this.line(s.x,s.y,rally.x,rally.y,'#d5c38355');c.restore();
      this.circle(rally.x,rally.y,29,'#ead094',2);this.line(rally.x-37,rally.y,rally.x+37,rally.y,'#ead094');this.line(rally.x,rally.y-37,rally.x,rally.y+37,'#ead094');this.pill(b.pending==='rally'?'集合地点〈予約〉':'集合地点',rally.x,rally.y+48,'#e9d6a9',12);
    }
    this.beast(b);
    if(b.enemy.attack)this.threat(b);
    for(const s of b.ships)this.vessel(b,s,selected===s.id);
    for(const p of b.shots)this.projectile(p);
    for(const f of b.effects)if(f.type!=='label')this.effect(f);
    for(const s of b.ships)this.shipLabel(b,s);
    for(const f of b.effects)if(f.type==='label')this.effect(f);
    this.text('N',947,53,'#9db9bd',13);this.line(947,65,947,99,'#739ca5');this.line(937,82,957,82,'#739ca5');
  }
  sea(b){
    const c=this.ctx,g=c.createLinearGradient(0,0,1000,650);g.addColorStop(0,'#193844');g.addColorStop(.6,'#102934');g.addColorStop(1,'#0b1c2a');c.fillStyle=g;c.fillRect(0,0,1000,650);
    c.save();c.strokeStyle='#6598a11c';c.lineWidth=1;for(let x=0;x<1000;x+=50)this.line(x,0,x,650,'#789fad13');for(let y=0;y<650;y+=50)this.line(0,y,1000,y,'#789fad13');
    for(let y=25;y<650;y+=28){c.beginPath();for(let x=0;x<=1000;x+=16)c.lineTo(x,y+Math.sin(x*.02+y*.09+b.time*.1)*3);c.strokeStyle='#81a5ad12';c.stroke()}
    c.setLineDash([3,8]);c.strokeStyle='#8eabab25';c.beginPath();c.ellipse(520,310,405,228,-.2,0,TAU);c.stroke();c.restore();
    this.text('BLACK CURRENT',85,110,'#83a6ad66',11,'left');this.text('黒潮海域',85,129,'#83a6ad77',12,'left');
    c.fillStyle='#25424a';c.beginPath();c.moveTo(891,482);c.lineTo(946,461);c.lineTo(975,505);c.lineTo(947,549);c.lineTo(880,535);c.closePath();c.fill();this.text('海図標',926,569,'#789aa1',12);
  }
  beast(b){
    const c=this.ctx,e=b.enemy;c.save();c.translate(e.x,e.y);
    if(!this.reducedMotion&&e.hitUntil>b.time)c.translate(Math.sin(b.time*80)*3,Math.cos(b.time*73)*2);
    c.fillStyle=e.bleed?'#80283f20':'#15273570';c.beginPath();c.ellipse(0,4,110,78,.2,0,TAU);c.fill();
    c.save();c.rotate(e.angle);
    for(const side of [-1,1]){c.strokeStyle=e.form===2?'#875568':'#587686';c.lineWidth=19;c.lineCap='round';c.beginPath();c.moveTo(-4,side*32);c.quadraticCurveTo(35,side*95,87,side*74);c.stroke();for(let k=0;k<3;k++)this.line(83,side*74,109+k*6,side*(63+k*11),'#a0a5ac',4);}c.restore();
    c.shadowColor=e.form===2?'#b7446670':'#132b39';c.shadowBlur=20;c.fillStyle=e.hitUntil>b.time?'#a76c80':e.form===2?'#473041':'#243e50';
    c.beginPath();c.moveTo(-74,-2);c.bezierCurveTo(-39,-77,55,-66,80,-16);c.bezierCurveTo(111,16,19,71,-38,49);c.closePath();c.fill();c.shadowBlur=0;
    c.strokeStyle=e.form===2?'#d06a83':'#617985';c.lineWidth=2;c.stroke();
    for(let i=0;i<5;i++){const x=-35+i*20;c.fillStyle=e.form===2?'#b47c92':'#829094';c.beginPath();c.moveTo(x,-30);c.lineTo(x+7,-60-(i%2)*10);c.lineTo(x+16,-32);c.fill()}
    c.fillStyle='#ffd499';c.shadowColor='#ffb67a';c.shadowBlur=12;c.beginPath();c.arc(-48,-8,4,0,TAU);c.fill();c.shadowBlur=0;
    this.line(-55,21,-10,32,'#c6bcc080',2);
    for(let i=0;i<e.bleed;i++){const y=-18+i*12;c.save();c.translate(-65,y);c.rotate(-.3+i*.07);this.line(-19,0,8,0,'#9fe9d2',3);c.fillStyle='#dc6b8d';c.beginPath();c.arc(8,2,3.2,0,TAU);c.fill();c.restore()}
    c.restore();this.pill(e.form===2?'ネフェリム・第二形態':'ネフェリム',e.x,e.y-115,e.form===2?'#f29caf':'#d1d7d6',14);
  }
  bloodSea(b){
    const c=this.ctx;
    for(const p of b.pools){const g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,p.radius);const alpha=Math.min(.32,p.life/24*.25*p.power);g.addColorStop(0,`rgba(185,31,69,${alpha})`);g.addColorStop(.45,`rgba(139,28,63,${alpha*.6})`);g.addColorStop(1,'rgba(100,20,50,0)');c.fillStyle=g;c.beginPath();c.arc(p.x,p.y,p.radius,0,TAU);c.fill();}
  }
  tactics(b){
    const c=this.ctx,e=b.enemy,g=b.ship('guard');
    if(b.time<b.guardUntil&&g.hp>0){c.fillStyle='#7bbafa12';c.beginPath();c.arc(g.x,g.y,235,0,TAU);c.fill();c.save();c.setLineDash([8,6]);this.circle(g.x,g.y,235,'#96caff99',2);c.restore();this.pill('不退の誓い · ノックバック無効',g.x,g.y-100,'#bbdbff',12);}
    if(b.entry&&(b.pendingSkills.includes('lance')||b.joust)){const p=b.entry;c.save();c.setLineDash([8,6]);this.line(b.ship('lance').x,b.ship('lance').y,p.x,p.y,'#dfcb8977',2);this.line(p.x,p.y,e.x,e.y,'#f4d99ebb',3);c.restore();this.circle(p.x,p.y,20,'#f4d99e',2);this.pill('ジョスト助走点',p.x,p.y-35,'#f4d99e',12);}
    if(b.joust){const l=b.ship('lance');this.line(l.x,l.y,e.x,e.y,'#f4d99e66',2);this.pill('JOUST · '+Math.round(b.joust.speed),l.x,l.y-70,'#f4d99e',14);}
    if(e.rootUntil>b.time){for(let i=0;i<7;i++){const a=i*TAU/7,x=e.x+Math.cos(a)*85,y=e.y+Math.sin(a)*55;c.fillStyle='#491f3c';c.strokeStyle='#ee95bd';c.lineWidth=2;c.beginPath();c.moveTo(x-8,y+15);c.lineTo(x+3,y-60);c.lineTo(x+10,y+15);c.closePath();c.fill();c.stroke();this.line(x,y-10,e.x,e.y,'#b3668b88',2);}this.pill(`血海拘束 ${(e.rootUntil-b.time).toFixed(1)}s`,e.x,e.y+112,'#f5b0d4',13);}
  }
  threat(b){
    const c=this.ctx,a=b.enemy.attack,p=a.age/a.duration;c.save();c.fillStyle=`rgba(224,66,93,${.11+p*.12})`;c.strokeStyle='#ff8a9e';c.lineWidth=2;c.beginPath();c.moveTo(a.x,a.y);c.arc(a.x,a.y,a.range,a.angle-a.arc,a.angle+a.arc);c.closePath();c.fill();c.setLineDash([8,5]);c.stroke();c.setLineDash([]);const angle=a.angle-a.arc+2*a.arc*p;this.line(a.x,a.y,a.x+Math.cos(angle)*a.range,a.y+Math.sin(angle)*a.range,'#ffa6af88',3);this.pill(`薙ぎ払い ${(a.duration-a.age).toFixed(1)}s`,a.x,a.y-145,'#ffc0ca',13);c.restore();
  }
  vessel(b,s,selected){
    const c=this.ctx;if(s.hp<=0){c.save();c.globalAlpha=.35;this.circle(s.x,s.y,35,'#99adba66');this.line(s.x-22,s.y-9,s.x+26,s.y+11,'#73858d',7);c.restore();return}
    const damaged=s.hitUntil>b.time;
    if(selected){c.save();c.setLineDash([5,5]);this.circle(s.x,s.y,46,s.color+'88');c.restore()}
    if(s.id==='guard'&&distance(s,b.enemy)<320){c.save();c.translate(s.x,s.y);c.rotate(s.angle);c.strokeStyle='#95bded66';c.lineWidth=4;c.beginPath();c.arc(0,0,54,-1.1,1.1);c.stroke();c.restore()}
    if(s.windup){this.circle(s.x,s.y,44,'#f0cf7355',2);c.strokeStyle='#f8d17c';c.lineWidth=5;c.beginPath();c.arc(s.x,s.y,44,-Math.PI/2,-Math.PI/2+TAU*s.windup.age/s.windup.duration);c.stroke()}
    c.save();c.translate(s.x,s.y);
    if(damaged&&!this.reducedMotion)c.translate(Math.sin(b.time*100)*4,Math.cos(b.time*90)*2);
    c.rotate(s.angle);
    if(s.fireUntil>b.time)c.translate(-5*(s.fireUntil-b.time)/.4,0);
    if(s.lunge&&!this.reducedMotion)c.translate(-Math.sin(Math.min(1,s.lunge.age/.5)*Math.PI)*5,0);
    c.strokeStyle='#b7d9d940';c.lineWidth=2;c.beginPath();c.moveTo(-42,-14);c.lineTo(-65,-22);c.moveTo(-42,14);c.lineTo(-65,22);c.stroke();
    const hullColor=damaged?'#ffd9d9':s.color;c.fillStyle=s.id==='guard'?'#274268':'#253c4a';c.strokeStyle=hullColor;c.lineWidth=2.2;
    c.beginPath();if(s.id==='guard'){c.moveTo(-33,-25);c.lineTo(26,-25);c.lineTo(42,-13);c.lineTo(42,13);c.lineTo(26,25);c.lineTo(-33,25);c.lineTo(-40,0)}else{c.moveTo(-37,-17);c.lineTo(24,-12);c.lineTo(43,0);c.lineTo(24,12);c.lineTo(-37,17);c.lineTo(-43,0)}c.closePath();c.fill();c.stroke();
    c.fillStyle='#101d2b';c.fillRect(-22,-11,24,22);c.strokeStyle=hullColor;c.lineWidth=1.1;c.strokeRect(-22,-11,24,22);
    for(const y of [-12,8]){c.fillStyle='#c5c6b3';c.fillRect(-20,y,9,5);c.fillRect(-6,y,8,5)}
    if(s.id==='stake'){
      for(const y of [-6,6]){this.line(0,y,39,y,'#b7f2e0',3);this.line(10,y-2,30,y-2,'#37575d',2);}
      c.fillStyle='#ca6981';c.fillRect(-25,-3,10,6);
    }else if(s.id==='lance'){
      c.fillStyle='#d0b071';c.fillRect(-5,-8,23,16);c.fillStyle='#263640';c.fillRect(6,-5,15,10);
      let extension=0;if(s.lunge){const a=s.lunge.age;extension=a<.22?a/.22:a<.45?1:Math.max(0,(.95-a)/.5)}
      const end=35+extension*Math.max(15,distance(s,b.enemy)-62);
      this.line(5,0,end,0,'#e9dfbd',7);this.line(8,-2,end-5,-2,'#fff9dd',2);
      c.fillStyle='#fff1bf';c.beginPath();c.moveTo(end+14,0);c.lineTo(end-4,-9);c.lineTo(end-4,9);c.closePath();c.fill();
    }else{
      c.fillStyle='#7195c0';for(const y of [-27,20])c.fillRect(-20,y,48,7);
      c.fillStyle='#b5d1f2';c.beginPath();c.moveTo(20,-17);c.lineTo(37,-9);c.lineTo(37,9);c.lineTo(20,17);c.lineTo(10,0);c.closePath();c.fill();this.line(24,-10,24,10,'#29496d',3);this.line(17,0,31,0,'#29496d',3);
    }
    c.restore();
    if(s.blood>=25)this.circle(s.x,s.y,41,'#da8199aa',1+Math.floor(s.blood/25));
  }
  shipLabel(b,s){
    const c=this.ctx,offset={stake:[-50,75],lance:[70,78],guard:[-110,-65]}[s.id];
    const x=Math.max(115,Math.min(885,s.x+offset[0])),y=Math.max(115,Math.min(HEIGHT-66,s.y+offset[1])),col=s.hp>0?s.color:'#798892';
    this.line(s.x,s.y,x,y,s.color+'33');
    this.pill(`${s.name} · 血${Math.floor(s.blood)}`,x,y,col,13);
    c.fillStyle='#07111cd9';c.fillRect(x-70,y+13,140,37);c.fillStyle='#394754';c.fillRect(x-61,y+17,122,5);c.fillStyle=s.hp/s.maxHp<.3?'#f7828e':col;c.fillRect(x-61,y+17,122*Math.max(0,s.hp/s.maxHp),5);
    let status=s.status;if(s.id==='stake'&&s.fireUntil>b.time)status='杭を射出！';if(s.lunge&&s.lunge.age<.5)status='巨槍を射突！';if(s.hp<=0)status='沈没';
    this.text(status,x,y+36,s.hp>0?'#d2dbd9':'#83929c',11);
  }
  projectile(p){
    const c=this.ctx,t=Math.min(1,p.age/p.duration),x=p.from.x+(p.to.x-p.from.x)*t,y=p.from.y+(p.to.y-p.from.y)*t;
    c.save();c.translate(x,y);c.rotate(Math.atan2(p.to.y-p.from.y,p.to.x-p.from.x));
    const trail=c.createLinearGradient(-75,0,0,0);trail.addColorStop(0,'#86dbc600');trail.addColorStop(1,'#96efdccc');this.line(-75,0,-8,0,trail,3);
    this.line(-25,0,9,0,'#ecffe8',3);c.fillStyle='#b9fff0';c.beginPath();c.moveTo(16,0);c.lineTo(3,-5);c.lineTo(3,5);c.closePath();c.fill();c.restore();
  }
  effect(f){
    const c=this.ctx,p=f.age/f.life;c.save();c.globalAlpha=Math.min(1,(1-p)*2);
    if(f.type==='label'){this.pill(f.text,f.x,f.y-26*p,f.color,f.text.startsWith('巨槍')?17:14);}
    else if(f.type==='sweep'){const a=f.angle-f.arc+2*f.arc*p;this.line(f.x,f.y,f.x+Math.cos(a)*f.range,f.y+Math.sin(a)*f.range,'#ffc6bd',17);this.circle(f.x,f.y,50+80*p,'#e786a099',2);}
    else if(f.type==='roots'){this.circle(f.x,f.y,25+90*p,'#ed90bd',4);}
    else if(f.type==='impact'){
      for(let i=0;i<9;i++){const a=i*TAU/9,r=5+(f.size||40)*p;this.line(f.x+Math.cos(a)*r*.45,f.y+Math.sin(a)*r*.45,f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,f.color,2.5)}
      this.circle(f.x,f.y,8+p*(f.size||40),f.color+'99',2);
    }else if(f.type==='tentacle'){
      c.strokeStyle='#d7648177';c.lineWidth=23*(1-p)+4;c.lineCap='round';c.beginPath();c.moveTo(f.from.x-35,f.from.y+22);c.quadraticCurveTo((f.from.x+f.x)/2,(f.from.y+f.y)/2+55,f.x,f.y);c.stroke();c.strokeStyle='#ffb6bc';c.lineWidth=3;c.stroke();
    }else if(f.type==='shield'){
      c.strokeStyle=f.color;c.lineWidth=4*(1-p)+1;c.beginPath();for(let i=0;i<7;i++){const a=i*TAU/6,r=45+25*p;c.lineTo(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r)}c.stroke();
    }else if(f.type==='blood'){
      for(let i=0;i<4;i++){const t=Math.max(0,Math.min(1,p*1.3-i*.07)),x=f.x+(f.to.x-f.x)*t,y=f.y+(f.to.y-f.y)*t-Math.sin(t*Math.PI)*48;c.fillStyle=f.color;c.beginPath();c.arc(x,y,4-i*.55,0,TAU);c.fill()}
    }else if(f.type==='launch')this.circle(f.x,f.y,4+24*p,f.color,2);
    else if(f.type==='blessing'||f.type==='phase'||f.type==='sink'){this.circle(f.x,f.y,20+p*(f.size||70),f.color,3);this.circle(f.x,f.y,10+p*(f.size||70)*.8,f.color+'66',2)}
    c.restore();
  }
}
