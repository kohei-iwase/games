// 戦略マップのルール。DOM非依存・決定的（乱数なし）。戦闘は battle.mjs に受け渡し、結果を applyBattle で反映する。
import {KNIGHTS,ESCORT,SKILLS,predict} from './battle.mjs';
export const MAP={w:3000,h:2000};
// 守る島。補給地を兼ねる。
export const LAMP={x:200,y:1000,r:90,name:'峰の灯'};
// 浅瀬：敵の中心が円内にいる間、ネフェリムは速度×0.35、眷属は×0.7。自軍は影響なし。
export const SHOALS=[{x:1300,y:900,r:180},{x:1700,y:1400,r:160},{x:1600,y:500,r:150},{x:900,y:1450,r:120}];
// 小島：通れない。
export const ISLETS=[{x:1100,y:600,r:70},{x:2100,y:1150,r:90}];
export const FLEET_SPEED=60, CONTACT=70, PUSH=220, GRACE=4;
const SHOAL_SLOW={nephilim:.35,kin:.7}, SIEGE_DAMAGE={nephilim:3,kin:1.5}, MARGIN=24;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const maxHpOf=type=>(type==='escort'?ESCORT:KNIGHTS[type]).maxHp;
const ship=type=>({type,hp:maxHpOf(type)});
// 小島の中なら外へ出す。
function pushOut(p){for(const o of ISLETS){const d=dist(p,o);if(d<o.r+MARGIN){const a=d>1e-6?Math.atan2(p.y-o.y,p.x-o.x):Math.PI;p.x=o.x+Math.cos(a)*(o.r+MARGIN);p.y=o.y+Math.sin(a)*(o.r+MARGIN)}}return p}
const clampMap=(p,m=20)=>{p.x=Math.min(MAP.w-m,Math.max(m,p.x));p.y=Math.min(MAP.h-m,Math.max(m,p.y));return p};
// 目標へ speed*dt だけ進む。小島に入りそうなら縁に沿って（目標に近い側の接線方向へ）押し出す。到達したら true。
function advance(o,tx,ty,speed,dt){const d=Math.hypot(tx-o.x,ty-o.y);if(d<1e-6)return true;const n=Math.min(d,speed*dt),dx=(tx-o.x)/d,dy=(ty-o.y)/d;let x=o.x+dx*n,y=o.y+dy*n;
 for(const s of ISLETS){const r=s.r+MARGIN;if(Math.hypot(x-s.x,y-s.y)<r){const rx=o.x-s.x,ry=o.y-s.y,rl=Math.hypot(rx,ry)||1;let t=[-ry/rl,rx/rl];if(t[0]*dx+t[1]*dy<0)t=[-t[0],-t[1]];x=o.x+t[0]*n;y=o.y+t[1]*n;const l=Math.hypot(x-s.x,y-s.y)||1;if(l<r){x=s.x+(x-s.x)/l*r;y=s.y+(y-s.y)/l*r}}}
 o.x=x;o.y=y;return n>=d-1e-9}
// 艦隊の艦に戦闘内の艦idを振る（騎士は種類名、随伴艦は escort1,escort2…）。
function battleIds(f){let n=0;return f.ships.map(s=>s.type==='escort'?'escort'+ ++n:s.type)}
export class Strategy{
 constructor(){
  this.time=0;this.paused=true;this.result=null;this.reason='';this.lamp={hp:100};this.log=[];this.encounter=null;this.battles=0;this.cooldowns={};
  this.seen={};// 再生済みの物語の場面（contact／interlude）。
  this.fleets=[
   {id:'main',name:'主力艦隊',ships:['lance','stake','escort'].map(ship),x:520,y:950,target:null,formation:'free',skillOrder:['stake','lance']},
   {id:'detached',name:'別働隊',ships:['guard','escort','escort'].map(ship),x:520,y:1250,target:null,formation:'free',skillOrder:['guard']}];
  const kin=(id,x,y,ai,delay=0)=>({id,kind:'kin',name:'眷属の群れ',hp:420,maxHp:420,x,y,speed:34,ai,active:!delay,delay,siege:false});
  this.enemies=[{id:'nephilim',kind:'nephilim',name:'ネフェリム',hp:2250,maxHp:2250,x:2750,y:1000,speed:22,ai:'lamp',active:true,delay:0,siege:false},
   kin('kin1',2600,500,'lamp'),kin('kin2',2550,1550,'hunt'),kin('kin3',2900,1300,'lamp',40)];
  this.note('第一歌「血海の誓い」：ネフェリムの艦隊が峰の灯を目指している。');
 }
 note(text){this.log.unshift({time:this.time,text});this.log.length=Math.min(this.log.length,100)}
 fleet(id){return this.fleets.find(f=>f.id===id)}
 enemy(id){return this.enemies.find(e=>e.id===id)}
 // 戦闘中の艦隊の旗艦は先頭の艦。
 flagship(f){return f.ships[0]}
 order(fleetId,x,y){const f=this.fleet(fleetId);if(!f||this.result)return false;f.target=pushOut(clampMap({x,y}));return true}
 stop(fleetId){const f=this.fleet(fleetId);if(!f)return false;f.target=null;return true}
 inShoal(e){return SHOALS.some(o=>dist(e,o)<=o.r)}
 // 敵の目的地。hunt は700以内の最寄りの自軍艦隊、いなければ島。
 goal(e){if(e.ai==='hunt'){let best=null;for(const f of this.fleets)if(dist(f,e)<=700&&(!best||dist(f,e)<dist(best,e)))best=f;if(best)return best}return LAMP}
 step(dt){
  if(this.paused||this.result||this.encounter)return;
  dt=Math.max(0,dt);this.time+=dt;
  for(const e of this.enemies)if(!e.active&&this.time>=e.delay){e.active=true;this.note(`${e.name}が海域に現れた。`)}
  for(const f of this.fleets){
   if(f.target&&advance(f,f.target.x,f.target.y,FLEET_SPEED,dt))f.target=null;
   if(dist(f,LAMP)<=LAMP.r+60)for(const s of f.ships)s.hp=Math.min(maxHpOf(s.type),s.hp+maxHpOf(s.type)*.02*dt)}
  for(const e of this.enemies){
   if(!e.active)continue;
   const g=this.goal(e),stop=g===LAMP?LAMP.r+40:CONTACT*.5;e.siege=false;
   if(dist(e,g)>stop){advance(e,g.x,g.y,e.speed*(this.inShoal(e)?SHOAL_SLOW[e.kind]:1),dt)}
   else if(g===LAMP){e.siege=true;this.lamp.hp=Math.max(0,this.lamp.hp-SIEGE_DAMAGE[e.kind]*dt)}}
  this.checkEnd();if(this.result)return;
  for(const f of this.fleets)for(const e of this.enemies){
   if(!e.active||dist(f,e)>=CONTACT||this.time<(this.cooldowns[f.id+':'+e.id]||0))continue;
   this.encounter={fleetId:f.id,enemyId:e.id};this.paused=true;this.note(`${f.name}が${e.name}と接触。`);return}
 }
 // 撃破・沈没の整理と勝敗判定。
 checkEnd(){
  for(const e of this.enemies.filter(e=>e.hp<=0)){this.note(`${e.name}を撃破。`)}this.enemies=this.enemies.filter(e=>e.hp>0);
  for(const f of this.fleets)f.ships=f.ships.filter(s=>s.hp>0);
  for(const f of this.fleets.filter(f=>!f.ships.length))this.note(`${f.name}が壊滅。`);this.fleets=this.fleets.filter(f=>f.ships.length);
  if(this.result)return;
  const end=(r,why)=>{this.result=r;this.reason=why;this.paused=true;this.note(why)};
  if(!this.enemy('nephilim'))end('victory','ネフェリム撃破');
  else if(this.lamp.hp<=0)end('defeat','峰の灯が消えた');
  else if(!this.fleets.some(f=>f.ships.some(s=>s.type==='lance')))end('defeat',this.fleets.length?'ミラルカ辺境伯、戦闘不能':'自軍の艦隊が全滅');
 }
 // 戦闘への受け渡し。艦の対応は編成順（battleIds）。
 battleOptions(enc){
  const f=this.fleet(enc.fleetId),e=this.enemy(enc.enemyId),ids=battleIds(f),shipHp={};f.ships.forEach((s,i)=>shipHp[ids[i]]=Math.max(1,Math.round(s.hp)));
  return {fleet:f.ships.map(s=>s.type),shipHp,auto:true,skillOrder:f.skillOrder.filter(k=>SKILLS[k]&&f.ships.some(s=>s.type===k)),formation:f.formation,duration:30,island:false,enemyKind:e.kind,enemyHp:Math.ceil(e.hp),enemyMaxHp:e.maxHp,joustPolicy:'manual'}
 }
 predictFor(enc){return predict(this.battleOptions(enc))}
 applyBattle(enc,report){
  const f=this.fleet(enc.fleetId),e=this.enemy(enc.enemyId);
  if(!f||!e){this.encounter=null;return}
  const ids=battleIds(f);
  f.ships.forEach((s,i)=>{const r=report.ships.find(x=>x.id===ids[i]);if(r)s.hp=r.sunk?0:Math.max(1,r.hp)});
  e.hp=Math.max(0,report.enemyHp);
  const win=report.result==='victory';
  this.note(`${f.name}と${e.name}の戦闘：${win?(e.hp<=0?'撃破':'判定勝ち'):'敗退'}。`);
  if(e.hp>0){
   if(win){const a=this.dir(f,e);e.x+=a.x*PUSH;e.y+=a.y*PUSH;pushOut(clampMap(e))}
   else{let a=this.dir(f,LAMP);if(a.x*(e.x-f.x)+a.y*(e.y-f.y)>0)a=this.dir(e,f);f.x+=a.x*PUSH;f.y+=a.y*PUSH;pushOut(clampMap(f));f.target=null}}
  this.cooldowns[f.id+':'+e.id]=this.time+GRACE;this.battles++;this.encounter=null;
  this.checkEnd();
 }
 // 敵を押す・艦隊を寄せる向き。from から to へ向かう単位ベクトル（同位置なら西向き）。
 dir(from,to){const d=dist(from,to);return d>1e-6?{x:(to.x-from.x)/d,y:(to.y-from.y)/d}:{x:-1,y:0}}
}
